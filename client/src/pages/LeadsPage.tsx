import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/api/axios';
import { Search, Plus, Phone, Calendar, MessageSquare, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

// Этапы воронки заявок
const STAGES = [
  { id: 'new', name: 'Заявка', color: '#3B82F6' },
  { id: 'in_progress', name: 'В обработке', color: '#8B5CF6' },
  { id: 'no_answer', name: 'НДЗ', color: '#F59E0B' },
  { id: 'thinking', name: 'Думает', color: '#EC4899' },
  { id: 'rejected', name: 'Отказ', color: '#EF4444' },
  { id: 'paid', name: 'Оплачено', color: '#10B981' },
];

const sourceLabels: Record<string, string> = {
  website: 'Сайт',
  instagram: 'Instagram',
  telegram: 'Telegram',
  ads: 'Реклама',
  whatsapp: 'WhatsApp',
  other: 'Другое',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [comment, setComment] = useState('');
  
  // Для мобильной навигации по канбану
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  
  // Форма создания заявки
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'website',
    comment: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const res = await api.get('/leads');
      setLeads(res.data.leads || []);
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoading(false);
    }
  };

  // Перемещение заявки между этапами
  const moveLead = async (leadId: string, newStatus: string) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStatus });
      loadLeads();
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, status: newStatus });
      }
    } catch (err) {
      console.error('Error moving lead:', err);
      alert('Ошибка при перемещении заявки');
    }
  };

  // Сохранение комментария
  const saveComment = async () => {
    if (!selectedLead) return;
    try {
      await api.put(`/leads/${selectedLead.id}`, { comment });
      setSelectedLead({ ...selectedLead, comment });
      loadLeads();
    } catch (err) {
      console.error('Error saving comment:', err);
    }
  };

  // Удаление заявки
  const deleteLead = async (leadId: string) => {
    if (!confirm('Вы уверены, что хотите удалить заявку?')) return;
    try {
      await api.delete(`/leads/${leadId}`);
      loadLeads();
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
      alert('Ошибка при удалении заявки');
    }
  };

  // Создание новой заявки
  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Введите имя клиента');
      return;
    }
    
    setSaving(true);
    try {
      await api.post('/leads/public', { 
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        source: formData.source,
        comment: formData.comment.trim() || null,
      });
      
      setFormData({
        name: '',
        phone: '',
        email: '',
        source: 'website',
        comment: ''
      });
      setShowForm(false);
      loadLeads();
    } catch (err: any) {
      console.error('Error creating lead:', err);
      alert(err.response?.data?.error || 'Ошибка при создании заявки');
    } finally {
      setSaving(false);
    }
  };

  // Фильтрация по поиску
  const filteredLeads = leads.filter(lead => {
    if (!search) return true;
    const s = search.toLowerCase();
    return lead.name?.toLowerCase().includes(s) || 
           lead.phone?.includes(s) ||
           lead.email?.toLowerCase().includes(s);
  });

  // Группировка по этапам
  const getLeadsByStage = (stageId: string) => {
    return filteredLeads.filter(lead => lead.status === stageId);
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) {
      moveLead(leadId, stageId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Мобильная навигация
  const nextStage = () => {
    if (currentStageIndex < STAGES.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1);
    }
  };

  const prevStage = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1);
    }
  };

  // Текущий этап для мобильного вида
  const currentStage = STAGES[currentStageIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col -mx-4 px-0">
      {/* Header - адаптированный */}
      <div className="flex flex-col gap-3 mb-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Заявки</h1>
            <p className="text-gray-500 text-sm">Воронка продаж</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Создать заявку</span>
          </Button>
        </div>
        
        {/* Поиск - адаптивный */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
      </div>

      {/* Мобильная навигация по этапам */}
      <div className="flex items-center justify-between px-4 mb-3">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          onClick={prevStage}
          disabled={currentStageIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: currentStage.color }}
          />
          <span className="font-semibold text-sm">{currentStage.name}</span>
          <Badge variant="secondary" className="text-xs">
            {getLeadsByStage(currentStage.id).length}
          </Badge>
        </div>
        
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          onClick={nextStage}
          disabled={currentStageIndex === STAGES.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Канбан доска - адаптивная */}
      <div className="flex-1 overflow-hidden px-4">
        {/* Показываем только текущий этап на мобильном */}
        <div 
          className="flex flex-col h-full"
          onDrop={(e) => handleDrop(e, currentStage.id)}
          onDragOver={handleDragOver}
        >
          {/* Карточки заявок */}
          <div className="flex-1 bg-gray-100 rounded-lg p-2 space-y-2 overflow-y-auto min-h-[50vh]">
            {getLeadsByStage(currentStage.id).map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => handleDragStart(e, lead.id)}
                onClick={() => {
                  setSelectedLead(lead);
                  setComment(lead.comment || '');
                }}
                className="bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-sm">{lead.name}</span>
                </div>
                
                <div className="space-y-1 text-xs text-gray-500">
                  {lead.phone && (
                    <p className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                  )}
                  <p className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {sourceLabels[lead.source] || lead.source}
                  </p>
                  <p className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 
                    {new Date(lead.createdAt).toLocaleDateString('ru')}
                  </p>
                </div>
                
                {lead.comment && (
                  <p className="mt-2 text-xs text-gray-400 border-t pt-2 line-clamp-2">
                    {lead.comment}
                  </p>
                )}
              </div>
            ))}
            
            {getLeadsByStage(currentStage.id).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Нет заявок
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Индикаторы этапов - для мобильного */}
      <div className="flex justify-center gap-1 py-3 px-4 overflow-x-auto">
        {STAGES.map((stage, index) => (
          <button
            key={stage.id}
            onClick={() => setCurrentStageIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentStageIndex ? 'scale-125' : 'opacity-50'
            }`}
            style={{ backgroundColor: stage.color }}
          />
        ))}
      </div>

      {/* Форма создания заявки */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <Card className="w-full max-w-md mx-0 sm:mx-4 rounded-t-xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Создать заявку</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={createLead} className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-sm">Имя *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Иван Иванов"
                    required
                    className="text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Телефон</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+79000000000"
                    className="text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Источник</Label>
                  <select
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-base"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="website">Сайт</option>
                    <option value="instagram">Instagram</option>
                    <option value="telegram">Telegram</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="ads">Реклама</option>
                  </select>
                </div>
                
                <div>
                  <Label className="text-sm">Комментарий</Label>
                  <textarea
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-base"
                    rows={2}
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    placeholder="Комментарий..."
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? 'Создание...' : 'Создать'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Отмена
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Модальное окно редактирования - адаптировано */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-t-xl sm:rounded-xl max-h-[85vh] overflow-y-auto">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Заявка</h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLead(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">Имя</label>
                  <p className="font-medium">{selectedLead.name}</p>
                </div>
                
                {selectedLead.phone && (
                  <div>
                    <label className="text-xs text-gray-500">Телефон</label>
                    <p className="font-medium">{selectedLead.phone}</p>
                  </div>
                )}
                
                {selectedLead.email && (
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="font-medium">{selectedLead.email}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-xs text-gray-500">Источник</label>
                  <p className="font-medium">{sourceLabels[selectedLead.source] || selectedLead.source}</p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500">Статус</label>
                  <select
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-base"
                    value={selectedLead.status}
                    onChange={(e) => {
                      moveLead(selectedLead.id, e.target.value);
                    }}
                  >
                    {STAGES.map(stage => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500">Комментарий</label>
                  <textarea
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-base"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Добавить комментарий..."
                  />
                  <Button className="mt-2 w-full" onClick={saveComment}>
                    Сохранить комментарий
                  </Button>
                </div>
              </div>

              <Button 
                variant="destructive"
                onClick={() => deleteLead(selectedLead.id)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить заявку
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}