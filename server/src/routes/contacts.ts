import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const contactsRouter = Router();

const createContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phones: z.array(z.string()).optional(),
  emails: z.array(z.string().email()).optional(),
  telegram: z.string().optional(),
  instagram: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateContactSchema = createContactSchema.partial();

// Get all contacts
contactsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
        { phones: { hasSome: [search as string] } },
        { emails: { hasSome: [search as string] } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
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
      prisma.contact.count({ where }),
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
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Ошибка при получении контактов' });
  }
});

// Get contact by ID
contactsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
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
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Ошибка при получении контакта' });
  }
});

// Create contact
contactsRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createContactSchema.parse(req.body);

    const contact = await prisma.contact.create({
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Ошибка при создании контакта' });
  }
});

// Update contact
contactsRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateContactSchema.parse(req.body);

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...data,
        phones: data.phones || [],
        emails: data.emails || [],
      },
    });

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении контакта' });
  }
});

// Delete contact
contactsRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: { deals: true },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Контакт не найден' });
    }

    if (contact.deals.length > 0) {
      return res.status(400).json({ error: 'Нельзя удалить контакт со связанными сделками' });
    }

    await prisma.contact.delete({
      where: { id },
    });

    res.json({ message: 'Контакт удалён' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Ошибка при удалении контакта' });
  }
});

// Merge duplicate contacts
contactsRouter.post('/merge', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sourceId, targetId } = req.body;

    if (!sourceId || !targetId) {
      return res.status(400).json({ error: 'Требуются sourceId и targetId' });
    }

    if (sourceId === targetId) {
      return res.status(400).json({ error: 'ID должны быть разными' });
    }

    const source = await prisma.contact.findUnique({ where: { id: sourceId } });
    const target = await prisma.contact.findUnique({ where: { id: targetId } });

    if (!source || !target) {
      return res.status(404).json({ error: 'Контакты не найдены' });
    }

    // Merge data
    const mergedPhones = [...new Set([...source.phones, ...target.phones])];
    const mergedEmails = [...new Set([...source.emails, ...target.emails])];
    const mergedTags = [...new Set([...source.tags, ...target.tags])];

    // Update deals from source to target
    await prisma.deal.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });

    // Update target contact
    const merged = await prisma.contact.update({
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
    await prisma.contact.delete({
      where: { id: sourceId },
    });

    res.json(merged);
  } catch (error) {
    console.error('Merge contacts error:', error);
    res.status(500).json({ error: 'Ошибка при объединении контактов' });
  }
});