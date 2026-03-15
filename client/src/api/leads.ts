import api from './axios';

export type LeadSource = 'website' | 'instagram' | 'telegram' | 'youtube' | 'referral' | 'cold_call' | 'other';
export type LeadStatus = 'new' | 'in_progress' | 'qualified' | 'converted' | 'rejected';

export interface Course {
  id: string;
  name: string;
  price: number;
}

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
  email?: string;
  source: LeadSource;
  status: LeadStatus;
  comment?: string;
  tags: string[];
  assignedTo: User;
  courseInterests: Course[];
  createdAt: string;
  updatedAt: string;
  convertedAt?: string;
}

export interface LeadsResponse {
  leads: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateLeadData {
  name: string;
  phone?: string;
  email?: string;
  source: LeadSource;
  status?: LeadStatus;
  comment?: string;
  tags?: string[];
  assignedToId?: string;
  courseInterests?: string[];
}

export const leadsApi = {
  getLeads: (params?: {
    status?: LeadStatus;
    source?: LeadSource;
    assignedToId?: string;
    courseId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<LeadsResponse>('/leads', { params }),
  
  getLead: (id: string) => api.get<Lead>(`/leads/${id}`),
  
  createLead: (data: CreateLeadData) => api.post<Lead>('/leads', data),
  
  updateLead: (id: string, data: Partial<CreateLeadData>) => api.put<Lead>(`/leads/${id}`, data),
  
  deleteLead: (id: string) => api.delete(`/leads/${id}`),
  
  convertLead: (id: string, data: {
    title?: string;
    stageId?: string;
    amount?: number;
    currency?: string;
    courseId?: string;
  }) => api.post(`/leads/${id}/convert`, data),
  
  assignLead: (id: string, assignedToId: string) => 
    api.post(`/leads/${id}/assign`, { assignedToId }),
  
  bulkAssign: (leadIds: string[], assignedToId: string) => 
    api.post('/leads/bulk/assign', { leadIds, assignedToId }),
  
  getLeadStats: () => api.get<{
    total: number;
    new: number;
    inProgress: number;
    qualified: number;
    converted: number;
    rejected: number;
  }>('/leads/stats/summary'),
};