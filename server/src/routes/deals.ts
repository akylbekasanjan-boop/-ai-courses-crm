import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

export const dealsRouter = Router();

const createDealSchema = z.object({
  title: z.string().min(1),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  stageId: z.string(),
  amount: z.number().min(0).default(0),
  currency: z.string().default('RUB'),
  courseId: z.string().optional(),
  assignedToId: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

const updateDealSchema = createDealSchema.partial();

// Helper to filter deals based on user role
function getDealFilter(req: AuthRequest) {
  if (req.user!.role === 'sales_manager') {
    return { assignedToId: req.user!.id };
  }
  return {};
}

// Get all deals
dealsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      stageId, 
      assignedToId, 
      courseId, 
      status,
      search,
      page = '1', 
      limit = '50' 
    } = req.query;

    const where: any = getDealFilter(req);

    if (stageId) where.stageId = stageId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { lead: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          stage: true,
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          lead: {
            select: { id: true, name: true, phone: true, email: true },
          },
          contact: {
            select: { id: true, firstName: true, lastName: true, phones: true },
          },
          course: {
            select: { id: true, name: true, price: true },
          },
          _count: {
            select: { tasks: true, activities: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.deal.count({ where }),
    ]);

    res.json({
      deals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Ошибка при получении сделок' });
  }
});

// Get deals grouped by stage (for Kanban)
dealsRouter.get('/kanban', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const where = getDealFilter(req);

    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        deals: {
          where,
          include: {
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
            lead: {
              select: { id: true, name: true, phone: true },
            },
            course: {
              select: { id: true, name: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    // Calculate totals per stage
    const kanbanData = stages.map(stage => ({
      ...stage,
      totalAmount: stage.deals.reduce((sum, deal) => sum + deal.amount, 0),
      dealsCount: stage.deals.length,
    }));

    res.json(kanbanData);
  } catch (error) {
    console.error('Get kanban error:', error);
    res.status(500).json({ error: 'Ошибка при получении канбана' });
  }
});

// Get deal by ID
dealsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
        },
        lead: true,
        contact: true,
        course: true,
        tasks: {
          where: { status: { not: 'done' } },
          orderBy: { dueDate: 'asc' },
        },
        activities: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && deal.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    res.json(deal);
  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({ error: 'Ошибка при получении сделки' });
  }
});

// Create deal
dealsRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createDealSchema.parse(req.body);

    const deal = await prisma.deal.create({
      data: {
        title: data.title,
        leadId: data.leadId,
        contactId: data.contactId,
        stageId: data.stageId,
        amount: data.amount,
        currency: data.currency,
        courseId: data.courseId,
        assignedToId: data.assignedToId || req.user!.id,
        probability: data.probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        tags: data.tags || [],
      },
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, name: true, phone: true, email: true },
        },
        course: true,
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'stage_change',
        description: `Создана сделка: ${deal.title}`,
        userId: req.user!.id,
        dealId: deal.id,
        leadId: deal.leadId,
      },
    });

    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create deal error:', error);
    res.status(500).json({ error: 'Ошибка при создании сделки' });
  }
});

// Update deal
dealsRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateDealSchema.parse(req.body);

    const existingDeal = await prisma.deal.findUnique({
      where: { id },
      include: { stage: true },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingDeal.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    // Track stage change
    if (data.stageId && data.stageId !== existingDeal.stageId) {
      const oldStage = await prisma.pipelineStage.findUnique({
        where: { id: existingDeal.stageId },
      });
      const newStage = await prisma.pipelineStage.findUnique({
        where: { id: data.stageId },
      });

      await prisma.activity.create({
        data: {
          type: 'stage_change',
          description: `Этап изменён: ${oldStage?.name} → ${newStage?.name}`,
          userId: req.user!.id,
          dealId: id,
          metadata: { oldStage: oldStage?.name, newStage: newStage?.name },
        },
      });

      // Check if moved to won/lost stage
      const targetStage = await prisma.pipelineStage.findUnique({
        where: { id: data.stageId },
      });

      if (targetStage?.isWon) {
        await prisma.deal.update({
          where: { id },
          data: { status: 'won', closedAt: new Date() },
        });
      } else if (targetStage?.isLost) {
        await prisma.deal.update({
          where: { id },
          data: { status: 'lost', closedAt: new Date() },
        });
      }
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...data,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      },
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, name: true, phone: true, email: true },
        },
        course: true,
      },
    });

    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении сделки' });
  }
});

// Update deal stage (for drag and drop)
dealsRouter.put('/:id/stage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stageId, probability } = req.body;

    const existingDeal = await prisma.deal.findUnique({
      where: { id },
      include: { stage: true },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingDeal.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const oldStage = await prisma.pipelineStage.findUnique({
      where: { id: existingDeal.stageId },
    });
    const newStage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
    });

    const updateData: any = { stageId };
    if (probability !== undefined) updateData.probability = probability;

    // Check if moved to won/lost stage
    if (newStage?.isWon) {
      updateData.status = 'won';
      updateData.closedAt = new Date();
    } else if (newStage?.isLost) {
      updateData.status = 'lost';
      updateData.closedAt = new Date();
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, name: true, phone: true },
        },
        course: true,
      },
    });

    // Create activity for stage change
    if (stageId !== existingDeal.stageId) {
      await prisma.activity.create({
        data: {
          type: 'stage_change',
          description: `Этап изменён: ${oldStage?.name} → ${newStage?.name}`,
          userId: req.user!.id,
          dealId: id,
          metadata: { oldStage: oldStage?.name, newStage: newStage?.name },
        },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: deal.assignedToId,
          title: 'Сделка перемещена',
          message: `Сделка "${deal.title}" перемещена на этап "${newStage?.name}"`,
          type: 'deal_stage_change',
          link: `/deals/${deal.id}`,
        },
      });
    }

    res.json(deal);
  } catch (error) {
    console.error('Update deal stage error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении этапа' });
  }
});

// Mark deal as won
dealsRouter.post('/:id/win', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingDeal = await prisma.deal.findUnique({
      where: { id },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingDeal.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: { status: 'won', closedAt: new Date() },
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        course: true,
      },
    });

    await prisma.activity.create({
      data: {
        type: 'stage_change',
        description: `Сделка выиграна!`,
        userId: req.user!.id,
        dealId: id,
      },
    });

    res.json(deal);
  } catch (error) {
    console.error('Win deal error:', error);
    res.status(500).json({ error: 'Ошибка при закрытии сделки' });
  }
});

// Mark deal as lost
dealsRouter.post('/:id/lose', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lostReason } = req.body;

    const existingDeal = await prisma.deal.findUnique({
      where: { id },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingDeal.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: { status: 'lost', closedAt: new Date(), lostReason },
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    await prisma.activity.create({
      data: {
        type: 'stage_change',
        description: `Сделка проиграна. Причина: ${lostReason || 'не указана'}`,
        userId: req.user!.id,
        dealId: id,
        metadata: { lostReason },
      },
    });

    res.json(deal);
  } catch (error) {
    console.error('Lose deal error:', error);
    res.status(500).json({ error: 'Ошибка при закрытии сделки' });
  }
});

// Delete deal
dealsRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingDeal = await prisma.deal.findUnique({
      where: { id },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingDeal.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    await prisma.deal.delete({
      where: { id },
    });

    res.json({ message: 'Сделка удалена' });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Ошибка при удалении сделки' });
  }
});

// Get deal stats
dealsRouter.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const where = getDealFilter(req);

    const [total, activeCount, wonCount, lostCount, totalAmount, wonAmount] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.count({ where: { ...where, status: 'active' } }),
      prisma.deal.count({ where: { ...where, status: 'won' } }),
      prisma.deal.count({ where: { ...where, status: 'lost' } }),
      prisma.deal.aggregate({ where, _sum: { amount: true } }),
      prisma.deal.aggregate({ where: { ...where, status: 'won' }, _sum: { amount: true } }),
    ]);

    res.json({
      total,
      active: activeCount,
      won: wonCount,
      lost: lostCount,
      totalAmount: totalAmount._sum.amount || 0,
      wonAmount: wonAmount._sum.amount || 0,
      winRate: total > 0 ? Math.round((wonCount / total) * 100) : 0,
    });
  } catch (error) {
    console.error('Get deal stats error:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
});