import api from './axios';

export type DealStatus = 'active' | 'won' | 'lost';

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

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
}

export interface Deal {
  id: string;
  title: string;
  lead?: Lead;
  contact?: any;
  stage: PipelineStage;
  amount: number;
  currency: string;
  course?: Course;
  assignedTo: User;
  probability: number;
  expectedCloseDate?: string;
  status: DealStatus;
  lostReason?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface KanbanStage extends PipelineStage {
  deals: Deal[];
  totalAmount: number;
  dealsCount: number;
}

export interface DealsResponse {
  deals: Deal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateDealData {
  title: string;
  leadId?: string;
  contactId?: string;
  stageId: string;
  amount?: number;
  currency?: string;
  courseId?: string;
  assignedToId?: string;
  probability?: number;
  expectedCloseDate?: string;
  tags?: string[];
}

export const dealsApi = {
  getDeals: (params?: {
    stageId?: string;
    assignedToId?: string;
    courseId?: string;
    status?: DealStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<DealsResponse>('/deals', { params }),
  
  getKanban: () => api.get<KanbanStage[]>('/deals/kanban'),
  
  getDeal: (id: string) => api.get<Deal>(`/deals/${id}`),
  
  createDeal: (data: CreateDealData) => api.post<Deal>('/deals', data),
  
  updateDeal: (id: string, data: Partial<CreateDealData>) => api.put<Deal>(`/deals/${id}`, data),
  
  updateDealStage: (id: string, stageId: string, probability?: number) => 
    api.put<Deal>(`/deals/${id}/stage`, { stageId, probability }),
  
  winDeal: (id: string) => api.post<Deal>(`/deals/${id}/win`),
  
  loseDeal: (id: string, lostReason?: string) => 
    api.post<Deal>(`/deals/${id}/lose`, { lostReason }),
  
  deleteDeal: (id: string) => api.delete(`/deals/${id}`),
  
  getDealStats: () => api.get<{
    total: number;
    active: number;
    won: number;
    lost: number;
    totalAmount: number;
    wonAmount: number;
    winRate: number;
  }>('/deals/stats/summary'),
};