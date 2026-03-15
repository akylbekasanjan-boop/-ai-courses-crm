"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACCESS_TOKEN_EXPIRY = '15m';
function generateTokens(userId, email, role) {
    const accessToken = jsonwebtoken_1.default.sign({ userId, email, role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, email, role, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
}
exports.authRouter.post('/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = await prisma_js_1.default.user.findUnique({
            where: { email: data.email },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        const isValidPassword = await bcrypt_1.default.compare(data.password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
        // Save refresh token to DB
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
        await prisma_js_1.default.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt,
            },
        });
        // Set cookies
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: REFRESH_TOKEN_EXPIRY,
        });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Login error:', error);
        res.status(500).json({ error: 'Ошибка при входе' });
    }
});
exports.authRouter.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh токен не найден' });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const storedToken = await prisma_js_1.default.refreshToken.findUnique({
            where: { token: refreshToken },
        });
        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Недействительный refresh токен' });
        }
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        // Delete old refresh token
        await prisma_js_1.default.refreshToken.delete({ where: { id: storedToken.id } });
        // Generate new tokens
        const tokens = generateTokens(user.id, user.email, user.role);
        // Save new refresh token
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
        await prisma_js_1.default.refreshToken.create({
            data: {
                userId: user.id,
                token: tokens.refreshToken,
                expiresAt,
            },
        });
        // Set cookies
        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: REFRESH_TOKEN_EXPIRY,
        });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        });
    }
    catch (error) {
        console.error('Refresh error:', error);
        res.status(401).json({ error: 'Недействительный refresh токен' });
    }
});
exports.authRouter.post('/logout', auth_js_1.authenticate, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            await prisma_js_1.default.refreshToken.deleteMany({
                where: { token: refreshToken },
            });
        }
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.json({ message: 'Выход выполнен' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Ошибка при выходе' });
    }
});
exports.authRouter.get('/me', auth_js_1.authenticate, async (req, res) => {
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
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Ошибка при получении данных пользователя' });
    }
});
//# sourceMappingURL=auth.js.map