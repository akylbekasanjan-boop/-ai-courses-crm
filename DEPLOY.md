# AI Courses CRM - Инструкция по деплою

## Вариант 1: Vercel (Клиент) + Render (Сервер)

### Сервер на Render (бесплатно)

1. Зайди на https://render.com
2. Создай новый Web Service
3. Подключи GitHub репозиторий с папкой `/server`
4. Настройки:
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm run start`
   - Environment Variables:
     - `DATABASE_URL` - ссылка на PostgreSQL (можно создать бесплатную на https://neon.tech)
     - `JWT_SECRET` - любой рандомный ключ (минимум 32 символа)
     - `JWT_REFRESH_SECRET` - любой рандомный ключ

### Клиент на Vercel

1. Зайди на https://vercel.com
2. Import GitHub репозиторий с папкой `/client`
3. В настройках:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

## Вариант 2: Docker

```bash
cd /Users/bambook/crm
docker-compose up -d
```

## Подключение формы на сайт

Добавь на лендинг:

```html
<form id="leadForm">
  <input name="name" required placeholder="Ваше имя">
  <input name="phone" placeholder="Телефон">
  <button type="submit">Оставить заявку</button>
</form>

<script>
document.getElementById('leadForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  await fetch('https://твой-сервер.onrender.com/api/leads/public', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      name: form.get('name'),
      phone: form.get('phone'),
      source: 'website' // или ads, instagram, telegram
    })
  });
  alert('Спасибо! Мы свяжемся с вами!');
  e.target.reset();
};
</script>
```

## Текущий .env для сервера

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_courses_crm"
JWT_SECRET="dev-secret-key-change-in-production"
JWT_REFRESH_SECRET="dev-refresh-secret-key-change-in-production"
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```