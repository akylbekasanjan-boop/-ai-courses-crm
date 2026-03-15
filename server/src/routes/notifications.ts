import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const notificationsRouter = Router();

// Get all notifications for current user
notificationsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { unreadOnly, page = '1', limit = '20' } = req.query;

    const where: any = {
      userId: req.user!.id,
    };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Ошибка при получении уведомлений' });
  }
});

// Get unread count
notificationsRouter.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Ошибка при получении счётчика' });
  }
});

// Mark notification as read
notificationsRouter.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: { id, userId: req.user!.id },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    res.json({ message: 'Уведомление прочитано' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении уведомления' });
  }
});

// Mark all as read
notificationsRouter.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'Все уведомления прочитаны' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении уведомлений' });
  }
});

// Delete notification
notificationsRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.notification.deleteMany({
      where: { id, userId: req.user!.id },
    });

    res.json({ message: 'Уведомление удалено' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Ошибка при удалении уведомления' });
  }
});

// Delete all read notifications
notificationsRouter.delete('/clear/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user!.id, isRead: true },
    });

    res.json({ message: 'Прочитанные уведомления удалены' });
  } catch (error) {
    console.error('Clear read error:', error);
    res.status(500).json({ error: 'Ошибка при очистке уведомлений' });
  }
});