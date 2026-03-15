import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

export const usersRouter = Router();

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'team_lead', 'sales_manager']).default('sales_manager'),
});

// Get current user profile
usersRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Ошибка при получении профиля' });
  }
});

// Update current user profile
usersRouter.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении профиля' });
  }
});

// Change password
usersRouter.put('/me/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Требуется текущий и новый пароль' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(400).json({ error: 'Неверный текущий пароль' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    res.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ошибка при смене пароля' });
  }
});

// Get all users (admin + team_lead)
usersRouter.get('/', authenticate, authorize('admin', 'team_lead'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            leads: true,
            deals: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователей' });
  }
});

// Get managers for assignment (admin + team_lead)
usersRouter.get('/managers', authenticate, authorize('admin', 'team_lead'), async (req: AuthRequest, res: Response) => {
  try {
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
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ error: 'Ошибка при получении менеджеров' });
  }
});

// Create user (admin only)
usersRouter.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Ошибка при создании пользователя' });
  }
});

// Update user (admin only)
usersRouter.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении пользователя' });
  }
});

// Deactivate user (admin only)
usersRouter.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      return res.status(400).json({ error: 'Нельзя деактивировать самого себя' });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Пользователь деактивирован' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Ошибка при деактивации пользователя' });
  }
});

// Toggle user active status (admin only)
usersRouter.patch('/:id/toggle', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      return res.status(400).json({ error: 'Нельзя изменить статус самого себя' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !currentUser.isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Toggle user error:', error);
    res.status(500).json({ error: 'Ошибка при изменении статуса пользователя' });
  }
});