# AI Courses CRM

Внутренняя CRM-система для команды продаж онлайн-курсов по искусственному интеллекту.

## Технологический стек

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- TanStack Query
- Zustand
- React Router v6
- @dnd-kit (drag-and-drop)
- Recharts

### Backend
- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL
- JWT авторизация

## Быстрый старт

### 1. Установка зависимостей

```bash
# Установка зависимостей сервера
cd server
npm install

# Установка зависимостей клиента
cd ../client
npm install
```

### 2. Запуск Docker (PostgreSQL)

```bash
cd ..
docker-compose up -d
```

### 3. Настройка базы данных

```bash
cd server

# Генерация Prisma клиента
npx prisma generate

# Применение миграций
npx prisma db push

# Заполнение тестовыми данными
npx tsx prisma/seed.ts
```

### 4. Запуск серверов

```bash
# Терминал 1: Запуск сервера
cd server
npm run dev

# Терминал 2: Запуск клиента
cd client
npm run dev
```

## Тестовые аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | admin@crm.local | password123 |
| Team Lead | teamlead@crm.local | password123 |
| Sales Manager | manager1@crm.local | password123 |
| Sales Manager | manager2@crm.local | password123 |
| Sales Manager | manager3@crm.local | password123 |

## Доступ

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Структура проекта

```
crm/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── api/            # API запросы
│   │   ├── components/     # UI компоненты
│   │   ├── hooks/          # React hooks
│   │   ├── pages/          # Страницы
│   │   ├── store/          # Zustand store
│   │   └── lib/            # Утилиты
│   └── package.json
│
├── server/                 # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── routes/         # API роуты
│   │   ├── middleware/     # Express middleware
│   │   └── lib/            # Утилиты
│   ├── prisma/
│   │   ├── schema.prisma   # Схема БД
│   │   └── seed.ts         # Тестовые данные
│   └── package.json
│
├── docker-compose.yml      # PostgreSQL + Redis
└── README.md
```

## Основные функции

- **Лиды** - управление потенциальными клиентами
- **Сделки** - канбан-доска с drag-and-drop
- **Задачи** - планирование и отслеживание задач
- **Контакты** - база контактов
- **Курсы** - каталог образовательных программ
- **Дашборд** - аналитика и статистика
- **Настройки** - управление пользователями и системой

## Роли пользователей

- `admin` - полный доступ
- `team_lead` - видит всю команду, назначает лиды
- `sales_manager` - видит только свои лиды и сделки