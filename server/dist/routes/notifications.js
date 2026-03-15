"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.notificationsRouter = (0, express_1.Router)();
// Get all notifications for current user
exports.notificationsRouter.get('/', auth_js_1.authenticate, async (req, res) => {
    try {
        const { unreadOnly, page = '1', limit = '20' } = req.query;
        const where = {
            userId: req.user.id,
        };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [notifications, total, unreadCount] = await Promise.all([
            prisma_js_1.default.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_js_1.default.notification.count({ where }),
            prisma_js_1.default.notification.count({
                where: { userId: req.user.id, isRead: false },
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
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Ошибка при получении уведомлений' });
    }
});
// Get unread count
exports.notificationsRouter.get('/unread-count', auth_js_1.authenticate, async (req, res) => {
    try {
        const count = await prisma_js_1.default.notification.count({
            where: { userId: req.user.id, isRead: false },
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Ошибка при получении счётчика' });
    }
});
// Mark notification as read
exports.notificationsRouter.put('/:id/read', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma_js_1.default.notification.updateMany({
            where: { id, userId: req.user.id },
            data: { isRead: true },
        });
        if (notification.count === 0) {
            return res.status(404).json({ error: 'Уведомление не найдено' });
        }
        res.json({ message: 'Уведомление прочитано' });
    }
    catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении уведомления' });
    }
});
// Mark all as read
exports.notificationsRouter.put('/read-all', auth_js_1.authenticate, async (req, res) => {
    try {
        await prisma_js_1.default.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ message: 'Все уведомления прочитаны' });
    }
    catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Ошибка при обновлении уведомлений' });
    }
});
// Delete notification
exports.notificationsRouter.delete('/:id', auth_js_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_js_1.default.notification.deleteMany({
            where: { id, userId: req.user.id },
        });
        res.json({ message: 'Уведомление удалено' });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Ошибка при удалении уведомления' });
    }
});
// Delete all read notifications
exports.notificationsRouter.delete('/clear/read', auth_js_1.authenticate, async (req, res) => {
    try {
        await prisma_js_1.default.notification.deleteMany({
            where: { userId: req.user.id, isRead: true },
        });
        res.json({ message: 'Прочитанные уведомления удалены' });
    }
    catch (error) {
        console.error('Clear read error:', error);
        res.status(500).json({ error: 'Ошибка при очистке уведомлений' });
    }
});
//# sourceMappingURL=notifications.js.map