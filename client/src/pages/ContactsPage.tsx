import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/api/axios';
import { Search, Plus, Phone, Mail, Building, User } from 'lucide-react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadContacts();
  }, [search]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      
      const res = await api.get('/contacts', { params });
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Контакты</h1>
          <p className="text-gray-500">База контактов</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Добавить контакт
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Загрузка...</div>
        ) : contacts.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">Нет контактов</div>
        ) : (
          contacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {contact.firstName} {contact.lastName}
                    </h3>
                    {contact.company && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Building className="w-3 h-3" /> {contact.company}
                      </p>
                    )}
                    {contact.position && (
                      <p className="text-sm text-gray-400">{contact.position}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {contact.phones?.map((phone: string, i: number) => (
                    <p key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-400" /> {phone}
                    </p>
                  ))}
                  {contact.emails?.map((email: string, i: number) => (
                    <p key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <Mail className="w-3 h-3 text-gray-400" /> {email}
                    </p>
                  ))}
                  {contact.telegram && (
                    <p className="text-sm text-gray-600">@{contact.telegram}</p>
                  )}
                </div>

                {contact.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {contact.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}