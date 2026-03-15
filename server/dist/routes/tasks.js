"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.tasksRouter = (0, express_1.Router)();
const createTaskSchema = zod_1.z.object({
    type: zod_1.z.enum(['call', 'meeting', 'email', 'follow_up', 'other']),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    assignedToId: zod_1.z.string().optional(),
    leadId: zod_1.z.string().optional(),
    dealId: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().datetime(),
    dueTime: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high']).default('medium'),
});
const updateTaskSchema = createTaskSchema.partial();
// Helper to filter tasks based on user role
function getTaskFilter(req) {
    if (req.user.role === 'sales_manager') {
        return { assignedToId: req.user.id };
    }
    return {};
}
// Get all tasks
exports.tasksRouter.get('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const { status, type, assignedToId, leadId, dealId, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
        const where = getTaskFilter(req);
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (assignedToId)
            where.assignedToId = assignedToId;
        if (leadId)
            where.leadId = leadId;
        if (dealId)
            where.dealId = dealId;
        if (dateFrom || dateTo) {
            where.dueDate = {};
            if (dateFrom)
                where.dueDate.gte = new Date(dateFrom);
            if (dateTo)
                where.dueDate.lte = new Date(dateTo);
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [tasks, total] = await Promise.all([
            prisma_js_1.default.task.findMany({
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
            prisma_js_1.default.task.count({ where }),
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
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Ошибка при получении задач' });
    }
});
// Get today's tasks
exports.tasksRouter.get('/today', auth_js_1.authenticate, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const where = {
            assignedToId: req.user.id,
            dueDate: {
                gte: today,
                lt: tomorrow,
            },
            status: { not: 'done' },
        };
        const tasks = await prisma_js_1.default.task.findMany({
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
    }
    catch (error) {
        console.error('Get today tasks error:', error);
        res.status(500).json({ error: 'Ошибка при получении задач на сегодня' });
    }
});
// Get overdue tasks
exports.tasksRouter.get('/overdue', auth_js_1.authenticate, async (req, res) => {
    try {
        const now = new Date();
        const where = {
            assignedToId: req.user.id,
            dueDate: { lt: now },
            status: { not: 'done' },
        };
        const tasks = await prisma_js_1.default.task.findMany({
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
    }
    catch (error) {
        console.error('Get overdue tasks error:', error);
        res.status(500).json({ error: 'Ошибка при получении просроченных задач' });
    }
});
// Get task by ID
exports.tasksRouter.get('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const task = await prisma_js_1.default.task.findUnique({
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
    }
    catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Ошибка при получении задачи' });
    }
});
// Create task
exports.tasksRouter.post('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const data = createTaskSchema.parse(req.body);
        const task = await prisma_js_1.default.task.create({
            data: {
                type: data.type,
                title: data.title,
                description: data.description,
                assignedToId: data.assignedToId || req.user.id,
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
        if (task.assignedToId !== req.user.id) {
            await prisma_js_1.default.notification.create({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Ошибка при создании задачи' });
    }
});
// Update task
exports.tasksRouter.put('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateTaskSchema.parse(req.body);
        const task = await prisma_js_1.default.task.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении задачи' });
    }
});
// Complete task
exports.tasksRouter.post('/:id/complete', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { result } = req.body;
        const task = await prisma_js_1.default.task.update({
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
        await prisma_js_1.default.activity.create({
            data: {
                type: 'task_completed',
                description: `Задача выполнена: ${task.title}${result ? `. Результат: ${result}` : ''}`,
                userId: req.user.id,
                leadId: task.leadId,
                dealId: task.dealId,
                metadata: { result },
            },
        });
        res.json(task);
    }
    catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ error: 'Ошибка при завершении задачи' });
    }
});
// Delete task
exports.tasksRouter.delete('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_js_1.default.task.delete({
            where: { id },
        });
        res.json({ message: 'Задача удалена' });
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Ошибка при удалении задачи' });
    }
});
// Get task stats
exports.tasksRouter.get('/stats/summary', auth_js_1.authenticate, async (req, res) => {
    try {
        const where = getTaskFilter(req);
        const now = new Date();
        const [total, pending, inProgress, done, overdue] = await Promise.all([
            prisma_js_1.default.task.count({ where }),
            prisma_js_1.default.task.count({ where: { ...where, status: 'pending' } }),
            prisma_js_1.default.task.count({ where: { ...where, status: 'in_progress' } }),
            prisma_js_1.default.task.count({ where: { ...where, status: 'done' } }),
            prisma_js_1.default.task.count({ where: { ...where, dueDate: { lt: now }, status: { not: 'done' } } }),
        ]);
        res.json({
            total,
            pending,
            inProgress,
            done,
            overdue,
        });
    }
    catch (error) {
        console.error('Get task stats error:', error);
        res.status(500).json({ error: 'Ошибка при получении статистики' });
    }
});
//# sourceMappingURL=tasks.js.map