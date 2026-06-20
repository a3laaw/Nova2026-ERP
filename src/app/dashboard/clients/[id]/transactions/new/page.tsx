
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Activity, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  Workflow, 
  Layers, 
  Boxes,
  HardHat,
  ShieldCheck,
  FileText
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { ActivityType, Service, SubService } from '@/types/reference';
import { TransactionService } from '@/services/transaction-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NewTransactionPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    activityTypeId: '',
    serviceId: '',
    subServiceId: '',
    description: '',
    assignedEngineerId: ''
  });

  // 1. جلب بيانات العميل
  const clientRef = useMemo(() => 
    companyId && db ? doc(db, paths.clients(companyId), clientId) : null, 
  [db, companyId, clientId]);
  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);

  // 2. جلب الأنشطة (Activity Types)
  const actQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  const { data: activities } = useCollection<ActivityType>(actQuery);

  // 3. جلب الخدمات (Services) بناءً على النشاط المختار
  const srvQuery = useMemo(() => 
    companyId && db && form.activityTypeId ? query(collection(db, paths.services(companyId, form.activityTypeId)), orderBy('name')) : null, 
  [db, companyId, form.activityTypeId]);
  const { data: services } = useCollection<Service>(srvQuery);

  // 4. جلب الخدمات الفرعية (Sub-Services) بناءً على الخدمة المختارة
  const subQuery = useMemo(() => 
    companyId && db && form.activityTypeId && form.serviceId ? query(collection(db, paths.subServices(companyId, form.activityTypeId, form.serviceId)), orderBy('name')) : null, 
  [db, companyId, form.activityTypeId, form.serviceId]);
  const { data: subServices } = useCollection<SubService>(subQuery);

  // تحديث تلقائي للمهندس عند تحميل بيانات العميل
  useEffect(() => {
    if (client?.assignedEngineerId) {
      setForm(prev => ({ ...prev, assignedEngineerId: client.assignedEngineerId! }));
    }
  }, [client]);

  const handleCreate = async () => {
    if (!db || !companyId || !user || !form.subServiceId) return;
    
    setLoading(true);
    try {
      const selectedAct = activities?.find(a => a.id === form.activityTypeId);
      const selectedSrv = services?.find(s => s.id === form.serviceId);
      const selectedSub = subServices?.find(ss => ss.id === form.subServiceId);

      const service = new TransactionService(db, companyId);
      const tId = await service.createTransaction({
        clientId,
        clientName: client?.nameAr,
        activityTypeId: form.activityTypeId,
        activityTypeName: isRtl ? selectedAct?.name : selectedAct?.nameEn,
        serviceId: form.serviceId,
        serviceName: isRtl ? selectedSrv?.name : selectedSrv?.nameEn,
        subServiceId: form.subServiceId,
        subServiceName: isRtl ? selectedSub?.name : selectedSub?.nameEn,
        assignedEngineerId: form.assignedEngineerId,
        assignedEngineerName: client?.assignedEngineerName,
        description: form.description
      }, user.uid, user.displayName || 'System');

      toast({ title: isRtl ? 'تم فتح المعاملة' : 'Transaction Opened' });
      router.push(`/dashboard/clients/${clientId}`);
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoading(false);
    }
  };

  if (clientLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-4xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      {/* Header */}
      <div className="flex items-center gap-6 border-b pb-8 border-slate-100">
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/dashboard/clients/${clientId}`)} 
          className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all"
        >
          <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
           <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">
              {isRtl ? 'فتح معاملة فنية جديدة' : 'Open New Technical Transaction'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? `للعميل: ${client?.nameAr} | ملف: ${client?.fileNumber}` : `Client: ${client?.nameAr} | File: ${client?.fileNumber}`}
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Step 1: Technical Path Selection */}
        <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
           <div className="bg-primary/5 p-8 border-b flex items-center justify-between">
              <div className="text-start">
                 <h3 className="text-xl font-black font-headline flex items-center gap-3">
                    <Workflow className="h-6 w-6 text-primary" />
                    {isRtl ? 'تحديد المسار الفني والعملي' : 'Define Technical Path'}
                 </h3>
                 <p className="text-xs font-bold text-muted-foreground mt-1">
                    {isRtl ? 'سيقوم النظام باستنساخ مراحل العمل المعتمدة آلياً لهذا المسار.' : 'The system will auto-clone work stages for this path.'}
                 </p>
              </div>
           </div>
           <CardContent className="p-10 space-y-10 text-start">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Activity className="h-3 w-3" /> {isRtl ? 'نوع النشاط' : 'Activity Type'}
                    </Label>
                    <Select value={form.activityTypeId} onValueChange={(v) => setForm({...form, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                          <SelectValue placeholder="..." />
                       </SelectTrigger>
                       <SelectContent>
                          {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Boxes className="h-3 w-3" /> {isRtl ? 'الخدمة الرئيسية' : 'Primary Service'}
                    </Label>
                    <Select 
                      value={form.serviceId} 
                      onValueChange={(v) => setForm({...form, serviceId: v, subServiceId: ''})}
                      disabled={!form.activityTypeId}
                    >
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                          <SelectValue placeholder="..." />
                       </SelectTrigger>
                       <SelectContent>
                          {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Layers className="h-3 w-3" /> {isRtl ? 'المسار الفني الفرعي' : 'Specific Sub-Service'}
                    </Label>
                    <Select 
                      value={form.subServiceId} 
                      onValueChange={(v) => setForm({...form, subServiceId: v})}
                      disabled={!form.serviceId}
                    >
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                          <SelectValue placeholder="..." />
                       </SelectTrigger>
                       <SelectContent>
                          {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="pt-8 border-t border-slate-50 space-y-4">
                 <div className="flex items-center gap-3 text-slate-800">
                    <HardHat className="h-5 w-5 text-primary" />
                    <h4 className="font-black text-lg">{isRtl ? 'إعدادات التشغيل' : 'Operational Settings'}</h4>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المهندس المسؤول (تلقائي)' : 'Assigned Engineer'}</Label>
                       <div className="h-14 rounded-2xl border-2 flex items-center px-4 bg-slate-50 text-slate-600 font-bold gap-3">
                          <ShieldCheck className="h-5 w-5 text-emerald-500" />
                          {client?.assignedEngineerName || (isRtl ? 'لم يتم تعيين مهندس للعميل' : 'No engineer assigned to client')}
                       </div>
                    </div>
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'حالة المعاملة عند الافتتاح' : 'Opening Status'}</Label>
                       <div className="h-14 rounded-2xl border-2 flex items-center px-4 bg-slate-50 text-slate-600 font-black uppercase">
                          NEW / {isRtl ? 'جديدة' : 'NEW'}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-3 pt-4">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-3 w-3" /> {isRtl ? 'وصف مختصر أو متطلبات خاصة' : 'Brief Description / Special Req'}
                 </Label>
                 <Textarea 
                   value={form.description}
                   onChange={e => setForm({...form, description: e.target.value})}
                   className="min-h-[120px] rounded-[2rem] border-2 p-6 text-lg focus:bg-slate-50 transition-all resize-none shadow-inner border-slate-100 focus:border-primary/30" 
                   placeholder="..."
                 />
              </div>
           </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end gap-6">
           <Button 
             variant="outline" 
             onClick={() => router.push(`/dashboard/clients/${clientId}`)}
             className="h-20 rounded-[2.5rem] px-12 border-2 font-black text-xl hover:bg-white transition-all bg-white text-slate-600 shadow-sm"
           >
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button 
             onClick={handleCreate}
             disabled={loading || !form.subServiceId}
             className="h-20 rounded-[2.5rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
           >
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <CheckCircle2 className="h-8 w-8" />}
              {isRtl ? 'فتح المعاملة الآن' : 'Confirm & Open Path'}
           </Button>
        </div>

        {/* Safety Note */}
        <div className="p-8 rounded-[2.5rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4">
           <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm border shrink-0">
              <ShieldCheck className="h-5 w-5" />
           </div>
           <div className="text-start">
              <h5 className="font-black text-amber-800 text-sm">{isRtl ? 'ملاحظة تشغيلية' : 'Operational Note'}</h5>
              <p className="text-[10px] text-amber-700/70 font-bold leading-relaxed mt-1">
                 {isRtl ? 'عند تأكيد فتح المعاملة، سيقوم النظام آلياً بإنشاء "خطة زمنية" تعتمد على المراحل الفنية المحددة مسبقاً في مركز المراجع لهذا المسار الفرعي.' : 'Upon confirmation, the system will automatically generate a timeline based on predefined technical stages in the Reference Hub.'}
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
