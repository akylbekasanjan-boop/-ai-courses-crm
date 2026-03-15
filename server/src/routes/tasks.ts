import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const tasksRouter = Router();

const createTaskSchema = z.object({
  type: z.enum(['call', 'meeting', 'email', 'follow_up', 'other']),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.string().optional(),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  dueDate: z.string().datetime(),
  dueTime: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const updateTaskSchema = createTaskSchema.partial();

// Helper to filter tasks based on user role
function getTaskFilter(req: AuthRequest) {
  if (req.user!.role === 'sales_manager') {
    return { assignedToId: req.user!.id };
  }
  return {};
}

// Get all tasks
tasksRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      status, 
      type, 
      assignedToId, 
      leadId, 
      dealId,
      dateFrom,
      dateTo,
      page = '1', 
      limit = '50' 
    } = req.query;

    const where: any = getTaskFilter(req);

    if (status) where.status = status;
    if (type) where.type = type;
    if (assignedToId) where.assignedToId = assignedToId;
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;
    if (dateFrom || dateTo) {
      where.dueDate = {};
      if (dateFrom) where.dueDate.gte = new Date(dateFrom as string);
      if (dateTo) where.dueDate.lte = new Date(dateTo as string);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          lead: {
            select: { id: true, name: true, phone: true },
          },
          deal: {
            select: { id: true, title: true, stage: true },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Ошибка при получении задач' });
  }
});

// Get today's tasks
tasksRouter.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      assignedToId: req.user!.id,
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
      status: { not: 'done' },
    };

    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: {
          select: { id: true, name: true, phone: true },
        },
        deal: {
          select: { id: true, title: true, stage: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get today tasks error:', error);
    res.status(500).json({ error: 'Ошибка при получении задач на сегодня' });
  }
});

// Get overdue tasks
tasksRouter.get('/overdue', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const where: any = {
      assignedToId: req.user!.id,
      dueDate: { lt: now },
      status: { not: 'done' },
    };

    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: {
          select: { id: true, name: true, phone: true },
        },
        deal: {
          select: { id: true, title: true, stage: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get overdue tasks error:', error);
    res.status(500).json({ error: 'Ошибка при получении просроченных задач' });
  }
});

// Get task by ID
tasksRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: true,
        deal: {
          include: { stage: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Ошибка при получении задачи' });
  }
});

// Create task
tasksRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        assignedToId: data.assignedToId || req.user!.id,
        leadId: data.leadId,
        dealId: data.dealId,
        dueDate: new Date(data.dueDate),
        dueTime: data.dueTime,
        priority: data.priority,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, name: true, phone: true },
        },
        deal: {
          select: { id: true, title: true, stage: true },
        },
      },
    });

    // Notify assigned user if different from creator
    if (task.assignedToId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          title: 'Новая задача',
          message: `Вам назначена задача: ${task.title}`,
          type: 'task_assigned',
          link: `/tasks/${task.id}`,
        },
      });
    }

    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ошибка при создании задачи' });
  }
});

// Update task
tasksRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateTaskSchema.parse(req.body);

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, name: true, phone: true },
        },
        deal: {
          select: { id: true, title: true, stage: true },
        },
      },
    });

    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении задачи' });
  }
});

// Complete task
tasksRouter.post('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { result } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'done',
        completedAt: new Date(),
        result,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, name: true },
        },
        deal: {
          select: { id: true, title: true },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'task_completed',
        description: `Задача выполнена: ${task.title}${result ? `. Результат: ${result}` : ''}`,
        userId: req.user!.id,
        leadId: task.leadId,
        dealId: task.dealId,
        metadata: { result },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Ошибка при завершении задачи' });
  }
});

// Delete task
tasksRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id },
    });

    res.json({ message: 'Задача удалена' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Ошибка при удалении задачи' });
  }
});

// Get task stats
tasksRouter.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const where = getTaskFilter(req);
    const now = new Date();

    const [total, pending, inProgress, done, overdue] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.count({ where: { ...where, status: 'pending' } }),
      prisma.task.count({ where: { ...where, status: 'in_progress' } }),
      prisma.task.count({ where: { ...where, status: 'done' } }),
      prisma.task.count({ where: { ...where, dueDate: { lt: now }, status: { not: 'done' } } }),
    ]);

    res.json({
      total,
      pending,
      inProgress,
      done,
      overdue,
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
});