import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export const analyticsRouter = Router();

// Helper to get date filter
function getDateFilter(period: string) {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'today':
      return { gte: startOfDay(now), lte: endOfDay(now) };
    case 'week':
      startDate = subDays(now, 7);
      break;
    case 'month':
      startDate = subDays(now, 30);
      break;
    case 'quarter':
      startDate = subDays(now, 90);
      break;
    default:
      startDate = subDays(now, 30);
  }

  return { gte: startDate, lte: now };
}

// Dashboard data
analyticsRouter.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month', userId } = req.query;
    const dateFilter = getDateFilter(period as string);
    
    const where: any = {
      createdAt: dateFilter,
    };
    
    if (req.user!.role === 'sales_manager' || userId) {
      where.assignedToId = userId || req.user!.id;
    }

    // Get stats
    const [
      totalLeads,
      newLeads,
      totalDeals,
      activeDeals,
      wonDeals,
      totalRevenue,
      leadSourceCounts,
      coursePopularity,
    ] = await Promise.all([
      prisma.lead.count({ where: { assignedToId: where.assignedToId || req.user!.id } }),
      prisma.lead.count({
        where: {
          assignedToId: where.assignedToId || req.user!.id,
          createdAt: dateFilter,
        }
      }),
      prisma.deal.count({ where: { assignedToId: where.assignedToId || req.user!.id } }),
      prisma.deal.count({ where: { ...where, status: 'active' } }),
      prisma.deal.count({ where: { ...where, status: 'won', closedAt: dateFilter } }),
      prisma.deal.aggregate({
        where: { 
          ...where, 
          status: 'won',
          closedAt: dateFilter,
        },
        _sum: { amount: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: {
          assignedToId: where.assignedToId || req.user!.id,
          createdAt: dateFilter,
        },
        _count: true,
      }),
      prisma.course.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: { deals: { where: { status: 'won', closedAt: dateFilter } } },
          },
        },
      }),
    ]);

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;
    const avgDealAmount = wonDeals > 0 ? (totalRevenue._sum.amount || 0) / wonDeals : 0;

    res.json({
      leads: {
        total: totalLeads,
        new: newLeads,
      },
      deals: {
        total: totalDeals,
        active: activeDeals,
        won: wonDeals,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
        average: avgDealAmount,
      },
      conversionRate,
      leadSources: leadSourceCounts.map(s => ({
        source: s.source,
        count: s._count,
      })),
      popularCourses: coursePopularity
        .map(c => ({
          id: c.id,
          name: c.name,
          salesCount: c._count.deals,
        }))
        .filter(c => c.salesCount > 0)
        .sort((a, b) => b.salesCount - a.salesCount)
        .slice(0, 5),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Ошибка при получении данных дашборда' });
  }
});

// Funnel analytics
analyticsRouter.get('/funnel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month' } = req.query;
    const dateFilter = getDateFilter(period as string);

    // Lead funnel
    const leadStatuses = await prisma.lead.groupBy({
      by: ['status'],
      where: { createdAt: dateFilter },
      _count: true,
    });

    // Deal funnel by stages
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

    const dealFunnel = stages.map(stage => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      dealsCount: stage._count.deals,
      totalAmount: stage.deals.reduce((sum, d) => sum + d.amount, 0),
    }));

    res.json({
      leadStatuses: leadStatuses.map(s => ({
        status: s.status,
        count: s._count,
      })),
      dealFunnel,
    });
  } catch (error) {
    console.error('Funnel error:', error);
    res.status(500).json({ error: 'Ошибка при получении воронки' });
  }
});

// Revenue analytics
analyticsRouter.get('/revenue', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month', groupBy = 'day' } = req.query;
    const dateFilter = getDateFilter(period as string);

    const deals = await prisma.deal.findMany({
      where: {
        status: 'won',
        closedAt: dateFilter,
      },
      select: {
        amount: true,
        closedAt: true,
        currency: true,
      },
      orderBy: { closedAt: 'asc' },
    });

    // Group by day/week/month
    const grouped = deals.reduce((acc, deal) => {
      const date = deal.closedAt!;
      let key: string;

      if (groupBy === 'week') {
        const weekStart = startOfDay(subDays(date, date.getDay()));
        key = format(weekStart, 'yyyy-MM-dd');
      } else if (groupBy === 'month') {
        key = format(new Date(date.getFullYear(), date.getMonth(), 1), 'yyyy-MM-dd');
      } else {
        key = format(date, 'yyyy-MM-dd');
      }

      if (!acc[key]) {
        acc[key] = { date: key, amount: 0, count: 0 };
      }
      acc[key].amount += deal.amount;
      acc[key].count += 1;

      return acc;
    }, {} as Record<string, { date: string; amount: number; count: number }>);

    const revenueData = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate total and average
    const total = revenueData.reduce((sum, r) => sum + r.amount, 0);
    const avg = revenueData.length > 0 ? total / revenueData.length : 0;

    res.json({
      data: revenueData,
      total,
      average: avg,
      count: deals.length,
    });
  } catch (error) {
    console.error('Revenue error:', error);
    res.status(500).json({ error: 'Ошибка при получении данных о выручке' });
  }
});

// Managers performance
analyticsRouter.get('/managers', authenticate, authorize('admin', 'team_lead'), async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month' } = req.query;
    const dateFilter = getDateFilter(period as string);

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['admin', 'team_lead', 'sales_manager'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        _count: {
          select: {
            leads: { where: { createdAt: dateFilter } },
            deals: { where: { createdAt: dateFilter } },
          },
        },
        deals: {
          where: { status: 'won', closedAt: dateFilter },
          select: { amount: true },
        },
        leads: {
          where: { createdAt: dateFilter, status: 'converted' },
          select: { id: true },
        },
      },
    });

    const managers = users.map(user => {
      const totalRevenue = user.deals.reduce((sum, d) => sum + d.amount, 0);
      const leadsCount = user._count.leads;
      const conversionRate = leadsCount > 0 
        ? Math.round((user.leads.length / leadsCount) * 100) 
        : 0;

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        avatarUrl: user.avatarUrl,
        leadsCount: user._count.leads,
        dealsCount: user._count.deals,
        wonDeals: user.deals.length,
        totalRevenue,
        conversionRate,
      };
    });

    // Sort by revenue
    managers.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json(managers);
  } catch (error) {
    console.error('Managers error:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики менеджеров' });
  }
});

// Lead sources breakdown
analyticsRouter.get('/sources', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month' } = req.query;
    const dateFilter = getDateFilter(period as string);

    const where: any = { createdAt: dateFilter };
    if (req.user!.role === 'sales_manager') {
      where.assignedToId = req.user!.id;
    }

    const sources = await prisma.lead.groupBy({
      by: ['source'],
      where,
      _count: true,
      _sum: {
        id: true,
      },
    });

    const total = sources.reduce((sum, s) => sum + s._count, 0);

    const result = sources.map(s => ({
      source: s.source,
      count: s._count,
      percentage: total > 0 ? Math.round((s._count / total) * 100) : 0,
    }));

    res.json({
      sources: result,
      total,
    });
  } catch (error) {
    console.error('Sources error:', error);
    res.status(500).json({ error: 'Ошибка при получении источников' });
  }
});

// KPI metrics
analyticsRouter.get('/kpi', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month', userId } = req.query;
    const dateFilter = getDateFilter(period as string);

    const where: any = {};
    if (userId || req.user!.role === 'sales_manager') {
      where.assignedToId = userId || req.user!.id;
    }

    const [
      leadsCount,
      dealsCount,
      wonDeals,
      totalRevenue,
      avgDealAmount,
      pipelineValue,
    ] = await Promise.all([
      prisma.lead.count({ where: { createdAt: dateFilter } }),
      prisma.deal.count({ where: { createdAt: dateFilter } }),
      prisma.deal.count({ where: { ...where, status: 'won', closedAt: dateFilter } }),
      prisma.deal.aggregate({
        where: { ...where, status: 'won', closedAt: dateFilter },
        _sum: { amount: true },
      }),
      prisma.deal.aggregate({
        where: { ...where, status: 'won', closedAt: dateFilter },
        _avg: { amount: true },
      }),
      prisma.deal.aggregate({
        where: { ...where, status: 'active' },
        _sum: { amount: true },
      }),
    ]);

    const conversionRate = leadsCount > 0 ? Math.round((wonDeals / leadsCount) * 100) : 0;
    const winRate = dealsCount > 0 ? Math.round((wonDeals / dealsCount) * 100) : 0;

    res.json({
      leadsCount,
      dealsCount,
      wonDeals,
      conversionRate,
      winRate,
      totalRevenue: totalRevenue._sum.amount || 0,
      avgDealAmount: avgDealAmount._avg.amount || 0,
      pipelineValue: pipelineValue._sum.amount || 0,
    });
  } catch (error) {
    console.error('KPI error:', error);
    res.status(500).json({ error: 'Ошибка при получении KPI' });
  }
});