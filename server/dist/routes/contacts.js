"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.contactsRouter = (0, express_1.Router)();
const createContactSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().optional(),
    phones: zod_1.z.array(zod_1.z.string()).optional(),
    emails: zod_1.z.array(zod_1.z.string().email()).optional(),
    telegram: zod_1.z.string().optional(),
    instagram: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    position: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateContactSchema = createContactSchema.partial();
// Get all contacts
exports.contactsRouter.get('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const { search, page = '1', limit = '50' } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { phones: { hasSome: [search] } },
                { emails: { hasSome: [search] } },
            ];
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [contacts, total] = await Promise.all([
            prisma_js_1.default.contact.findMany({
                where,
                include: {
                    deals: {
                        select: { id: true, title: true, stage: true, status: true },
                    },
                    _count: {
                        select: { deals: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_js_1.default.contact.count({ where }),
        ]);
        res.json({
            contacts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Ошибка при получении контактов' });
    }
});
// Get contact by ID
exports.contactsRouter.get('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const contact = await prisma_js_1.default.contact.findUnique({
            where: { id },
            include: {
                deals: {
                    include: {
                        stage: true,
                        assignedTo: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                    },
                },
            },
        });
        if (!contact) {
            return res.status(404).json({ error: 'Контакт не найден' });
        }
        res.json(contact);
    }
    catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({ error: 'Ошибка при получении контакта' });
    }
});
// Create contact
exports.contactsRouter.post('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const data = createContactSchema.parse(req.body);
        const contact = await prisma_js_1.default.contact.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                phones: data.phones || [],
                emails: data.emails || [],
                telegram: data.telegram,
                instagram: data.instagram,
                company: data.company,
                position: data.position,
                notes: data.notes,
                tags: data.tags || [],
            },
        });
        res.status(201).json(contact);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Ошибка при создании контакта' });
    }
});
// Update contact
exports.contactsRouter.put('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateContactSchema.parse(req.body);
        const contact = await prisma_js_1.default.contact.update({
            where: { id },
            data: {
                ...data,
                phones: data.phones || [],
                emails: data.emails || [],
            },
        });
        res.json(contact);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Update contact error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении контакта' });
    }
});
// Delete contact
exports.contactsRouter.delete('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const contact = await prisma_js_1.default.contact.findUnique({
            where: { id },
            include: { deals: true },
        });
        if (!contact) {
            return res.status(404).json({ error: 'Контакт не найден' });
        }
        if (contact.deals.length > 0) {
            return res.status(400).json({ error: 'Нельзя удалить контакт со связанными сделками' });
        }
        await prisma_js_1.default.contact.delete({
            where: { id },
        });
        res.json({ message: 'Контакт удалён' });
    }
    catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ error: 'Ошибка при удалении контакта' });
    }
});
// Merge duplicate contacts
exports.contactsRouter.post('/merge', auth_js_1.authenticate, async (req, res) => {
    try {
        const { sourceId, targetId } = req.body;
        if (!sourceId || !targetId) {
            return res.status(400).json({ error: 'Требуются sourceId и targetId' });
        }
        if (sourceId === targetId) {
            return res.status(400).json({ error: 'ID должны быть разными' });
        }
        const source = await prisma_js_1.default.contact.findUnique({ where: { id: sourceId } });
        const target = await prisma_js_1.default.contact.findUnique({ where: { id: targetId } });
        if (!source || !target) {
            return res.status(404).json({ error: 'Контакты не найдены' });
        }
        // Merge data
        const mergedPhones = [...new Set([...source.phones, ...target.phones])];
        const mergedEmails = [...new Set([...source.emails, ...target.emails])];
        const mergedTags = [...new Set([...source.tags, ...target.tags])];
        // Update deals from source to target
        await prisma_js_1.default.deal.updateMany({
            where: { contactId: sourceId },
            data: { contactId: targetId },
        });
        // Update target contact
        const merged = await prisma_js_1.default.contact.update({
            where: { id: targetId },
            data: {
                phones: mergedPhones,
                emails: mergedEmails,
                tags: mergedTags,
                notes: target.notes && source.notes
                    ? `${target.notes}\n\n---\n\n${source.notes}`
                    : target.notes || source.notes,
            },
            include: {
                deals: true,
            },
        });
        // Delete source contact
        await prisma_js_1.default.contact.delete({
            where: { id: sourceId },
        });
        res.json(merged);
    }
    catch (error) {
        console.error('Merge contacts error:', error);
        res.status(500).json({ error: 'Ошибка при объединении контактов' });
    }
});
//# sourceMappingURL=contacts.js.map