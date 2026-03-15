import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/api/axios';
import { Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const typeLabels: Record<string, string> = {
  call: 'Звонок',
  meeting: 'Встреча',
  email: 'Письмо',
  follow_up: 'Follow up',
  other: 'Другое',
};

const priorityLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter) params.status = filter;
      
      const res = await api.get('/tasks', { params });
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (id: string) => {
    try {
      await api.post(`/tasks/${id}/complete`);
      loadTasks();
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          <p className="text-gray-500">Управление задачами</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Новая задача
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</p>
                <p className="text-sm text-gray-500">Ожидают</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in_progress').length}</p>
                <p className="text-sm text-gray-500">В работе</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'overdue').length}</p>
                <p className="text-sm text-gray-500">Просрочено</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'done').length}</p>
                <p className="text-sm text-gray-500">Выполнено</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <select
            className="border rounded-lg px-3 py-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
          </select>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Загрузка...</div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Нет задач</div>
          ) : (
            <div className="divide-y">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      task.status === 'done' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <CheckCircle className={`w-4 h-4 ${
                        task.status === 'done' ? 'text-green-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${
                          task.status === 'done' ? 'line-through text-gray-400' : ''
                        }`}>
                          {task.title}
                        </span>
                        <Badge className={priorityColors[task.priority] || 'bg-gray-100'}>
                          {priorityLabels[task.priority] || task.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{typeLabels[task.type] || task.type}</span>
                        <span>•</span>
                        <span>{new Date(task.dueDate).toLocaleDateString('ru')}</span>
                        {task.dueTime && <span>{task.dueTime}</span>}
                      </div>
                    </div>
                    {task.status !== 'done' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => completeTask(task.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Выполнить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}