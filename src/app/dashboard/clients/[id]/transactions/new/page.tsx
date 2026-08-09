
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, CheckCircle2, Workflow, Building2, 
  Briefcase, Search, Check, ChevronDown, X
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions'; 
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { ActivityType, Service, SubService, Department } from '@/types/reference';
import { Employee } from '@/types/hr';
import { TransactionService } from '@/services/transaction-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NewTransactionPage() {
  const clientId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions } = usePermissions(); 
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [engSearch, setEngSearch] = useState("");
  const [openEngPicker, setOpenEngPicker] = useState(false);
  
  const [form, setForm] = useState({ 
    activityTypeId: '', serviceId: '', subServiceId: '', departmentId: '', description: '', assignedEngineerId: '' 
  });

  const clientRef = useMemo(() => companyId && db ? doc(db, paths.clients(companyId), clientId) : null, [db, companyId, clientId]);
  const { data: client, loading: cLoading } = useDoc<Client>(clientRef);

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && form.activityTypeId ? query(collection(db, paths.services(companyId, form.activityTypeId)), orderBy('order')) : null, [db, companyId, form.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && form.activityTypeId && form.serviceId ? query(collection(db, paths.subServices(companyId, form.activityTypeId, form.serviceId)), orderBy('order')) : null, [db, companyId, form.activityTypeId, form.serviceId]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: departments } = useCollection<Department>(deptsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const filteredEngineers = useMemo(() => {
    let list = employees || [];
    if (form.departmentId) {
      list = list.filter(e => e.departmentId === form.departmentId);
    }
    if (engSearch.trim()) {
      const q = engSearch.toLowerCase();
      list = list.filter(e => e.fullName.toLowerCase().includes(q) || e.employeeNumber.includes(q));
    }
    return list;
  }, [employees, form.departmentId, engSearch]);

  const selectedEngineer = employees?.find(e => e.id === form.assignedEngineerId);

  const handleCreate = async () => {
    if (!db || !companyId || !user || !form.subServiceId || !form.assignedEngineerId) return;
    setLoading(true);
    try {
      const selectedAct = activities?.find(a => a.id === form.activityTypeId);
      const selectedSrv = services?.find(s => s.id === form.serviceId);
      const selectedSub = subServices?.find(ss => ss.id === form.subServiceId);
      const selectedEng = employees?.find(e => e.id === form.assignedEngineerId);

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
        title: t('transactions.openSuccess'),
        description: t('transactions.redirecting')
      });
      
      router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}`);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: t('transactions.openFailed'),
        description: e.message || t('common.unexpectedError')
      });
    } finally {
      setLoading(false);
    }
  };

  if (cLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center gap-4 border-b pb-4">
        <div className="text-start">
           <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight">{t('transactions.newTitle')}</h1>
           <p className="text-muted-foreground text-[10px] font-bold opacity-70 italic text-start">{client?.nameAr} | {client?.fileNumber}</p>
        </div>
      </div>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-primary/5 p-6 border-b flex items-center gap-3">
          <Workflow className="h-5 w-5 text-primary" />
          <h3 className="text-base font-black font-headline text-start">{t('transactions.pathAssignment')}</h3>
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
                  <SelectContent className="rounded-xl">{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المسار الفني (Pipeline)</Label>
                <Select disabled={!form.serviceId} value={form.subServiceId} onValueChange={(v) => setForm({...form, subServiceId: v})}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-xl">{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold text-xs">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                </Select>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                   <Building2 className="h-3 w-3" /> {t('transactions.targetDept')}
                </Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({...form, departmentId: v, assignedEngineerId: ''})}>
                   <SelectTrigger className="h-14 rounded-2xl border-2 font-black bg-white shadow-sm">
                      <SelectValue placeholder={t('transactions.selectDept')} />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      {departments?.map(dept => <SelectItem key={dept.id} value={dept.id!} className="font-bold text-xs">{isRtl ? dept.name : dept.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                   <Briefcase className="h-3 w-3" /> {t('transactions.assignedEngineer')}
                </Label>
                
                <Popover open={openEngPicker} onOpenChange={setOpenEngPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-14 rounded-2xl border-2 bg-white font-black justify-between px-4">
                      <span className="truncate">{selectedEngineer?.fullName || t('transactions.assignEngineer')}</span>
                      <ChevronDown className="h-4 w-4 opacity-30" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0 rounded-2xl shadow-3xl border-2 z-[100]" align="start">
                     <div className="p-3 bg-slate-50 border-b">
                        <div className="relative">
                           <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                           <Input 
                             placeholder={t('transactions.searchEngineer')}
                             className="h-10 ps-10 rounded-lg border-2 bg-white font-bold"
                             value={engSearch}
                             onChange={e => setEngSearch(e.target.value)}
                           />
                        </div>
                     </div>
                     <ScrollArea className="h-64">
                        <div className="p-2 space-y-1">
                           {filteredEngineers.map(emp => (
                             <div 
                               key={emp.id} 
                               onClick={() => { setForm({...form, assignedEngineerId: emp.id!}); setOpenEngPicker(false); setEngSearch(""); }}
                               className={cn(
                                 "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between",
                                 form.assignedEngineerId === emp.id ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                               )}
                             >
                                <div className="flex flex-col text-start">
                                   <span className="text-xs font-black">{emp.fullName}</span>
                                   <span className="text-[8px] font-mono text-slate-400">#{emp.employeeNumber}</span>
                                </div>
                                {form.assignedEngineerId === emp.id && <Check className="h-3.5 w-3.5" />}
                             </div>
                           ))}
                           {filteredEngineers.length === 0 && <div className="py-10 text-center text-xs font-bold text-slate-400 italic">No engineers found.</div>}
                        </div>
                     </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">وصف المتطلبات (اختياري)</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-4 text-sm bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-4">
         <Button variant="outline" onClick={() => router.back()} className="h-14 rounded-2xl px-10 font-black border-2 text-sm bg-white hover:bg-slate-50">{t('common.cancel')}</Button>
         <Button onClick={handleCreate} disabled={loading || !form.subServiceId || !form.assignedEngineerId} className="h-14 rounded-2xl px-16 bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-3 border-b-4 border-orange-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
           {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />} {t('transactions.openNow')}
         </Button>
      </div>
    </div>
  );
}
