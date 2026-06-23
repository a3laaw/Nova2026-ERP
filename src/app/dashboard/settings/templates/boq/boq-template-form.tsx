'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Save, X, Plus, Trash2, Loader2, ArrowRight,
  FileSpreadsheet, Boxes, Layers, DollarSign, Calculator, AlertTriangle
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQItem } from '@/types/templates';
import { ActivityType, Service, SubService } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface Props {
  template: BOQTemplate | null;
  onClose: () => void;
}

export function BOQTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<BOQTemplate>>(
    template || {
      name: '',
      code: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      sections: [{ name: isRtl ? 'الأعمال الأساسية' : 'General Works', order: 0 }],
      items: [],
      isDefault: false,
      isActive: true,
      version: 1
    }
  );

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  const totalItemsCost = useMemo(() => formData.items?.reduce((acc, it) => acc + ((it.quantity || 0) * (it.rate || 0)), 0) || 0, [formData.items]);
  const isMathValid = totalItemsCost === (formData.baseAmount || 0);

  const addSection = () => {
    const newSections = [...(formData.sections || [])];
    newSections.push({ name: '', order: newSections.length });
    setFormData({ ...formData, sections: newSections });
  };

  const addItem = (sectionName: string) => {
    const newItems = [...(formData.items || [])];
    newItems.push({ description: '', unit: 'unit', quantity: 1, rate: 0, order: newItems.length, sectionName });
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (idx: number, field: keyof BOQItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      if (template?.id) await service.updateTemplate('boq', template.id, formData, user.uid);
      else await service.addTemplate('boq', formData, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border"><ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
          <div className="text-start"><h1 className="text-2xl font-black font-headline">{isRtl ? 'إعداد جداول الكميات (BOQ)' : 'Setup BOQ/Estimation'}</h1></div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-primary text-white font-black rounded-xl h-12 px-8 shadow-xl gap-2 hover:scale-[1.02] transition-all">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-12 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardContent className="p-10 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                     <div className="md:col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label><Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" /></div>
                     <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'كود المقياسة' : 'BOQ Code'}</Label><Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" /></div>
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-white shadow-inner"><p className="text-[10px] font-black text-slate-400 uppercase">{t('defaultTemplate')}</p><Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} /></div>
                  </div>
               </CardContent>
            </Card>

            <div className="p-10 bg-emerald-50/40 rounded-[3rem] border-2 border-emerald-100/50 text-start relative overflow-hidden group shadow-sm">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="h-32 w-32" /></div>
               <div className="max-w-md mx-auto space-y-3 relative z-10 text-center">
                  <Label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest flex items-center justify-center gap-2">{isRtl ? 'إجمالي تكلفة المقياسة التقديرية (KWD)' : 'Total Estimated BOQ Cost (KWD)'}</Label>
                  <Input type="number" value={formData.baseAmount || 0} onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} className="h-16 rounded-[2rem] border-2 border-emerald-200 font-black text-3xl text-emerald-700 bg-white shadow-2xl text-center" />
               </div>
            </div>

            <div className="space-y-10">
               {formData.sections?.map((section, sIdx) => (
                 <Card key={sIdx} className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4 duration-500">
                    <CardHeader className="bg-slate-900 text-white p-8 flex flex-row items-center justify-between">
                       <div className="flex items-center gap-4 flex-1">
                          <Badge className="bg-white/10 text-primary border-0 font-black">#{sIdx + 1}</Badge>
                          <Input value={section.name || ''} onChange={e => {
                             const newSections = [...(formData.sections || [])];
                             newSections[sIdx].name = e.target.value;
                             setFormData({...formData, sections: newSections});
                          }} className="bg-transparent border-0 border-b border-white/20 rounded-none text-xl font-black text-white focus-visible:ring-0 w-full max-w-md" />
                       </div>
                       <Button onClick={() => addItem(section.name)} className="bg-primary text-white font-black rounded-xl h-10 px-4 gap-2"><Plus className="h-4 w-4" /> {isRtl ? 'إضافة بند فني' : 'Add Line Item'}</Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                       <table className="w-full text-start text-sm">
                          <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><th className="p-6 text-start">{isRtl ? 'توصيف العمل' : 'Description'}</th><th className="p-6 text-center w-24">{isRtl ? 'الوحدة' : 'Unit'}</th><th className="p-6 text-center w-24">{isRtl ? 'الكمية' : 'Qty'}</th><th className="p-6 text-center w-32">{isRtl ? 'السعر' : 'Rate'}</th><th className="p-6 w-12"></th></tr></thead>
                          <tbody className="divide-y">
                             {formData.items?.filter(it => it.sectionName === section.name).map((item, iIdx) => {
                               const realIdx = formData.items?.findIndex(it => it === item)!;
                               return (
                                 <tr key={iIdx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6"><Textarea value={item.description} onChange={e => updateItem(realIdx, 'description', e.target.value)} className="min-h-[40px] border-0 bg-transparent p-0 font-bold" /></td>
                                    <td className="p-6"><Input value={item.unit} onChange={e => updateItem(realIdx, 'unit', e.target.value)} className="h-10 text-center border-slate-100" /></td>
                                    <td className="p-6"><Input type="number" value={item.quantity} onChange={e => updateItem(realIdx, 'quantity', Number(e.target.value))} className="h-10 text-center font-black" /></td>
                                    <td className="p-6"><Input type="number" value={item.rate} onChange={e => updateItem(realIdx, 'rate', Number(e.target.value))} className="h-10 text-center font-black text-emerald-600 bg-emerald-50/10" /></td>
                                    <td className="p-6"><Button variant="ghost" size="icon" onClick={() => {
                                       const newItems = formData.items?.filter((_, i) => i !== realIdx);
                                       setFormData({...formData, items: newItems});
                                    }} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button></td>
                                 </tr>
                               );
                             })}
                          </tbody>
                       </table>
                    </CardContent>
                 </Card>
               ))}
               <Button onClick={addSection} variant="outline" className="w-full h-20 rounded-[2.5rem] border-2 border-dashed border-primary/30 text-primary font-black text-lg hover:bg-primary/5 transition-all gap-4"><Plus className="h-7 w-7" /> {isRtl ? 'إضافة قسم فني جديد (Section)' : 'Add New Technical Section'}</Button>
            </div>

            <div className={cn("p-10 rounded-[3rem] border-4 border-dashed flex items-center justify-between transition-all shadow-xl", isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800")}>
               <div className="text-center bg-white p-6 rounded-[2rem] shadow-xl min-w-[200px]"><span className="text-4xl font-black font-headline">{totalItemsCost.toLocaleString()} KWD</span></div>
               <div className="text-end space-y-1"><p className="font-black text-2xl font-headline">{t('totalQuoteValue')}</p><p className="text-[10px] font-bold opacity-60 uppercase">{isMathValid ? 'VALUATIONS MATCH' : 'VALUE MISMATCH (Check Base Amount)'}</p></div>
            </div>
         </div>
      </div>
    </div>
  );
}
