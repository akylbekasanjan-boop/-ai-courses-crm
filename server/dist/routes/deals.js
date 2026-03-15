"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dealsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.dealsRouter = (0, express_1.Router)();
const createDealSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    leadId: zod_1.z.string().optional(),
    contactId: zod_1.z.string().optional(),
    stageId: zod_1.z.string(),
    amount: zod_1.z.number().min(0).default(0),
    currency: zod_1.z.string().default('RUB'),
    courseId: zod_1.z.string().optional(),
    assignedToId: zod_1.z.string().optional(),
    probability: zod_1.z.number().min(0).max(100).optional(),
    expectedCloseDate: zod_1.z.string().datetime().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateDealSchema = createDealSchema.partial();
// Helper to filter deals based on user role
function getDealFilter(req) {
    if (req.user.role === 'sales_manager') {
        return { assignedToId: req.user.id };
    }
    return {};
}
// Get all deals
exports.dealsRouter.get('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const { stageId, assignedToId, courseId, status, search, page = '1', limit = '50' } = req.query;
        const where = getDealFilter(req);
        if (stageId)
            where.stageId = stageId;
        if (assignedToId)
            where.assignedToId = assignedToId;
        if (courseId)
            where.courseId = courseId;
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { lead: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [deals, total] = await Promise.all([
            prisma_js_1.default.deal.findMany({
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
            prisma_js_1.default.deal.count({ where }),
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
    }
    catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ error: 'Ошибка при получении сделок' });
    }
});
// Get deals grouped by stage (for Kanban)
exports.dealsRouter.get('/kanban', auth_js_1.authenticate, async (req, res) => {
    try {
        const where = getDealFilter(req);
        const stages = await prisma_js_1.default.pipelineStage.findMany({
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
    }
    catch (error) {
        console.error('Get kanban error:', error);
        res.status(500).json({ error: 'Ошибка при получении канбана' });
    }
});
// Get deal by ID
exports.dealsRouter.get('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const deal = await prisma_js_1.default.deal.findUnique({
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
        if (req.user.role === 'sales_manager' && deal.assignedToId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        res.json(deal);
    }
    catch (error) {
        console.error('Get deal error:', error);
        res.status(500).json({ error: 'Ошибка при получении сделки' });
    }
});
// Create deal
exports.dealsRouter.post('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const data = createDealSchema.parse(req.body);
        const deal = await prisma_js_1.default.deal.create({
            data: {
                title: data.title,
                leadId: data.leadId,
                contactId: data.contactId,
                stageId: data.stageId,
                amount: data.amount,
                currency: data.currency,
                courseId: data.courseId,
                assignedToId: data.assignedToId || req.user.id,
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
        await prisma_js_1.default.activity.create({
            data: {
                type: 'stage_change',
                description: `Создана сделка: ${deal.title}`,
                userId: req.user.id,
                dealId: deal.id,
                leadId: deal.leadId,
            },
        });
        res.status(201).json(deal);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Create deal error:', error);
        res.status(500).json({ error: 'Ошибка при создании сделки' });
    }
});
// Update deal
exports.dealsRouter.put('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateDealSchema.parse(req.body);
        const existingDeal = await prisma_js_1.default.deal.findUnique({
            where: { id },
            include: { stage: true },
        });
        if (!existingDeal) {
            return res.status(404).json({ error: 'Сделка не найдена' });
        }
        // Check access
        if (req.user.role === 'sales_manager' && existingDeal.assignedToId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        // Track stage change
        if (data.stageId && data.stageId !== existingDeal.stageId) {
            const oldStage = await prisma_js_1.default.pipelineStage.findUnique({
                where: { id: existingDeal.stageId },
            });
            const newStage = await prisma_js_1.default.pipelineStage.findUnique({
                where: { id: data.stageId },
            });
            await prisma_js_1.default.activity.create({
                data: {
                    type: 'stage_change',
                    description: `Этап изменён: ${oldStage?.name} → ${newStage?.name}`,
                    userId: req.user.id,
                    dealId: id,
                    metadata: { oldStage: oldStage?.name, newStage: newStage?.name },
                },
            });
            // Check if moved to won/lost stage
            const targetStage = await prisma_js_1.default.pipelineStage.findUnique({
                where: { id: data.stageId },
            });
            if (targetStage?.isWon) {
                await prisma_js_1.default.deal.update({
                    where: { id },
                    data: { status: 'won', closedAt: new Date() },
                });
            }
            else if (targetStage?.isLost) {
                await prisma_js_1.default.deal.update({
                    where: { id },
                    data: { status: 'lost', closedAt: new Date() },
                });
            }
        }
        const deal = await prisma_js_1.default.deal.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update deal error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении сделки' });
    }
});
// Update deal stage (for drag and drop)
exports.dealsRouter.put('/:id/stage', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { stageId, probability } = req.body;
        const existingDeal = await prisma_js_1.default.deal.findUnique({
            where: { id },
            include: { stage: true },
        });
        if (!existingDeal) {
            return res.status(404).json({ error: 'Сделка не найдена' });
        }
        // Check access
        if (req.user.role === 'sales_manager' && existingDeal.assignedToId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        const oldStage = await prisma_js_1.default.pipelineStage.findUnique({
            where: { id: existingDeal.stageId },
        });
        const newStage = await prisma_js_1.default.pipelineStage.findUnique({
            where: { id: stageId },
        });
        const updateData = { stageId };
        if (probability !== undefined)
            updateData.probability = probability;
        // Check if moved to won/lost stage
        if (newStage?.isWon) {
            updateData.status = 'won';
            updateData.closedAt = new Date();
        }
        else if (newStage?.isLost) {
            updateData.status = 'lost';
            updateData.closedAt = new Date();
        }
        const deal = await prisma_js_1.default.deal.update({
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
            await prisma_js_1.default.activity.create({
                data: {
                    type: 'stage_change',
                    description: `Этап изменён: ${oldStage?.name} → ${newStage?.name}`,
                    userId: req.user.id,
                    dealId: id,
                    metadata: { oldStage: oldStage?.name, newStage: newStage?.name },
                },
            });
            // Create notification
            await prisma_js_1.default.notification.create({
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
    }
    catch (error) {
        console.error('Update deal stage error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении этапа' });
    }
});
// Mark deal as won
exports.dealsRouter.post('/:id/win', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const existingDeal = await prisma_js_1.default.deal.findUnique({
            where: { id },
        });
        if (!existingDeal) {
            return res.status(404).json({ error: 'Сделка не найдена' });
        }
        // Check access
        if (req.user.role === 'sales_manager' && existingDeal.assignedToId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        const deal = await prisma_js_1.default.deal.update({
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
        await prisma_js_1.default.activity.create({
            data: {
                type: 'stage_change',
                description: `Сделка выиграна!`,
                userId: req.user.id,
                dealId: id,
            },
        });
        res.json(deal);
    }
    catch (error) {
        console.error('Win deal error:', error);
        res.status(500).json({ error: 'Ошибка при закрытии сделки' });
    }
});
// Mark deal as lost
exports.dealsRouter.post('/:id/lose', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { lostReason } = req.body;
        const existingDeal = await prisma_js_1.default.deal.findUnique({
            where: { id },
        });
        if (!existingDeal) {
            return res.status(404).json({ error: 'Сделка не найдена' });
        }
        // Check access
        if (req.user.role === 'sales_manager' && existingDeal.assignedToId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        const deal = await prisma_js_1.default.deal.update({
            where: { id },
            data: { status: 'lost', closedAt: new Date(), lostReason },
            include: {
                stage: true,
                assignedTo: {
                    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
                },
            },
        });
        await prisma_js_1.default.activity.create({
            data: {
                type: 'stage_change',
                description: `Сделка проиграна. Причина: ${lostReason || 'не указана'}`,
                userId: req.user.id,
                dealId: id,
                metadata: { lostReason },
            },
        });
        res.json(deal);
    }
    catch (error) {
        console.error('Lose deal error:', error);
        res.status(500).json({ error: 'Ошибка при закрытии сделки' });
    }
});
// Delete deal
exports.dealsRouter.delete('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const existingDeal = await prisma_js_1.default.deal.findUnique({
            where: { id },
        });
        if (!existingDeal) {
            return res.status(404).json({ error: 'Сделка не найдена' });
        }
        // Check access
        if (req.user.role === 'sales_manager' && existingDeal.assignedToId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        await prisma_js_1.default.deal.delete({
            where: { id },
        });
        res.json({ message: 'Сделка удалена' });
    }
    catch (error) {
        console.error('Delete deal error:', error);
        res.status(500).json({ error: 'Ошибка при удалении сделки' });
    }
});
// Get deal stats
exports.dealsRouter.get('/stats/summary', auth_js_1.authenticate, async (req, res) => {
    try {
        const where = getDealFilter(req);
        const [total, activeCount, wonCount, lostCount, totalAmount, wonAmount] = await Promise.all([
            prisma_js_1.default.deal.count({ where }),
            prisma_js_1.default.deal.count({ where: { ...where, status: 'active' } }),
            prisma_js_1.default.deal.count({ where: { ...where, status: 'won' } }),
            prisma_js_1.default.deal.count({ where: { ...where, status: 'lost' } }),
            prisma_js_1.default.deal.aggregate({ where, _sum: { amount: true } }),
            prisma_js_1.default.deal.aggregate({ where: { ...where, status: 'won' }, _sum: { amount: true } }),
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
    }
    catch (error) {
        console.error('Get deal stats error:', error);
        res.status(500).json({ error: 'Ошибка при получении статистики' });
    }
});
//# sourceMappingURL=deals.js.map