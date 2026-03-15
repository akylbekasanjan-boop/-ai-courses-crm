import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { leadsRouter } from './routes/leads.js';
import { dealsRouter } from './routes/deals.js';
import { contactsRouter } from './routes/contacts.js';
import { tasksRouter } from './routes/tasks.js';
import { coursesRouter } from './routes/courses.js';
import { analyticsRouter } from './routes/analytics.js';
import { notificationsRouter } from './routes/notifications.js';
import { pipelineRouter } from './routes/pipeline.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Rate limiting for login only
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Слишком много попыток, попробуйте позже' }
});

// Routes
// Apply rate limiter only to login in auth routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/pipeline', pipelineRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;