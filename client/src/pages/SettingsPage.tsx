import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usersApi } from '@/api/auth';
import api from '@/api/axios';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { Plus, Settings, Users, BookOpen, Edit2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Get users
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.getUsers();
      return res.data || [];
    },
    enabled: isAdmin,
  });
  const users = usersData || [];

  // Get pipeline stages
  const { data: stagesData } = useQuery({
    queryKey: ['pipeline', 'stages'],
    queryFn: async () => {
      const res = await api.get('/pipeline/stages');
      return res.data || [];
    },
    enabled: isAdmin,
  });
  const stages = stagesData || [];

  // Get courses
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const res = await api.get('/courses');
      return res.data || [];
    },
  });
  const courses = coursesData || [];

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Настройки</h1>
        <p className="text-gray-500">У вас нет доступа к настройкам системы</p>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    team_lead: 'Руководитель команды',
    sales_manager: 'Менеджер по продажам',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-gray-500">Управление системой</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Пользователи
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Воронка
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Курсы
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Пользователи системы</CardTitle>
                <CardDescription>Управление доступом пользователей</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(users as any[]).map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-indigo-100 text-indigo-600">
                          {getInitials(u.firstName, u.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                        {roleLabels[u.role]}
                      </Badge>
                      <Badge variant={u.isActive ? 'success' : 'destructive'}>
                        {u.isActive ? 'Активен' : 'Деактивирован'}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Этапы воронки</CardTitle>
                <CardDescription>Настройка этапов продаж</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Добавить этап
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(stages as any[]).map((stage: any, index: number) => (
                  <div key={stage.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-sm font-medium">
                      {index + 1}
                    </div>
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: stage.color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{stage.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage.isWon && <Badge>Выигрыш</Badge>}
                      {stage.isLost && <Badge variant="destructive">Проигрыш</Badge>}
                    </div>
                    <Button variant="ghost" size="icon">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Курсы</CardTitle>
                <CardDescription>Управление каталогом курсов</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Добавить курс
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(courses as any[]).map((course: any) => (
                  <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-gray-500">
                        {course.price} {course.currency} • {course.duration}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={course.isActive ? 'success' : 'secondary'}>
                        {course.isActive ? 'Активен' : 'Неактивен'}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}