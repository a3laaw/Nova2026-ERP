
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutGrid, Plus, Loader2, Trash2, Edit3, 
  Search, CheckCircle2, XCircle, Palette
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { ServiceTypeService } from '@/services/service-type-service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ServiceType } from '@/types/reference';

export default function ServiceTypesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [form, setForm] = useState<Partial<ServiceType>>({
    name: '', nameEn: '', description: '', moduleScope: 'technical', isActive: true, order: 0, color: '#f57c00'
  });

  const service = useMemo(() => db && companyId ? new ServiceTypeService(db, companyId) : null, [db, companyId]);
  const serviceQuery = useMemo(() => companyId && db ? query(collection(db, paths.serviceTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const { data: serviceTypes, loading } = useCollection<ServiceType>(serviceQuery);

  const handleSave = async () => {
    if (!service || !form.name || !form.nameEn) return;
    setLoadingAction('save');
    try {
      if (form.id) { await service.updateServiceType(form.id, form); }
      else { 
        const internalCode = (form.nameEn || 'ST').toUpperCase().replace(/\s+/g, '_');
        await service.addServiceType({ ...form, code: internalCode } as any); 
      }
      toast({ title: t('saved') });
      setForm({ name: '', nameEn: '', description: '', moduleScope: 'technical', isActive: true, order: 0, color: '#f57c00' });
      setIsDialogOpen(false);
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const filteredData = serviceTypes?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3">
          <LayoutGrid className="h-6 w-6 text-primary" />
          {isRtl ? 'أنشطة الأعمال' : 'Service Types'}
        </h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ name: '', nameEn: '', description: '', moduleScope: 'technical', isActive: true, order: (serviceTypes?.length || 0) + 1, color: '#f57c00' })} className="rounded-xl">
              <Plus className="me-2 h-4 w-4" /> {isRtl ? 'نشاط جديد' : 'New Activity'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-2xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-2xl">{form.id ? (isRtl ? 'تعديل نشاط' : 'Edit') : (isRtl ? 'إضافة نشاط' : 'Add')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} /></div>
              <div className="space-y-2"><Label>{isRtl ? 'اللون' : 'Color'}</Label><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-10 w-full p-1 cursor-pointer" /></div>
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="مثال: هندسة معمارية" /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="text-start" dir="ltr" placeholder="Example: Architectural Engineering" /></div>
              <div className="md:col-span-2 space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-full max-w-sm mb-6">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('search')} className="ps-10 rounded-xl h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map(item => (
            <Card key={item.id} className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden group hover:shadow-xl transition-all">
              <div className="h-2 w-full" style={{ backgroundColor: item.color || '#f57c00' }} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{item.nameEn}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => { setForm(item); setIsDialogOpen(true); }} className="h-8 w-8 text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if(confirm(t('confirmDelete'))) service?.deleteServiceType(item.id!); }} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1">{isRtl ? item.name : item.nameEn}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{item.description || '...'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
