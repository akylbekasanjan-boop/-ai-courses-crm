"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.usersRouter = (0, express_1.Router)();
const updateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    avatarUrl: zod_1.z.string().url().optional(),
});
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(['admin', 'team_lead', 'sales_manager']).default('sales_manager'),
});
// Get current user profile
exports.usersRouter.get('/me', auth_js_1.authenticate, async (req, res) => {
    try {
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: req.user.id },
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
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Ошибка при получении профиля' });
    }
});
// Update current user profile
exports.usersRouter.put('/me', auth_js_1.authenticate, async (req, res) => {
    try {
        const data = updateUserSchema.parse(req.body);
        const user = await prisma_js_1.default.user.update({
            where: { id: req.user.id },
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении профиля' });
    }
});
// Change password
exports.usersRouter.put('/me/password', auth_js_1.authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Требуется текущий и новый пароль' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
        }
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const isValidPassword = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Неверный текущий пароль' });
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 12);
        await prisma_js_1.default.user.update({
            where: { id: req.user.id },
            data: { passwordHash },
        });
        res.json({ message: 'Пароль успешно изменён' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Ошибка при смене пароля' });
    }
});
// Get all users (admin + team_lead)
exports.usersRouter.get('/', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin', 'team_lead'), async (req, res) => {
    try {
        const users = await prisma_js_1.default.user.findMany({
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
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Ошибка при получении пользователей' });
    }
});
// Get managers for assignment (admin + team_lead)
exports.usersRouter.get('/managers', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin', 'team_lead'), async (req, res) => {
    try {
        const users = await prisma_js_1.default.user.findMany({
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
    }
    catch (error) {
        console.error('Get managers error:', error);
        res.status(500).json({ error: 'Ошибка при получении менеджеров' });
    }
});
// Create user (admin only)
exports.usersRouter.post('/', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const data = createUserSchema.parse(req.body);
        const existingUser = await prisma_js_1.default.user.findUnique({
            where: { email: data.email },
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        const passwordHash = await bcrypt_1.default.hash(data.password, 12);
        const user = await prisma_js_1.default.user.create({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Ошибка при создании пользователя' });
    }
});
// Update user (admin only)
exports.usersRouter.put('/:id', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateUserSchema.parse(req.body);
        const user = await prisma_js_1.default.user.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении пользователя' });
    }
});
// Deactivate user (admin only)
exports.usersRouter.delete('/:id', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id === id) {
            return res.status(400).json({ error: 'Нельзя деактивировать самого себя' });
        }
        await prisma_js_1.default.user.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({ message: 'Пользователь деактивирован' });
    }
    catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({ error: 'Ошибка при деактивации пользователя' });
    }
});
// Toggle user active status (admin only)
exports.usersRouter.patch('/:id/toggle', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id === id) {
            return res.status(400).json({ error: 'Нельзя изменить статус самого себя' });
        }
        const currentUser = await prisma_js_1.default.user.findUnique({
            where: { id },
        });
        if (!currentUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const updatedUser = await prisma_js_1.default.user.update({
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
    }
    catch (error) {
        console.error('Toggle user error:', error);
        res.status(500).json({ error: 'Ошибка при изменении статуса пользователя' });
    }
});
//# sourceMappingURL=users.js.map