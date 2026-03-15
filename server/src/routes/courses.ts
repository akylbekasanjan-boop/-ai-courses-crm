import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

export const coursesRouter = Router();

const createCourseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().default('RUB'),
  duration: z.string().optional(),
  format: z.string().default('online'),
  level: z.string().default('beginner'),
  isActive: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

const updateCourseSchema = createCourseSchema.partial();

// Get all courses
coursesRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { isActive, search } = req.query;

    const where: any = {};

    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        _count: {
          select: { deals: true, leads: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Ошибка при получении курсов' });
  }
});

// Get course by ID
coursesRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        deals: {
          select: { id: true, title: true, amount: true, status: true },
        },
        leads: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Курс не найден' });
    }

    res.json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Ошибка при получении курса' });
  }
});

// Create course (admin only)
coursesRouter.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createCourseSchema.parse(req.body);

    const course = await prisma.course.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        currency: data.currency,
        duration: data.duration,
        format: data.format,
        level: data.level,
        isActive: data.isActive,
        tags: data.tags || [],
      },
    });

    res.status(201).json(course);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Ошибка при создании курса' });
  }
});

// Update course (admin only)
coursesRouter.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateCourseSchema.parse(req.body);

    const course = await prisma.course.update({
      where: { id },
      data,
    });

    res.json(course);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении курса' });
  }
});

// Delete course (admin only)
coursesRouter.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        _count: { select: { deals: true, leads: true } },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Курс не найден' });
    }

    if (course._count.deals > 0 || course._count.leads > 0) {
      // Just deactivate instead of delete
      await prisma.course.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({ message: 'Курс деактивирован (есть связанные сделки/лиды)' });
    }

    await prisma.course.delete({
      where: { id },
    });

    res.json({ message: 'Курс удалён' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Ошибка при удалении курса' });
  }
});

// Get course stats
coursesRouter.get('/stats/popular', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { deals: { where: { status: 'won' } } },
        },
        deals: {
          where: { status: 'won' },
          select: { amount: true },
        },
      },
    });

    const popular = courses
      .map(course => ({
        id: course.id,
        name: course.name,
        salesCount: course._count.deals,
        totalRevenue: course.deals.reduce((sum, d) => sum + d.amount, 0),
      }))
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 10);

    res.json(popular);
  } catch (error) {
    console.error('Get popular courses error:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики курсов' });
  }
});