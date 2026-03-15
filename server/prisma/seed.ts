import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create pipeline stages
  const stages = await Promise.all([
    prisma.pipelineStage.upsert({
      where: { id: 'stage-1' },
      update: {},
      create: { id: 'stage-1', name: 'Первый контакт', color: '#6366f1', order: 1 },
    }),
    prisma.pipelineStage.upsert({
      where: { id: 'stage-2' },
      update: {},
      create: { id: 'stage-2', name: 'Отправлено КП', color: '#8b5cf6', order: 2 },
    }),
    prisma.pipelineStage.upsert({
      where: { id: 'stage-3' },
      update: {},
      create: { id: 'stage-3', name: 'Презентация / Демо', color: '#ec4899', order: 3 },
    }),
    prisma.pipelineStage.upsert({
      where: { id: 'stage-4' },
      update: {},
      create: { id: 'stage-4', name: 'Переговоры', color: '#f59e0b', order: 4 },
    }),
    prisma.pipelineStage.upsert({
      where: { id: 'stage-5' },
      update: {},
      create: { id: 'stage-5', name: 'Выставлен счёт', color: '#10b981', order: 5 },
    }),
    prisma.pipelineStage.upsert({
      where: { id: 'stage-6' },
      update: {},
      create: { id: 'stage-6', name: 'Оплачено', color: '#22c55e', order: 6, isWon: true },
    }),
    prisma.pipelineStage.upsert({
      where: { id: 'stage-7' },
      update: {},
      create: { id: 'stage-7', name: 'Отказ', color: '#ef4444', order: 7, isLost: true },
    }),
  ]);

  console.log('✅ Pipeline stages created');

  // Create courses
  const courses = await Promise.all([
    prisma.course.upsert({
      where: { id: 'course-1' },
      update: {},
      create: {
        id: 'course-1',
        name: 'ChatGPT для бизнеса',
        description: 'Освойте ChatGPT для автоматизации бизнес-процессов',
        price: 29900,
        currency: 'RUB',
        duration: '8 недель',
        format: 'online',
        level: 'beginner',
        tags: ['chatgpt', 'ai', 'бизнес'],
      },
    }),
    prisma.course.upsert({
      where: { id: 'course-2' },
      update: {},
      create: {
        id: 'course-2',
        name: 'Midjourney для дизайнеров',
        description: 'Создание изображений с помощью ИИ',
        price: 24900,
        currency: 'RUB',
        duration: '6 недель',
        format: 'online',
        level: 'intermediate',
        tags: ['midjourney', 'дизайн', 'ai'],
      },
    }),
    prisma.course.upsert({
      where: { id: 'course-3' },
      update: {},
      create: {
        id: 'course-3',
        name: 'Python для ИИ',
        description: 'Программирование на Python для работы с искусственным интеллектом',
        price: 49900,
        currency: 'RUB',
        duration: '12 недель',
        format: 'online',
        level: 'beginner',
        tags: ['python', 'программирование', 'ai'],
      },
    }),
    prisma.course.upsert({
      where: { id: 'course-4' },
      update: {},
      create: {
        id: 'course-4',
        name: 'Нейросети для маркетинга',
        description: 'Использование нейросетей в маркетинговых кампаниях',
        price: 34900,
        currency: 'RUB',
        duration: '8 недель',
        format: 'hybrid',
        level: 'intermediate',
        tags: ['маркетинг', 'нейросети', 'ai'],
      },
    }),
    prisma.course.upsert({
      where: { id: 'course-5' },
      update: {},
      create: {
        id: 'course-5',
        name: 'AI Assistant Developer',
        description: 'Создание AI-ассистентов и ботов',
        price: 59900,
        currency: 'RUB',
        duration: '16 недель',
        format: 'online',
        level: 'advanced',
        tags: ['ai', 'разработка', 'боты'],
      },
    }),
    prisma.course.upsert({
      where: { id: 'course-6' },
      update: {},
      create: {
        id: 'course-6',
        name: 'Stable Diffusion Pro',
        description: 'Профессиональная работа со Stable Diffusion',
        price: 27900,
        currency: 'RUB',
        duration: '6 недель',
        format: 'online',
        level: 'intermediate',
        tags: ['stable-diffusion', 'дизайн', 'ai'],
      },
    }),
  ]);

  console.log('✅ Courses created');

  // Create users
  const passwordHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.local' },
    update: {},
    create: {
      email: 'admin@crm.local',
      passwordHash,
      firstName: 'Администратор',
      lastName: 'Системы',
      role: 'admin',
      phone: '+79000000000',
    },
  });

  const teamLead = await prisma.user.upsert({
    where: { email: 'teamlead@crm.local' },
    update: {},
    create: {
      email: 'teamlead@crm.local',
      passwordHash,
      firstName: 'Елена',
      lastName: 'Петрова',
      role: 'team_lead',
      phone: '+79000000001',
    },
  });

  const manager1 = await prisma.user.upsert({
    where: { email: 'manager1@crm.local' },
    update: {},
    create: {
      email: 'manager1@crm.local',
      passwordHash,
      firstName: 'Иван',
      lastName: 'Иванов',
      role: 'sales_manager',
      phone: '+79000000002',
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@crm.local' },
    update: {},
    create: {
      email: 'manager2@crm.local',
      passwordHash,
      firstName: 'Мария',
      lastName: 'Сидорова',
      role: 'sales_manager',
      phone: '+79000000003',
    },
  });

  const manager3 = await prisma.user.upsert({
    where: { email: 'manager3@crm.local' },
    update: {},
    create: {
      email: 'manager3@crm.local',
      passwordHash,
      firstName: 'Алексей',
      lastName: 'Смирнов',
      role: 'sales_manager',
      phone: '+79000000004',
    },
  });

  console.log('✅ Users created');

  // Create leads
  const leadsData = [
    { name: 'Дмитрий Кузнецов', phone: '+79011111111', email: 'dmitry@example.com', source: 'website' as const, status: 'new' as const },
    { name: 'Анна Смирнова', phone: '+79011111112', email: 'anna@example.com', source: 'instagram' as const, status: 'in_progress' as const },
    { name: 'Сергей Волков', phone: '+79011111113', email: 'sergey@example.com', source: 'telegram' as const, status: 'thinking' as const },
    { name: 'Екатерина Новикова', phone: '+79011111114', email: 'ekaterina@example.com', source: 'referral' as const, status: 'new' as const },
    { name: 'Андрей Морозов', phone: '+79011111115', email: 'andrey@example.com', source: 'youtube' as const, status: 'in_progress' as const },
    { name: 'Наталья Козлова', phone: '+79011111116', email: 'natalia@example.com', source: 'website' as const, status: 'paid' as const },
    { name: 'Павел Лебедев', phone: '+79011111117', email: 'pavel@example.com', source: 'cold_call' as const, status: 'new' as const },
    { name: 'Ольга Макарова', phone: '+79011111118', email: 'olga@example.com', source: 'instagram' as const, status: 'thinking' as const },
    { name: 'Михаил Фёдоров', phone: '+79011111119', email: 'mikhail@example.com', source: 'telegram' as const, status: 'in_progress' as const },
    { name: 'Татьяна Романова', phone: '+79011111120', email: 'tatiana@example.com', source: 'website' as const, status: 'rejected' as const },
  ];

  const managers = [manager1, manager2, manager3];

  for (let i = 0; i < leadsData.length; i++) {
    const leadData = leadsData[i];
    const assignedTo = managers[i % managers.length];
    
    const lead = await prisma.lead.upsert({
      where: { id: `lead-${i + 1}` },
      update: {},
      create: {
        id: `lead-${i + 1}`,
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email,
        source: leadData.source,
        status: leadData.status,
        assignedToId: assignedTo.id,
        courseInterests: {
          connect: [{ id: courses[i % courses.length].id }],
        },
        comment: `Интересуется курсом ${courses[i % courses.length].name}`,
        tags: ['первичный контакт'],
        convertedAt: leadData.status === 'converted' ? new Date() : null,
      },
    });

    // Create activity for lead
    await prisma.activity.create({
      data: {
        type: 'lead_assigned',
        description: `Лид создан и назначен на ${assignedTo.firstName} ${assignedTo.lastName}`,
        userId: admin.id,
        leadId: lead.id,
      },
    });
  }

  console.log('✅ Leads created');

  // Tasks - для менеджеров
  const tasksData = [
    { type: 'call' as const, title: 'Позвонить Дмитрию Кузнецову', priority: 'high' as const, dueDays: 0 },
    { type: 'meeting' as const, title: 'Встреча с Анной Смирновой', priority: 'high' as const, dueDays: 1 },
    { type: 'follow_up' as const, title: 'Follow up по коммерческому предложению', priority: 'medium' as const, dueDays: 2 },
    { type: 'email' as const, title: 'Отправить презентацию курса', priority: 'medium' as const, dueDays: 0 },
    { type: 'call' as const, title: 'Уточнить детали по заявке', priority: 'low' as const, dueDays: 3 },
    { type: 'meeting' as const, title: 'Демо для Сергея Волкова', priority: 'high' as const, dueDays: -1 }, // overdue
    { type: 'follow_up' as const, title: 'Повторный контакт', priority: 'medium' as const, dueDays: -2 }, // overdue
    { type: 'call' as const, title: 'Согласовать дату обучения', priority: 'medium' as const, dueDays: 5 },
    { type: 'email' as const, title: 'Подготовить договор', priority: 'high' as const, dueDays: 1 },
    { type: 'call' as const, title: 'Провести консультацию', priority: 'medium' as const, dueDays: 2 },
    { type: 'meeting' as const, title: 'Презентация для команды', priority: 'high' as const, dueDays: 4 },
    { type: 'follow_up' as const, title: 'Уточнить бюджет', priority: 'low' as const, dueDays: 7 },
    { type: 'email' as const, title: 'Отправить реквизиты', priority: 'medium' as const, dueDays: 0 },
    { type: 'call' as const, title: 'Подтвердить участие', priority: 'medium' as const, dueDays: 3 },
    { type: 'call' as const, title: 'Экстренный звонок клиенту', priority: 'high' as const, dueDays: -3 }, // overdue
  ];

  for (let i = 0; i < tasksData.length; i++) {
    const taskData = tasksData[i];
    const assignedTo = managers[i % managers.length];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + taskData.dueDays);
    dueDate.setHours(12, 0, 0, 0);

    await prisma.task.upsert({
      where: { id: `task-${i + 1}` },
      update: {},
      create: {
        id: `task-${i + 1}`,
        type: taskData.type,
        title: taskData.title,
        priority: taskData.priority,
        assignedToId: assignedTo.id,
        dueDate,
        status: taskData.dueDays < 0 ? 'overdue' : 'pending',
        description: `Задача для менеджера ${assignedTo.firstName}`,
      },
    });
  }

  console.log('✅ Tasks created');

  // Create contacts
  const contactsData = [
    { firstName: 'Дмитрий', lastName: 'Кузнецов', company: 'ООО Техно', position: 'Директор' },
    { firstName: 'Анна', lastName: 'Смирнова', company: 'Design Studio', position: 'Владелец' },
    { firstName: 'Сергей', lastName: 'Волков', company: 'Инновационные решения', position: 'CTO' },
    { firstName: 'Екатерина', lastName: 'Новикова', company: 'Маркетинг Агентство', position: 'Маркетолог' },
    { firstName: 'Андрей', lastName: 'Морозов', company: 'Стартап XYZ', position: 'CEO' },
  ];

  for (let i = 0; i < contactsData.length; i++) {
    const contactData = contactsData[i];
    
    await prisma.contact.upsert({
      where: { id: `contact-${i + 1}` },
      update: {},
      create: {
        id: `contact-${i + 1}`,
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        company: contactData.company,
        position: contactData.position,
        phones: [`+7901111111${i}`],
        emails: [`${contactData.firstName.toLowerCase()}.${contactData.lastName?.toLowerCase()}@example.com`],
        telegram: `@${contactData.firstName.toLowerCase()}_${contactData.lastName?.toLowerCase()}`,
      },
    });
  }

  console.log('✅ Contacts created');
  console.log('');
  console.log('🎉 Seed completed!');
  console.log('');
  console.log('Users for testing:');
  console.log('  Admin: admin@crm.local / password123');
  console.log('  Team Lead: teamlead@crm.local / password123');
  console.log('  Manager 1: manager1@crm.local / password123');
  console.log('  Manager 2: manager2@crm.local / password123');
  console.log('  Manager 3: manager3@crm.local / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });