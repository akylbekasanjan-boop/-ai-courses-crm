"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.pipelineRouter = (0, express_1.Router)();
const createStageSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    color: zod_1.z.string().optional(),
    order: zod_1.z.number().optional(),
    isWon: zod_1.z.boolean().default(false),
    isLost: zod_1.z.boolean().default(false),
});
const updateStageSchema = createStageSchema.partial();
// Get all pipeline stages
exports.pipelineRouter.get('/stages', auth_js_1.authenticate, async (req, res) => {
    try {
        const stages = await prisma_js_1.default.pipelineStage.findMany({
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
    }
    catch (error) {
        console.error('Get stages error:', error);
        res.status(500).json({ error: 'Ошибка при получении этапов' });
    }
});
// Get single stage
exports.pipelineRouter.get('/stages/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const stage = await prisma_js_1.default.pipelineStage.findUnique({
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
    }
    catch (error) {
        console.error('Get stage error:', error);
        res.status(500).json({ error: 'Ошибка при получении этапа' });
    }
});
// Create stage (admin only)
exports.pipelineRouter.post('/stages', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const data = createStageSchema.parse(req.body);
        // Get max order if not provided
        let order = data.order;
        if (order === undefined) {
            const maxOrder = await prisma_js_1.default.pipelineStage.aggregate({
                _max: { order: true },
            });
            order = (maxOrder._max.order || 0) + 1;
        }
        const stage = await prisma_js_1.default.pipelineStage.create({
            data: {
                name: data.name,
                color: data.color || '#6366f1',
                order: order,
                isWon: data.isWon,
                isLost: data.isLost,
            },
        });
        res.status(201).json(stage);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Create stage error:', error);
        res.status(500).json({ error: 'Ошибка при создании этапа' });
    }
});
// Update stage (admin only)
exports.pipelineRouter.put('/stages/:id', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateStageSchema.parse(req.body);
        const stage = await prisma_js_1.default.pipelineStage.update({
            where: { id },
            data,
        });
        res.json(stage);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update stage error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении этапа' });
    }
});
// Reorder stages (admin only)
exports.pipelineRouter.put('/stages/reorder', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { stages } = req.body;
        if (!Array.isArray(stages)) {
            return res.status(400).json({ error: 'Требуется массив этапов' });
        }
        // Update order for each stage
        await Promise.all(stages.map((stage) => prisma_js_1.default.pipelineStage.update({
            where: { id: stage.id },
            data: { order: stage.order },
        })));
        const updatedStages = await prisma_js_1.default.pipelineStage.findMany({
            orderBy: { order: 'asc' },
        });
        res.json(updatedStages);
    }
    catch (error) {
        console.error('Reorder stages error:', error);
        res.status(500).json({ error: 'Ошибка при переупорядочивании этапов' });
    }
});
// Delete stage (admin only)
exports.pipelineRouter.delete('/stages/:id', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const stage = await prisma_js_1.default.pipelineStage.findUnique({
            where: { id },
            include: { _count: { select: { deals: true } } },
        });
        if (!stage) {
            return res.status(404).json({ error: 'Этап не найден' });
        }
        if (stage._count.deals > 0) {
            return res.status(400).json({ error: 'Нельзя удалить этап со сделками' });
        }
        await prisma_js_1.default.pipelineStage.delete({
            where: { id },
        });
        res.json({ message: 'Этап удалён' });
    }
    catch (error) {
        console.error('Delete stage error:', error);
        res.status(500).json({ error: 'Ошибка при удалении этапа' });
    }
});
// Get default stages (seed)
exports.pipelineRouter.post('/stages/default', auth_js_1.authenticate, (0, auth_js_1.authorize)('admin'), async (req, res) => {
    try {
        const existingStages = await prisma_js_1.default.pipelineStage.count();
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
        const stages = await Promise.all(defaultStages.map(stage => prisma_js_1.default.pipelineStage.create({ data: stage })));
        res.json(stages);
    }
    catch (error) {
        console.error('Create default stages error:', error);
        res.status(500).json({ error: 'Ошибка при создании этапов' });
    }
});
//# sourceMappingURL=pipeline.js.map