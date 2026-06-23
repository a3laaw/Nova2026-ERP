'use client';

import { useState, useMemo } from 'react';
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
  AlertTriangle
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { ContractTemplate, ContractMilestone } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

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

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);
  const stagesQuery = useMemo(() => companyId && db && formData.subServiceId ? query(collection(db, paths.technicalStages(companyId, formData.activityTypeId!, formData.serviceId!, formData.subServiceId!)), orderBy('order')) : null, [db, companyId, formData.subServiceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const totalPercentage = useMemo(() => formData.defaultMilestones?.reduce((acc, m) => acc + (m.percentage || 0), 0) || 0, [formData.defaultMilestones]);
  const isMathValid = totalPercentage === 100;

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!isMathValid) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? `مجموع الحصص ${totalPercentage}%، يجب أن يكون 100%.` : `Total must be 100%` });
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <h1 className="text-2xl font-black font-headline">{isRtl ? 'إعداد قالب العقد' : 'Setup Contract Template'}</h1>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-primary text-white font-black rounded-xl h-12 px-10 shadow-xl gap-2 hover:scale-[1.02] transition-all">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardContent className="p-10 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'كود العقد' : 'Contract Code'}</Label>
                        <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* صندوق القيمة الزمردي المعتمد (Emerald UI) */}
            <div className="p-12 bg-emerald-50/50 rounded-[3.5rem] border-2 border-emerald-100 text-center relative overflow-hidden group shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="h-40 w-40" /></div>
               <div className="max-w-md mx-auto space-y-4 relative z-10">
                  <Label className="text-xs font-black uppercase text-emerald-600 tracking-[0.2em]">
                     {isRtl ? 'إجمالي قيمة العقد التقديرية (KWD)' : 'Total Estimated Contract Value (KWD)'}
                  </Label>
                  <Input 
                     type="number" 
                     value={formData.baseAmount || 0} 
                     onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                     className="h-20 rounded-[2.5rem] border-4 border-emerald-200 font-black text-4xl text-emerald-700 bg-white shadow-2xl text-center focus:ring-emerald-200"
                  />
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-2xl font-black font-headline flex items-center gap-3 px-6"><Calculator className="h-8 w-8 text-primary" /> {isRtl ? 'هيكلة دفعات التعاقد' : 'Contract Milestones'}</h3>
               <div className="space-y-4">
                  {formData.defaultMilestones?.map((m, idx) => (
                    <Card key={idx} className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all">
                       <CardContent className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                          <div className="md:col-span-1 flex justify-center"><Badge className="h-10 w-10 rounded-xl bg-slate-900 text-white font-black">#{idx + 1}</Badge></div>
                          <div className="md:col-span-5 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'مسمى الدفعة' : 'Milestone Name'}</Label>
                             <Input value={m.name || ''} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-11 border-2 font-bold rounded-xl" />
                          </div>
                          <div className="md:col-span-2 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'الحصة (%)' : 'Share (%)'}</Label>
                             <Input type="number" value={m.percentage || 0} onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))} className="h-11 border-2 font-black text-emerald-600 rounded-xl text-center" />
                          </div>
                          <div className="md:col-span-3 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'المرحلة الفنية' : 'Linked Stage'}</Label>
                             <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                <SelectTrigger className="h-11 font-bold border-2 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   <SelectItem value="SIGNING" className="font-bold">توقيع العقد</SelectItem>
                                   {stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="md:col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => setFormData({...formData, defaultMilestones: formData.defaultMilestones?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-5 w-5" /></Button></div>
                       </CardContent>
                    </Card>
                  ))}
                  <Button onClick={() => setFormData({...formData, defaultMilestones: [...(formData.defaultMilestones || []), { name: '', percentage: 0, timing: 'at' }]})} variant="outline" className="w-full h-16 rounded-[2.5rem] border-2 border-dashed border-primary/20 text-primary font-black gap-2 hover:bg-primary/5 transition-all"><Plus className="h-6 w-6" /> {t('addMilestone')}</Button>
               </div>

               {/* صندوق التحقق المئوي (Odoo Style) */}
               <div className={cn(
                 "p-10 rounded-[3rem] border-4 border-dashed flex items-center justify-between shadow-xl transition-all",
                 isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
               )}>
                  <div className="text-center bg-white p-6 rounded-[2rem] shadow-xl min-w-[150px]">
                     <span className="text-4xl font-black font-headline">{totalPercentage}%</span>
                  </div>
                  <div className="text-end space-y-1">
                     <p className="font-black text-2xl font-headline">{t('totalQuoteShare')}</p>
                     <p className="text-[10px] font-bold opacity-60 uppercase">{isMathValid ? 'BALANCED' : 'UNBALANCED'}</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-1 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-900 text-white p-6 text-start"><CardTitle className="text-sm font-black flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /> {isRtl ? 'البنود القانونية' : 'Legal Clauses'}</CardTitle></CardHeader>
               <CardContent className="p-6"><Textarea value={formData.legalText || ''} onChange={e => setFormData({...formData, legalText: e.target.value})} className="min-h-[400px] rounded-2xl bg-slate-50/50 p-4 border-2 text-xs font-bold leading-relaxed" /></CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
