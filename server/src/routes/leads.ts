import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

export const leadsRouter = Router();

const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(['website', 'instagram', 'telegram', 'youtube', 'referral', 'cold_call', 'other', 'ads', 'whatsapp']),
  status: z.enum(['new', 'in_progress', 'qualified', 'converted', 'rejected', 'no_answer', 'thinking', 'paid']).optional(),
  comment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assignedToId: z.string().optional(),
  courseInterests: z.array(z.string()).optional(),
});

// Публичный эндпоинт для создания заявки (для форм на сайте, webhook от ADS)
leadsRouter.post('/public', async (req, res: Response) => {
  try {
    const data = createLeadSchema.parse(req.body);

    // Находим первого менеджера для назначения
    const manager = await prisma.user.findFirst({
      where: { role: 'sales_manager', isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        source: data.source,
        status: 'new', // Все новые заявки попадают в "Заявка"
        comment: data.comment,
        tags: data.tags || [],
        assignedToId: manager?.id,
      },
    });

    // Создаём уведомление для менеджера
    if (manager) {
      await prisma.notification.create({
        data: {
          userId: manager.id,
          title: 'Новая заявка!',
          message: `Новая заявка от ${data.name}. Источник: ${data.source}`,
          type: 'lead_created',
          link: '/leads',
        },
      });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Заявка создана',
      leadId: lead.id 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  }
});

const updateLeadSchema = createLeadSchema.partial();

// Новые статусы для воронки
const leadStatuses = ['new', 'in_progress', 'no_answer', 'thinking', 'rejected', 'paid'];

// Helper to filter leads based on user role
function getLeadFilter(req: AuthRequest) {
  if (req.user!.role === 'sales_manager') {
    return { assignedToId: req.user!.id };
  }
  return {};
}

// Get all leads
leadsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      status, 
      source, 
      assignedToId, 
      courseId, 
      search,
      page = '1', 
      limit = '50' 
    } = req.query;

    const where: any = getLeadFilter(req);

    if (status) where.status = status;
    if (source) where.source = source;
    if (assignedToId) where.assignedToId = assignedToId;
    if (courseId) where.courseInterests = { some: { id: courseId as string } };
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          courseInterests: {
            select: { id: true, name: true, price: true },
          },
          _count: {
            select: { tasks: true, activities: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Ошибка при получении лидов' });
  }
});

// Get lead by ID
leadsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
        },
        courseInterests: true,
        tasks: {
          where: { status: { not: 'done' } },
          orderBy: { dueDate: 'asc' },
          take: 5,
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

    if (!lead) {
      return res.status(404).json({ error: 'Лид не найден' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && lead.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Ошибка при получении лида' });
  }
});

// Create lead
leadsRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createLeadSchema.parse(req.body);

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        source: data.source,
        status: data.status || 'new',
        comment: data.comment,
        tags: data.tags || [],
        assignedToId: data.assignedToId || req.user!.id,
        courseInterests: data.courseInterests ? {
          connect: data.courseInterests.map(id => ({ id })),
        } : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        courseInterests: {
          select: { id: true, name: true, price: true },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'lead_assigned',
        description: `Лид создан и назначен на ${req.user!.firstName} ${req.user!.lastName}`,
        userId: req.user!.id,
        leadId: lead.id,
      },
    });

    // Create notification for assigned manager
    if (lead.assignedToId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          userId: lead.assignedToId,
          title: 'Новый лид',
          message: `Вам назначен новый лид: ${lead.name}`,
          type: 'lead_assigned',
          link: `/leads/${lead.id}`,
        },
      });
    }

    res.status(201).json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Ошибка при создании лида' });
  }
});

// Update lead
leadsRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateLeadSchema.parse(req.body);

    const existingLead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Лид не найден' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingLead.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    // Track status change
    if (data.status && data.status !== existingLead.status) {
      await prisma.activity.create({
        data: {
          type: 'stage_change',
          description: `Статус изменён: ${existingLead.status} → ${data.status}`,
          userId: req.user!.id,
          leadId: id,
          metadata: { oldStatus: existingLead.status, newStatus: data.status },
        },
      });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...data,
        courseInterests: data.courseInterests ? {
          set: data.courseInterests.map(cid => ({ id: cid })),
        } : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        courseInterests: {
          select: { id: true, name: true, price: true },
        },
      },
    });

    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении лида' });
  }
});

// Delete lead
leadsRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingLead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Лид не найден' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && existingLead.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    await prisma.lead.delete({
      where: { id },
    });

    res.json({ message: 'Лид удалён' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Ошибка при удалении лида' });
  }
});

// Convert lead to deal
leadsRouter.post('/:id/convert', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, stageId, amount, currency, courseId } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        courseInterests: true,
        assignedTo: true,
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Лид не найден' });
    }

    // Check access
    if (req.user!.role === 'sales_manager' && lead.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    // Get default stage if not provided
    let targetStageId = stageId;
    if (!targetStageId) {
      const firstStage = await prisma.pipelineStage.findFirst({
        orderBy: { order: 'asc' },
      });
      targetStageId = firstStage?.id;
    }

    // Create deal from lead
    const deal = await prisma.deal.create({
      data: {
        title: title || `Сделка: ${lead.name}`,
        leadId: lead.id,
        stageId: targetStageId!,
        amount: amount || 0,
        currency: currency || 'RUB',
        courseId: courseId || lead.courseInterests[0]?.id,
        assignedToId: lead.assignedToId,
      },
      include: {
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        course: true,
      },
    });

    // Update lead status
    await prisma.lead.update({
      where: { id },
      data: {
        status: 'converted',
        convertedAt: new Date(),
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'stage_change',
        description: `Лид конвертирован в сделку: ${deal.title}`,
        userId: req.user!.id,
        leadId: id,
        dealId: deal.id,
      },
    });

    res.status(201).json(deal);
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({ error: 'Ошибка при конвертации лида' });
  }
});

// Assign lead to manager
leadsRouter.post('/:id/assign', authenticate, authorize('admin', 'team_lead'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    if (!assignedToId) {
      return res.status(400).json({ error: 'ID менеджера обязателен' });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { assignedToId },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        title: 'Назначен новый лид',
        message: `Вам назначен лид: ${lead.name}`,
        type: 'lead_assigned',
        link: `/leads/${lead.id}`,
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'lead_assigned',
        description: `Лид переназначен на ${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`,
        userId: req.user!.id,
        leadId: id,
      },
    });

    res.json(lead);
  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({ error: 'Ошибка при назначении лида' });
  }
});

// Bulk assign leads
leadsRouter.post('/bulk/assign', authenticate, authorize('admin', 'team_lead'), async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, assignedToId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || !assignedToId) {
      return res.status(400).json({ error: 'Требуются leadIds и assignedToId' });
    }

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { assignedToId },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        title: 'Назначены новые лиды',
        message: `Вам назначено ${leadIds.length} лидов`,
        type: 'lead_assigned',
        link: '/leads',
      },
    });

    res.json({ message: `Назначено ${leadIds.length} лидов` });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ error: 'Ошибка при массовом назначении' });
  }
});

// Get lead stats
leadsRouter.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const where = getLeadFilter(req);

    const [total, newCount, inProgressCount, qualifiedCount, convertedCount, rejectedCount] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'new' } }),
      prisma.lead.count({ where: { ...where, status: 'in_progress' } }),
      prisma.lead.count({ where: { ...where, status: 'qualified' } }),
      prisma.lead.count({ where: { ...where, status: 'converted' } }),
      prisma.lead.count({ where: { ...where, status: 'rejected' } }),
    ]);

    res.json({
      total,
      new: newCount,
      inProgress: inProgressCount,
      qualified: qualifiedCount,
      converted: convertedCount,
      rejected: rejectedCount,
    });
  } catch (error) {
    console.error('Get lead stats error:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
});