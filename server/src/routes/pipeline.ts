import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

export const pipelineRouter = Router();

const createStageSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  order: z.number().optional(),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

const updateStageSchema = createStageSchema.partial();

// Get all pipeline stages
pipelineRouter.get('/stages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { deals: true },
        },
        deals: {
          where: { status: 'active' },
          select: { amount: true },
        },
      },
    });

    const stagesWithStats = stages.map(stage => ({
      ...stage,
      activeDealsCount: stage._count.deals,
      totalAmount: stage.deals.reduce((sum, d) => sum + d.amount, 0),
    }));

    res.json(stagesWithStats);
  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({ error: 'Ошибка при получении этапов' });
  }
});

// Get single stage
pipelineRouter.get('/stages/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const stage = await prisma.pipelineStage.findUnique({
      where: { id },
      include: {
        deals: {
          include: {
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!stage) {
      return res.status(404).json({ error: 'Этап не найден' });
    }

    res.json(stage);
  } catch (error) {
    console.error('Get stage error:', error);
    res.status(500).json({ error: 'Ошибка при получении этапа' });
  }
});

// Create stage (admin only)
pipelineRouter.post('/stages', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createStageSchema.parse(req.body);

    // Get max order if not provided
    let order = data.order;
    if (order === undefined) {
      const maxOrder = await prisma.pipelineStage.aggregate({
        _max: { order: true },
      });
      order = (maxOrder._max.order || 0) + 1;
    }

    const stage = await prisma.pipelineStage.create({
      data: {
        name: data.name,
        color: data.color || '#6366f1',
        order: order!,
        isWon: data.isWon,
        isLost: data.isLost,
      },
    });

    res.status(201).json(stage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Ошибка при создании этапа' });
  }
});

// Update stage (admin only)
pipelineRouter.put('/stages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateStageSchema.parse(req.body);

    const stage = await prisma.pipelineStage.update({
      where: { id },
      data,
    });

    res.json(stage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении этапа' });
  }
});

// Reorder stages (admin only)
pipelineRouter.put('/stages/reorder', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { stages } = req.body;

    if (!Array.isArray(stages)) {
      return res.status(400).json({ error: 'Требуется массив этапов' });
    }

    // Update order for each stage
    await Promise.all(
      stages.map((stage: { id: string; order: number }) =>
        prisma.pipelineStage.update({
          where: { id: stage.id },
          data: { order: stage.order },
        })
      )
    );

    const updatedStages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' },
    });

    res.json(updatedStages);
  } catch (error) {
    console.error('Reorder stages error:', error);
    res.status(500).json({ error: 'Ошибка при переупорядочивании этапов' });
  }
});

// Delete stage (admin only)
pipelineRouter.delete('/stages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const stage = await prisma.pipelineStage.findUnique({
      where: { id },
      include: { _count: { select: { deals: true } } },
    });

    if (!stage) {
      return res.status(404).json({ error: 'Этап не найден' });
    }

    if (stage._count.deals > 0) {
      return res.status(400).json({ error: 'Нельзя удалить этап со сделками' });
    }

    await prisma.pipelineStage.delete({
      where: { id },
    });

    res.json({ message: 'Этап удалён' });
  } catch (error) {
    console.error('Delete stage error:', error);
    res.status(500).json({ error: 'Ошибка при удалении этапа' });
  }
});

// Get default stages (seed)
pipelineRouter.post('/stages/default', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const existingStages = await prisma.pipelineStage.count();

    if (existingStages > 0) {
      return res.status(400).json({ error: 'Этапы уже существуют' });
    }

    const defaultStages = [
      { name: 'Первый контакт', color: '#6366f1', order: 1, isWon: false, isLost: false },
      { name: 'Отправлено КП', color: '#8b5cf6', order: 2, isWon: false, isLost: false },
      { name: 'Презентация / Демо', color: '#ec4899', order: 3, isWon: false, isLost: false },
      { name: 'Переговоры', color: '#f59e0b', order: 4, isWon: false, isLost: false },
      { name: 'Выставлен счёт', color: '#10b981', order: 5, isWon: false, isLost: false },
      { name: 'Оплачено', color: '#22c55e', order: 6, isWon: true, isLost: false },
      { name: 'Отказ', color: '#ef4444', order: 7, isWon: false, isLost: true },
    ];

    const stages = await Promise.all(
      defaultStages.map(stage =>
        prisma.pipelineStage.create({ data: stage })
      )
    );

    res.json(stages);
  } catch (error) {
    console.error('Create default stages error:', error);
    res.status(500).json({ error: 'Ошибка при создании этапов' });
  }
});