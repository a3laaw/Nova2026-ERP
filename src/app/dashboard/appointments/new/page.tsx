'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  CalendarDays, Save, Loader2, 
  ArrowRight, UserCircle, Briefcase,
  MapPin, Clock, Sparkles
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { AppointmentService } from '@/services/appointment-service';
import { AppointmentType } from '@/types/appointment';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';

export default function NewAppointmentPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'client_meeting',
    clientId: '',
    projectId: '',
    engineerId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    location: '',
    notes: ''
  });

  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, [db, companyId]);
  const transQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactions(companyId)), orderBy('transactionNumber')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, [db, companyId]);

  const { data: clients } = useCollection<any>(clientsQuery);
  const { data: transactions } = useCollection<any>(transQuery);
  const { data: employees } = useCollection<any>(empsQuery);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !companyId || !user) return;
    
    setLoading(true);
    try {
      const service = new AppointmentService(db, companyId);
      const selectedClient = clients?.find(c => c.id === formData.clientId);
      const selectedProject = transactions?.find(p => p.id === formData.projectId);
      const selectedEmp = employees?.find(e => e.id === formData.engineerId);

      const start = new Date(`${formData.date}T${formData.time}:00`).toISOString();

      await service.createAppointment({
        ...formData,
        type: formData.type as AppointmentType,
        start,
        clientName: selectedClient?.nameAr || '',
        projectNumber: selectedProject?.transactionNumber || '',
        engineerName: selectedEmp?.fullName || '',
      }, user.uid);

      toast({ title: isRtl ? "تمت جدولة الموعد بنجاح" : "Appointment Scheduled" });
      router.push('/dashboard/appointments');
    } catch (error) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 animate-in slide-in-from-bottom-6 duration-700" dir={dir}>
      <div className="flex items-center gap-4 border-b pb-6">
        <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'جدولة موعد جديد' : 'Schedule New Appointment'}</h1>
           <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Consulting & Field Operations</p>
        </div>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <form onSubmit={handleSubmit}>
          <CardHeader className="bg-primary/5 p-8 border-b">
             <CardTitle className="text-xl font-black flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary" />
                {isRtl ? 'بيانات الموعد والارتباط' : 'Appointment & Linking Details'}
             </CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-8 text-start">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'عنوان الموعد' : 'Appointment Title'}</Label>
                <Input 
                  required 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50" 
                  placeholder={isRtl ? "مثلاً: معاينة موقع فيلا السالمية" : "e.g. Site Visit Villa Salmiya"}
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نوع الموعد' : 'Appointment Type'}</Label>
                   <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         <SelectItem value="client_meeting" className="font-bold">{isRtl ? 'اجتماع مع عميل' : 'Client Meeting'}</SelectItem>
                         <SelectItem value="site_visit" className="font-bold">{isRtl ? 'زيارة ميدانية (رفع عداد)' : 'Site Visit (Meter)'}</SelectItem>
                         <SelectItem value="other" className="font-bold">{isRtl ? 'أخرى' : 'Other'}</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المهندس المسؤول' : 'Assigned Engineer'}</Label>
                   <Select value={formData.engineerId} onValueChange={v => setFormData({...formData, engineerId: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {employees?.map(e => <SelectItem key={e.id} value={e.id!} className="font-bold">{e.fullName}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'العميل المالك' : 'Client Link'}</Label>
                   <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {clients?.map(c => <SelectItem key={c.id} value={c.id!} className="font-bold">{c.nameAr}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المشروع المرتبط' : 'Project Link'}</Label>
                   <Select value={formData.projectId} onValueChange={v => setFormData({...formData, projectId: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {transactions?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold">{p.subServiceName} - {p.transactionNumber}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ الموعد' : 'Date'}</Label>
                   <SmartDateInput value={formData.date} onChange={v => setFormData({...formData, date: v})} />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الوقت' : 'Time'}</Label>
                   <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="h-12 rounded-xl border-2 font-black text-lg" />
                </div>
             </div>

             <div className="space-y-2 pt-6 border-t">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات وتفاصيل إضافية' : 'Notes & Details'}</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="min-h-[120px] rounded-2xl border-2 p-6 text-sm bg-slate-50/30" placeholder="..." />
             </div>

             <Button 
               type="submit" 
               disabled={loading}
               className="w-full h-20 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700 mt-4"
             >
                {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Save className="h-8 w-8" />}
                {isRtl ? 'تثبيت وحفظ الموعد' : 'Confirm & Save Schedule'}
             </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
