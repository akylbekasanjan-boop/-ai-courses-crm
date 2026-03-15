import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setLoginError(err?.response?.data?.error || 'Ошибка входа');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2 sm:pb-4">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
            <span className="text-white font-bold text-xl">AI</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl">AI Courses CRM</CardTitle>
          <CardDescription className="text-sm">Войдите в систему</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-4">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {loginError && (
              <div className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {loginError}
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@mail.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base">
              Войти
            </Button>
          </form>
          
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-100 rounded-lg text-xs sm:text-sm">
            <p className="font-medium mb-1 sm:mb-2">Тестовые аккаунты:</p>
            <ul className="space-y-1 text-gray-600">
              <li>Admin: admin@crm.local</li>
              <li>Password: password123</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}