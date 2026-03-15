import api from './axios';

export type TaskType = 'call' | 'meeting' | 'email' | 'follow_up' | 'other';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type Priority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone?: string;
}

export interface Deal {
  id: string;
  title: string;
  stage: { id: string; name: string };
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  assignedTo: User;
  lead?: Lead;
  deal?: Deal;
  dueDate: string;
  dueTime?: string;
  status: TaskStatus;
  priority: Priority;
  result?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TasksResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateTaskData {
  type: TaskType;
  title: string;
  description?: string;
  assignedToId?: string;
  leadId?: string;
  dealId?: string;
  dueDate: string;
  dueTime?: string;
  priority?: Priority;
}

export const tasksApi = {
  getTasks: (params?: {
    status?: TaskStatus;
    type?: TaskType;
    assignedToId?: string;
    leadId?: string;
    dealId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => api.get<TasksResponse>('/tasks', { params }),
  
  getTodayTasks: () => api.get<Task[]>('/tasks/today'),
  
  getOverdueTasks: () => api.get<Task[]>('/tasks/overdue'),
  
  getTask: (id: string) => api.get<Task>(`/tasks/${id}`),
  
  createTask: (data: CreateTaskData) => api.post<Task>('/tasks', data),
  
  updateTask: (id: string, data: Partial<CreateTaskData>) => api.put<Task>(`/tasks/${id}`, data),
  
  completeTask: (id: string, result?: string) => 
    api.post<Task>(`/tasks/${id}/complete`, { result }),
  
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),
  
  getTaskStats: () => api.get<{
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    overdue: number;
  }>('/tasks/stats/summary'),
};