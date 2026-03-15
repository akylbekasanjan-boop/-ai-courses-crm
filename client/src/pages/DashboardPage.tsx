import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import api from '@/api/axios';
import { Users, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Этапы
const STAGES = [
  { id: 'new', name: 'Заявка', color: '#3B82F6' },
  { id: 'in_progress', name: 'В обработке', color: '#8B5CF6' },
  { id: 'no_answer', name: 'НДЗ', color: '#F59E0B' },
  { id: 'thinking', name: 'Думает', color: '#EC4899' },
  { id: 'rejected', name: 'Отказ', color: '#EF4444' },
  { id: 'paid', name: 'Оплачено', color: '#10B981' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leadsRes, coursesRes] = await Promise.all([
        api.get('/leads'),
        api.get('/courses'),
      ]);
      
      const leads = leadsRes.data.leads || [];
      
      // Подсчёт по этапам
      const stageCounts: Record<string, number> = {};
      STAGES.forEach(s => stageCounts[s.id] = 0);
      leads.forEach((l: any) => {
        if (stageCounts[l.status] !== undefined) {
          stageCounts[l.status]++;
        }
      });
      
      setStats({
        total: leads.length,
        stageCounts,
        paid: stageCounts['paid'],
      });
      setCourses(coursesRes.data || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 -mx-2 sm:mx-0">
      {/* Welcome */}
      <div className="px-2 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Привет, {user?.firstName || 'Пользователь'}!
        </h1>
        <p className="text-gray-500 text-sm">Заявки на AI-курсы</p>
      </div>

      {/* Статистика по этапам - адаптивная сетка */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 px-2 sm:px-0">
        {STAGES.map((stage) => (
          <Card key={stage.id} className={stage.id === 'paid' ? 'border-green-500 border-2' : ''}>
            <CardContent className="p-2 sm:p-4 text-center">
              <div 
                className="w-2 h-2 rounded-full mx-auto mb-1 sm:mb-2" 
                style={{ backgroundColor: stage.color }}
              />
              <div className="text-lg sm:text-2xl font-bold">{stats?.stageCounts?.[stage.id] || 0}</div>
              <div className="text-xs text-gray-500 hidden sm:block">{stage.name}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Кнопки действий - адаптивные */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-0">
        <Button className="h-14 sm:h-16 text-base" asChild>
          <Link to="/leads">
            <Users className="w-5 h-5 mr-2" />
            <span>Заявки ({stats?.total || 0})</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-14 sm:h-16 text-base" asChild>
          <Link to="/courses">
            <BookOpen className="w-5 h-5 mr-2" />
            <span>Курсы ({courses.length})</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-14 sm:h-16 text-base" asChild>
          <Link to="/settings">
            <TrendingUp className="w-5 h-5 mr-2" />
            <span>Настройки</span>
          </Link>
        </Button>
      </div>

      {/* Популярные курсы */}
      <Card className="mx-2 sm:mx-0">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-lg">Курсы</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {courses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Нет курсов</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {courses.slice(0, 6).map((course: any) => (
                <div key={course.id} className="border rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold text-sm sm:text-base">{course.name}</h3>
                  <p className="text-lg sm:text-xl font-bold text-indigo-600 mt-1">
                    {formatCurrency(course.price)}
                  </p>
                  {course.duration && (
                    <p className="text-xs sm:text-sm text-gray-500">{course.duration}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}