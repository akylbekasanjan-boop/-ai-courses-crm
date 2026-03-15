import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { Plus, BookOpen, Clock } from 'lucide-react';

const formatCurrency = (amount: number, currency = 'RUB') => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

const levelLabels: Record<string, string> = {
  beginner: 'Начинающий',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/courses');
      setCourses(res.data || []);
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 -mx-2 sm:mx-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 sm:px-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Курсы</h1>
          <p className="text-gray-500 text-sm">Каталог AI-курсов</p>
        </div>
        {isAdmin && (
          <Button className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Добавить курс
          </Button>
        )}
      </div>

      {/* Courses Grid - адаптивная сетка */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Загрузка...</div>
      ) : courses.length === 0 ? (
        <div className="p-8 text-center text-gray-500 px-2">
          Нет курсов. Добавьте первый курс!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 px-2 sm:px-0">
          {courses.map((course) => (
            <Card 
              key={course.id} 
              className={`hover:shadow-md transition-shadow ${!course.isActive ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <BookOpen className="w-4 sm:w-5 h-4 sm:h-5 text-indigo-600" />
                  </div>
                  {!course.isActive && (
                    <Badge variant="secondary" className="text-xs">Неактивен</Badge>
                  )}
                </div>
                <CardTitle className="text-base sm:text-lg mt-2 sm:mt-3">{course.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {course.description && (
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">
                    {course.description}
                  </p>
                )}

                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-500">Цена</span>
                    <span className="text-xl sm:text-2xl font-bold text-indigo-600">
                      {formatCurrency(course.price, course.currency)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                    {course.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span className="hidden sm:inline">{course.duration}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 sm:w-4 h-3 sm:h-4" />
                      <span className="hidden sm:inline">{course.format || 'Онлайн'}</span>
                    </span>
                  </div>

                  <Badge variant="outline" className="text-xs">
                    {levelLabels[course.level] || course.level}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}