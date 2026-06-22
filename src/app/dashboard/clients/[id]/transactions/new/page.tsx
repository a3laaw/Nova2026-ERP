'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, ArrowRight, Loader2, CheckCircle2, Workflow, Layers, Boxes } from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions'; // استيراد الصلاحيات
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { ActivityType, Service, SubService } from '@/types/reference';
import { Employee } from '@/types/hr';
import { TransactionService } from '@/services/transaction-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NewTransactionPage() {
  const clientId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir } = useLanguage();
  const { permissions } = usePermissions(); // جلب مصفوفة الصلاحيات
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    activityTypeId: '', serviceId: '', subServiceId: '', description: '', assignedEngineerId: '' 
  });

  const clientRef = useMemo(() => companyId && db ? doc(db, paths.clients(companyId), clientId) : null, [db, companyId, clientId]);
  const { data: client, loading: cLoading } = useDoc<Client>(clientRef);

  // جلب المراجع الفنية
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('name')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && form.activityTypeId ? query(collection(db, paths.services(companyId, form.activityTypeId)), orderBy('name')) : null, [db, companyId, form.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && form.activityTypeId && form.serviceId ? query(collection(db, paths.subServices(companyId, form.activityTypeId, form.serviceId)), orderBy('name')) : null, [db, companyId, form.activityTypeId, form.serviceId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const handleCreate = async () => {
    if (!db || !companyId || !user || !form.subServiceId || !form.assignedEngineerId) return;
    setLoading(true);
    try {
      const selectedAct = activities?.find(a => a.id === form.activityTypeId);
      const selectedSrv = services?.find(s => s.id === form.serviceId);
      const selectedSub = subServices?.find(ss => ss.id === form.subServiceId);
      const selectedEng = employees?.find(e => e.id === form.assignedEngineerId);

      // تمرير مصفوفة الصلاحيات للسيرفس لضمان نجاح التحقق الأمني الداخلي
      const service = new TransactionService(db, companyId, permissions);
      
      const transactionId = await service.createTransaction({
        clientId, 
        clientName: client?.nameAr || '',
        activityTypeId: form.activityTypeId, 
        activityTypeName: (isRtl ? selectedAct?.name : selectedAct?.nameEn) || '',
        serviceId: form.serviceId, 
        serviceName: (isRtl ? selectedSrv?.name : selectedSrv?.nameEn) || '',
        subServiceId: form.subServiceId, 
        subServiceName: (isRtl ? selectedSub?.name : selectedSub?.nameEn) || '',
        assignedEngineerId: form.assignedEngineerId, 
        assignedEngineerName: selectedEng?.fullName || '',
        description: form.description
      }, user.uid, user.displayName || 'User');

      toast({ 
        title: isRtl ? 'تم فتح المسار الفني بنجاح' : 'Technical Transaction Opened',
        description: isRtl ? 'جاري تحويلك لرادار المتابعة...' : 'Redirecting to tracking radar...'
      });
      
      // التوجه لصفحة المعاملة الجديدة
      router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}`);
    } catch (e: any) {
      console.error("Create Transaction Error:", e);
      toast({ 
        variant: "destructive", 
        title: isRtl ? "فشل فتح المعاملة" : "Transaction Failed",
        description: e.message || (isRtl ? "حدث خطأ غير متوقع." : "An unexpected error occurred.")
      });
    } finally {
      setLoading(false);
    }
  };

  if (cLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" onClick={() => router.back()} className="h-10 w-10 p-0 rounded-xl bg-white shadow-sm border border-slate-100">
          <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
           <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'فتح معاملة فنية جديدة' : 'New Technical Transaction'}</h1>
           <p className="text-muted-foreground text-[10px] font-bold opacity-70 italic">{client?.nameAr} | {client?.fileNumber}</p>
        </div>
      </div>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-primary/5 p-6 border-b flex items-center gap-3">
          <Workflow className="h-5 w-5 text-primary" />
          <h3 className="text-base font-black font-headline">{isRtl ? 'تحديد المسار الفني والمهندس' : 'Technical Path & Assignment'}</h3>
        </div>
        <CardContent className="p-8 space-y-8 text-start">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">نوع النشاط</Label>
                <Select value={form.activityTypeId} onValueChange={(v) => setForm({...form, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-2xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الخدمة الرئيسية</Label>
                <Select disabled={!form.activityTypeId} value={form.serviceId} onValueChange={(v) => setForm({...form, serviceId: v, subServiceId: ''})}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-2xl">{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المسار الفني (Pipeline)</Label>
                <Select disabled={!form.serviceId} value={form.subServiceId} onValueChange={(v) => setForm({...form, subServiceId: v})}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-2xl">{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold text-xs">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                </Select>
              </div>
           </div>

           <div className="space-y-2 pt-6 border-t border-slate-50">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المهندس المسؤول عن التنفيذ</Label>
              <Select value={form.assignedEngineerId} onValueChange={(v) => setForm({...form, assignedEngineerId: v})}>
                 <SelectTrigger className="h-14 rounded-2xl border-2 font-black bg-white text-sm shadow-inner">
                    <SelectValue placeholder={isRtl ? "تحديد المهندس المنفذ من القائمة..." : "Assign Field Engineer..."} />
                 </SelectTrigger>
                 <SelectContent className="rounded-2xl">{employees?.map(emp => (<SelectItem key={emp.id} value={emp.id!} className="font-bold text-xs">{emp.fullName}</SelectItem>))}</SelectContent>
              </Select>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">وصف المتطلبات (اختياري)</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-4 text-sm bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-4">
         <Button variant="outline" onClick={() => router.back()} className="h-14 rounded-2xl px-10 font-black border-2 text-sm bg-white hover:bg-slate-50">إلغاء</Button>
         <Button onClick={handleCreate} disabled={loading || !form.subServiceId || !form.assignedEngineerId} className="h-14 rounded-2xl px-16 bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-3 border-b-4 border-orange-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
           {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />} {isRtl ? 'فتح المسار الآن' : 'Confirm & Open'}
         </Button>
      </div>
    </div>
  );
}
