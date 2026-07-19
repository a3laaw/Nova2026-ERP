
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Save, X, Plus, Trash2, Loader2, ArrowRight,
  Gavel, Calculator, DollarSign, ShieldCheck,
  AlertTriangle, Target, Percent, Workflow
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { ContractTemplate, ContractMilestone } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { PrintWrapper } from '@/components/layout/print-wrapper';

interface Props {
  template: ContractTemplate | null;
  onClose: () => void;
}

export function ContractTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ContractTemplate>>(
    template || {
      name: '',
      code: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      introText: '',
      legalText: '',
      defaultMilestones: [{ name: isRtl ? 'الدفعة المقدمة' : 'Advance Payment', percentage: 10, timing: 'at', contractualEvent: 'SIGNING' }],
      isDefault: false,
      isActive: true
    }
  );

  const [pathStages, setPathStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubService[]>([]);

  // جلب البيانات المرجعية
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  
  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(srvQuery);

  // جلب المسارات الفنية عند تغيير الخدمة
  useEffect(() => {
    if (db && companyId && formData.activityTypeId && formData.serviceId) {
      getDocs(query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')))
        .then(snap => setActiveSubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService))))
        .catch(() => setActiveSubs([]));
    }
  }, [db, companyId, formData.activityTypeId, formData.serviceId]);

  // جلب مراحل المسار الفني للربط
  useEffect(() => {
    if (db && companyId && formData.activityTypeId && formData.serviceId && formData.subServiceId) {
      setLoadingStages(true);
      const stagesPath = paths.technicalStages(companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId);
      getDocs(query(collection(db, stagesPath), orderBy('order')))
        .then(snap => setPathStages(snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage))))
        .catch(() => setPathStages([]))
        .finally(() => setLoadingStages(false));
    } else {
      setPathStages([]);
    }
  }, [db, companyId, formData.subServiceId, formData.activityTypeId, formData.serviceId]);

  const totalPercentage = useMemo(() => formData.defaultMilestones?.reduce((acc, m) => acc + (m.percentage || 0), 0) || 0, [formData.defaultMilestones]);
  const isMathValid = Math.abs(totalPercentage - 100) < 0.1;

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!isMathValid) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "خطأ في توزيع الدفعات" : "Milestone Mismatch", 
        description: isRtl ? `يجب أن يكون مجموع الحصص 100% (الحالي: ${totalPercentage}%)` : `Total percentage must be 100%` 
      });
      return;
    }
    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      if (template?.id) await service.updateTemplate('contract', template.id, formData, user.uid);
      else await service.addTemplate('contract', formData, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...(formData.defaultMilestones || [])];
    newM[idx] = { ...newM[idx], [field]: value };
    setFormData({...formData, defaultMilestones: newM});
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 bg-[#fdfaf3]" dir={dir}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 border rounded-lg hover:bg-slate-50">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-lg font-black text-slate-900 leading-none">{isRtl ? 'هندسة قوالب العقود' : 'Contract Template Engineering'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft Contract Template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <Badge variant="outline" className={cn("h-6 border-2 font-black text-[9px]", isMathValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
              {isMathValid ? 'BALANCED: 100%' : `MISMATCH: ${totalPercentage}%`}
           </Badge>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-9 px-8 rounded-lg shadow-lg gap-2 border-b-4 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {t('save')}
           </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
         
         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-sm rounded-xl bg-white ring-1 ring-black/5">
               <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-start">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                     <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9 rounded-lg border-2 font-bold text-xs" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Code</Label>
                     <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-9 rounded-lg font-mono text-xs border-2" />
                  </div>
                  <div className="flex items-center justify-between p-2 mt-4 bg-slate-50 rounded-lg border-2">
                     <Label className="text-[8px] font-black uppercase text-slate-500">Default</Label>
                     <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                  </div>
               </CardContent>
            </Card>

            <div className={cn(
              "p-8 rounded-[2.5rem] text-center relative overflow-hidden transition-all shadow-xl ring-1 ring-black/5",
              isMathValid ? "bg-emerald-600 text-white" : "bg-[#1e1b4b] text-white"
            )}>
               <div className="absolute top-0 right-0 p-6 opacity-10"><Calculator className="h-32 w-32" /></div>
               <div className="relative z-10 space-y-3">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">{isRtl ? 'الميزانية المرجعية المعتمدة (KWD)' : 'Approved Reference Budget (KWD)'}</p>
                  <div className="max-w-xs mx-auto">
                    <Input 
                      type="number" 
                      value={formData.baseAmount === 0 ? "" : formData.baseAmount} 
                      onChange={e => setFormData({...formData, baseAmount: e.target.value === "" ? 0 : Number(e.target.value)})} 
                      className="h-14 rounded-2xl border-0 bg-white/20 text-white font-black text-3xl text-center shadow-inner focus:ring-4 focus:ring-white/30"
                    />
                  </div>
               </div>
            </div>

            <PrintWrapper className="mt-4 overflow-hidden border-0">
               <div className="space-y-8 text-start">
                  <div className="flex justify-between items-center px-2">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calculator className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'جدول الدفعات والربط الفني' : 'Payment Milestones & Technical Links'}
                     </h4>
                     <Button variant="outline" size="sm" onClick={() => setFormData({...formData, defaultMilestones: [...(formData.defaultMilestones || []), { name: '', percentage: 0, timing: 'at', contractualEvent: 'MANUAL' }]})} className="rounded-lg font-black text-[9px] border-2 h-7 px-4 gap-2 hover:bg-slate-50 transition-all">
                        <Plus className="h-3 w-3" /> {isRtl ? 'إضافة دفعة' : 'Add Payment'}
                     </Button>
                  </div>

                  <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xl">
                     <table className="w-full text-[10px] text-start">
                        <thead className="bg-slate-900 text-white">
                           <tr className="font-black uppercase tracking-widest text-[9px]">
                              <th className="p-3 w-10">#</th>
                              <th className="p-3 text-start">{isRtl ? 'مسمى الدفعة' : 'Milestone Name'}</th>
                              <th className="p-3 text-center w-24">{isRtl ? 'الحصة' : 'Share'}</th>
                              <th className="p-3 text-start w-32">{isRtl ? 'الربط الفني' : 'Technical Link'}</th>
                              <th className="p-3 text-end pe-6 w-32">{isRtl ? 'القيمة' : 'Amount'}</th>
                              <th className="p-3 w-10"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {(formData.defaultMilestones || []).map((m, idx) => {
                              const lineAmount = ((formData.baseAmount || 0) * (m.percentage || 0)) / 100;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="p-3 font-black text-slate-300">{idx + 1}</td>
                                   <td className="p-2">
                                      <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-8 rounded-lg font-bold text-[10px] bg-slate-50/50" />
                                   </td>
                                   <td className="p-2">
                                      <div className="relative w-16 mx-auto">
                                         <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value === "" ? 0 : Number(e.target.value))} className="h-8 rounded-lg border-2 font-black text-center pe-5 text-[10px]" />
                                         <Percent className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                      </div>
                                   </td>
                                   <td className="p-2">
                                      <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className="h-8 rounded-lg border-2 font-bold text-[9px] bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl">
                                            <SelectItem value="SIGNING" className="font-bold text-[10px]">توقيع العقد</SelectItem>
                                            {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px] py-2">
                                               <span className="flex items-center gap-1"><Workflow className="h-2.5 w-2.5 text-primary" /> {s.name}</span>
                                            </SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                   </td>
                                   <td className="p-3 text-end pe-6">
                                      <span className="font-mono font-black text-emerald-600">{(lineAmount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></span>
                                   </td>
                                   <td className="p-3 text-center">
                                      <button type="button" onClick={() => setFormData({...formData, defaultMilestones: formData.defaultMilestones?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                   </td>
                                </tr>
                              );
                           })}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white">
                           <tr>
                              <td colSpan={3} className="p-4 text-start">
                                 <h3 className="text-xs font-black font-headline uppercase tracking-tighter">{isRtl ? 'إجمالي حصص القالب' : 'Total Template Share'}</h3>
                                 <Badge className={cn("mt-1 border-0 text-[7px] font-black h-4 px-3", isMathValid ? "bg-emerald-500 text-white" : "bg-rose-500 text-white animate-pulse")}>
                                    {isMathValid ? 'BALANCED: 100%' : `MISMATCH: ${totalPercentage}%`}
                                 </Badge>
                              </td>
                              <td colSpan={3} className="p-4 text-end pe-6">
                                 <div className="space-y-0.5">
                                    <h2 className="text-2xl font-black font-headline text-primary">{(formData.baseAmount || 0).toLocaleString()}</h2>
                                    <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">Kuwaiti Dinars</p>
                                 </div>
                              </td>
                           </tr>
                        </tfoot>
                     </table>
                  </div>

                  <div className="space-y-4 pt-4 text-start">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-900 pb-2">
                        <Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'البنود والالتزامات القانونية الافتراضية' : 'Default Legal Clauses'}
                     </h4>
                     <Textarea value={formData.legalText || ''} onChange={e => setFormData({...formData, legalText: e.target.value})} className="min-h-[250px] rounded-2xl border-2 p-5 text-xs font-bold leading-relaxed bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
                  </div>
               </div>
            </PrintWrapper>
         </div>

         <aside className="lg:col-span-4 space-y-6 text-start">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-6 border-b">
                  <CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400">
                     <Target className="h-4 w-4 text-primary" /> {isRtl ? 'الارتباط التشغيلي السيادي' : 'Operational Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Activity Type</Label>
                     <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Main Service</Label>
                     <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs">
                           {servicesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="..." />}
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Specific Technical Path</Label>
                     <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => {
                        const sub = activeSubs.find(s => s.id === v);
                        setFormData({...formData, subServiceId: v, subServiceName: sub?.name || ''});
                     }}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-black text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
               </CardContent>
            </Card>

            <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white space-y-4 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck className="h-12 w-12 text-primary" /></div>
               <h5 className="font-black text-xs uppercase tracking-widest text-primary">{isRtl ? 'حالة القالب' : 'Template Status'}</h5>
               <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <Label className="text-[10px] font-bold text-slate-300 uppercase">{t('isActive')}</Label>
                  <Switch checked={formData.isActive !== false} onCheckedChange={v => setFormData({...formData, isActive: v})} />
               </div>
            </div>

            <div className="p-6 bg-amber-50 rounded-[2rem] border-2 border-dashed border-amber-200 flex items-start gap-4">
               <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
               <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                  {isRtl 
                    ? 'سيتم استخدام هذا القالب كأساس عند فتح معاملة جديدة لهذا المسار الفني. تأكد من ربط الدفعات بمراحلها الفنية الصحيحة لتمكين محرك المطالبة الآلي.' 
                    : 'This template will be the baseline for new transactions in this path. Link milestones to stages to enable automated billing triggers.'}
               </p>
            </div>
         </aside>
      </div>
    </div>
  );
}
