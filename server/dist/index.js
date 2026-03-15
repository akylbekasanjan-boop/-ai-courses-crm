"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_js_1 = require("./routes/auth.js");
const users_js_1 = require("./routes/users.js");
const leads_js_1 = require("./routes/leads.js");
const deals_js_1 = require("./routes/deals.js");
const contacts_js_1 = require("./routes/contacts.js");
const tasks_js_1 = require("./routes/tasks.js");
const courses_js_1 = require("./routes/courses.js");
const analytics_js_1 = require("./routes/analytics.js");
const notifications_js_1 = require("./routes/notifications.js");
const pipeline_js_1 = require("./routes/pipeline.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Rate limiting for login only
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Слишком много попыток, попробуйте позже' }
});
// Routes
// Apply rate limiter only to login in auth routes
app.use('/api/auth', auth_js_1.authRouter);
app.use('/api/users', users_js_1.usersRouter);
app.use('/api/leads', leads_js_1.leadsRouter);
app.use('/api/deals', deals_js_1.dealsRouter);
app.use('/api/contacts', contacts_js_1.contactsRouter);
app.use('/api/tasks', tasks_js_1.tasksRouter);
app.use('/api/courses', courses_js_1.coursesRouter);
app.use('/api/analytics', analytics_js_1.analyticsRouter);
app.use('/api/notifications', notifications_js_1.notificationsRouter);
app.use('/api/pipeline', pipeline_js_1.pipelineRouter);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});
// Vercel serverless function export
// Export handler for Vercel
exports.default = app;
// Development server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
//# sourceMappingURL=index.js.map