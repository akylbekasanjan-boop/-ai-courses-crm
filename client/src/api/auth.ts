import api from './axios';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  role: 'admin' | 'team_lead' | 'sales_manager';
  createdAt: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authApi = {
  login: (data: LoginData) => api.post<{ user: User }>('/auth/login', data),
  
  logout: () => api.post('/auth/logout'),
  
  refresh: () => api.post<{ user: User }>('/auth/refresh'),
  
  me: () => api.get<User>('/auth/me'),
};

export const usersApi = {
  getMe: () => api.get<User>('/users/me'),
  
  updateMe: (data: Partial<User>) => api.put<User>('/users/me', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) => 
    api.put('/users/me/password', data),
  
  getUsers: () => api.get<User[]>('/users'),
  
  getManagers: () => api.get<{ id: string; firstName: string; lastName: string; avatarUrl?: string; role: string }[]>('/users/managers'),
  
  createUser: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    role: string;
  }) => api.post('/users', data),
  
  updateUser: (id: string, data: Partial<User>) => api.put(`/users/${id}`, data),
  
  toggleUser: (id: string) => api.patch(`/users/${id}/toggle`),
};