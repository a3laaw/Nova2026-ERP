'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, Plus, Loader2, Trash2, Edit3, 
  Search, CheckCircle2, XCircle, LayoutGrid, Palette
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  
  const [form, setForm] = useState<Partial<ServiceType>>({
    code: '', name: '', nameEn: '', description: '', moduleScope: 'technical', isActive: true, order: 0, color: '#f57c00'
  });

  const service = useMemo(() => db && companyId ? new ServiceTypeService(db, companyId) : null, [db, companyId]);

  const serviceQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.serviceTypes(companyId)), orderBy('order')) : null
  , [db, companyId]);

  const { data: serviceTypes, loading } = useCollection<ServiceType>(serviceQuery);

  const filteredData = serviceTypes?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSave = async () => {
    if (!service || !form.name || !form.code) return;
    setLoadingAction('save');
    try {
      if (form.id) {
        await service.updateServiceType(form.id, form);
      } else {
        await service.addServiceType(form as any);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setForm({ code: '', name: '', nameEn: '', description: '', moduleScope: 'technical', isActive: true, order: 0, color: '#f57c00' });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!service || !confirm(t('confirmDelete'))) return;
    try {
      await service.deleteServiceType(id);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-start">
        <div>
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <LayoutGrid className="h-10 w-10 text-primary" />
            {isRtl ? 'أنشطة الأعمال' : 'Service Types'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'تصنيف المسارات التشغيلية الكبرى للمنشأة' : 'Categorize major operational paths for the entity'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ code: '', name: '', nameEn: '', description: '', moduleScope: 'technical', isActive: true, order: (serviceTypes?.length || 0) + 1, color: '#f57c00' })} className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {isRtl ? 'إضافة نشاط' : 'New Activity'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-2xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{form.id ? (isRtl ? 'تعديل نشاط' : 'Edit Activity') : (isRtl ? 'إضافة نشاط جديد' : 'New Activity')}</DialogTitle>
              <DialogDescription className="text-start">{isRtl ? 'حدد خصائص النشاط الرئيسي الذي تندرج تحته المعاملات.' : 'Define characteristics of the main activity transactions fall under.'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2">
                <Label>{isRtl ? 'كود النشاط' : 'Activity Code'}</Label>
                <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="CONS" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                <Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (Ar)</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="استشارات هندسية" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (En)</Label>
                <Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} placeholder="Engineering Consulting" className="h-14 rounded-2xl border-2 text-start" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? 'النطاق' : 'Scope'}</Label>
                <Input value={form.moduleScope} onChange={e => setForm({...form, moduleScope: e.target.value})} placeholder="technical" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> {isRtl ? 'اللون التعريفي' : 'Color Key'}</Label>
                <Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-14 w-full p-1 rounded-2xl border-2 cursor-pointer" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>{isRtl ? 'الوصف' : 'Description'}</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="..." className="rounded-2xl border-2 min-h-[80px]" />
              </div>
              <div className="flex items-center gap-4">
                <Label>{t('active')}</Label>
                <Switch checked={form.isActive} onCheckedChange={val => setForm({...form, isActive: val})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={loadingAction === 'save' || !form.name} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">
                {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('search')} 
              className="ps-10 rounded-xl h-12 bg-white text-start" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto h-12 w-12 text-primary/30" /></div> : (
            filteredData.length === 0 ? <div className="py-20 text-center text-muted-foreground font-bold italic">{t('search')}</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map(item => (
                  <div key={item.id} className="group relative bg-white border-2 rounded-[2rem] p-6 hover:shadow-2xl hover:border-primary/30 transition-all text-start overflow-hidden">
                    <div 
                      className="absolute top-0 start-0 w-2 h-full" 
                      style={{ backgroundColor: item.color || '#f57c00' }}
                    />
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">{item.code}</Badge>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setForm(item)} className="h-8 w-8 text-blue-600 bg-blue-50 rounded-xl"><Edit3 className="h-4 w-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-2xl" dir={dir}>
                             <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'تعديل نشاط' : 'Edit Activity'}</DialogTitle></DialogHeader>
                             {/* Reusing form fields */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                                <div className="space-y-2"><Label>{isRtl ? 'كود النشاط' : 'Activity Code'}</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} className="h-14 rounded-2xl border-2" /></div>
                                <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 text-start" /></div>
                                <div className="space-y-2"><Label>{isRtl ? 'النطاق' : 'Scope'}</Label><Input value={form.moduleScope} onChange={e => setForm({...form, moduleScope: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                <div className="space-y-2"><Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> {isRtl ? 'اللون التعريفي' : 'Color Key'}</Label><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-14 w-full p-1 rounded-2xl border-2" /></div>
                                <div className="md:col-span-2 space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="rounded-2xl border-2 min-h-[80px]" /></div>
                                <div className="flex items-center gap-4"><Label>{t('active')}</Label><Switch checked={form.isActive} onCheckedChange={val => setForm({...form, isActive: val})} /></div>
                             </div>
                             <DialogFooter><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-14 rounded-2xl font-black bg-primary">{loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id!)} className="h-8 w-8 text-destructive bg-destructive/5 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-800 mb-1">{isRtl ? item.name : item.nameEn}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 h-8">{item.description || '...'}</p>
                    
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-mono text-[9px]">SCOPE: {item.moduleScope}</Badge>
                      {item.isActive ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
