"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_js_1 = __importDefault(require("../lib/prisma.js"));
const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Необходима авторизация' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                firstName: true,
                lastName: true,
                isActive: true
            }
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Необходима авторизация' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.js.map