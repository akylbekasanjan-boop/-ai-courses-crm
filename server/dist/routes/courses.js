"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.coursesRouter = (0, express_1.Router)();
const createCourseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().min(0),
    currency: zod_1.z.string().default('RUB'),
    duration: zod_1.z.string().optional(),
    format: zod_1.z.string().default('online'),
    level: zod_1.z.string().default('beginner'),
    isActive: zod_1.z.boolean().default(true),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateCourseSchema = createCourseSchema.partial();
// Get all courses
exports.coursesRouter.get('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const { isActive, search } = req.query;
        const where = {};
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const courses = await prisma_js_1.default.course.findMany({
            where,
            include: {
                _count: {
                    select: { deals: true, leads: true },
                },
            },
            orderBy: { name: 'asc' },
        });
        res.json(courses);
    }
    catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Ошибка при получении курсов' });
    }
});
// Get course by ID
exports.coursesRouter.get('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const course = await prisma_js_1.default.course.findUnique({
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
    }
    catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ error: 'Ошибка при получении курса' });
    }
});
// Create course (admin only)
exports.coursesRouter.post('/', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const data = createCourseSchema.parse(req.body);
        const course = await prisma_js_1.default.course.create({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Create course error:', error);
        res.status(500).json({ error: 'Ошибка при создании курса' });
    }
});
// Update course (admin only)
exports.coursesRouter.put('/:id', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateCourseSchema.parse(req.body);
        const course = await prisma_js_1.default.course.update({
            where: { id },
            data,
        });
        res.json(course);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update course error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении курса' });
    }
});
// Delete course (admin only)
exports.coursesRouter.delete('/:id', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const course = await prisma_js_1.default.course.findUnique({
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
            await prisma_js_1.default.course.update({
                where: { id },
                data: { isActive: false },
            });
            return res.json({ message: 'Курс деактивирован (есть связанные сделки/лиды)' });
        }
        await prisma_js_1.default.course.delete({
            where: { id },
        });
        res.json({ message: 'Курс удалён' });
    }
    catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ error: 'Ошибка при удалении курса' });
    }
});
// Get course stats
exports.coursesRouter.get('/stats/popular', auth_js_1.authenticate, async (req, res) => {
    try {
        const courses = await prisma_js_1.default.course.findMany({
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
    }
    catch (error) {
        console.error('Get popular courses error:', error);
        res.status(500).json({ error: 'Ошибка при получении статистики курсов' });
    }
});
//# sourceMappingURL=courses.js.map