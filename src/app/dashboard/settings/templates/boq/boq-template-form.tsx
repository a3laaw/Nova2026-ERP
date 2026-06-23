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
  FileSpreadsheet, Calculator, ShieldCheck, Sparkles,
  Layers, Boxes, GripVertical, Info, Hash
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQSection, BOQItem, MeasurementMode } from '@/types/templates';
import { ActivityType, Service, SubService } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface Props {
  template: BOQTemplate | null;
  onClose: () => void;
}

export function BOQTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<BOQTemplate>>(
    template || {
      name: '',
      code: '',
      description: '',
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      sections: [{ name: isRtl ? 'الأعمال الأساسية' : 'Primary Works', order: 0 }],
      items: [{ description: '', unit: 'unit', quantity: 1, rate: 0, order: 0, sectionName: isRtl ? 'الأعمال الأساسية' : 'Primary Works' }],
      measurementMode: 'quantity',
      isDefault: false,
      isActive: true,
      version: 1
    }
  );

  // جلب المراجع الفنية
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  // إدارة الأقسام
  const addSection = () => {
    const newSections = [...(formData.sections || [])];
    newSections.push({ name: '', order: newSections.length });
    setFormData({ ...formData, sections: newSections });
  };

  const updateSection = (idx: number, name: string) => {
    const newSections = [...(formData.sections || [])];
    const oldName = newSections[idx].name;
    newSections[idx].name = name;
    
    // تحديث كافة البنود التي تتبع هذا القسم آلياً
    const newItems = formData.items?.map(item => 
      item.sectionName === oldName ? { ...item, sectionName: name } : item
    ) || [];

    setFormData({ ...formData, sections: newSections, items: newItems });
  };

  const removeSection = (idx: number) => {
    const sectionToRemove = formData.sections![idx].name;
    setFormData({
      ...formData,
      sections: formData.sections?.filter((_, i) => i !== idx),
      items: formData.items?.filter(item => item.sectionName !== sectionToRemove)
    });
  };

  // إدارة البنود
  const addItem = (sectionName: string) => {
    const newItems = [...(formData.items || [])];
    newItems.push({ 
      description: '', 
      unit: 'pcs', 
      quantity: 1, 
      rate: 0, 
      order: newItems.length, 
      sectionName 
    });
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (idx: number, field: keyof BOQItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (idx: number) => {
    setFormData({
      ...formData,
      items: formData.items?.filter((_, i) => i !== idx)
    });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!formData.name || !formData.activityTypeId || !formData.serviceId) {
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Data" });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId);
      
      const activity = activities?.find(a => a.id === formData.activityTypeId);
      const srv = services?.find(s => s.id === formData.serviceId);
      const sub = subServices?.find(ss => ss.id === formData.subServiceId);

      const finalData = {
        ...formData,
        activityTypeName: isRtl ? activity?.name : activity?.nameEn,
        serviceName: isRtl ? srv?.name : srv?.nameEn,
        subServiceName: isRtl ? sub?.name : sub?.nameEn,
        code: formData.code || formData.name?.toUpperCase().replace(/\s+/g, '_')
      };

      if (template?.id) {
        await service.updateTemplate('boq', template.id, finalData, user.uid);
      } else {
        await service.addTemplate('boq', finalData, user.uid);
      }

      toast({ title: t('saved') });
      onClose();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline">
               {template ? (isRtl ? 'تعديل قالب جدول الكميات' : 'Edit BOQ Template') : (isRtl ? 'إنشاء قالب BOQ جديد' : 'New BOQ Template')}
            </h1>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-primary text-white font-black rounded-xl h-12 px-8 shadow-xl shadow-primary/20 gap-2"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-12">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-primary/5 p-8 border-b">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                     <CardTitle className="text-lg font-black flex items-center gap-3"><Info className="h-5 w-5 text-primary" /> {isRtl ? 'البيانات الأساسية والربط' : 'Basic Identity & Link'}</CardTitle>
                     <div className="flex items-center gap-4 bg-white p-2 rounded-xl border-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 px-2">{isRtl ? 'نمط الحساب' : 'Measurement Mode'}</Label>
                        <Select value={formData.measurementMode} onValueChange={(v: MeasurementMode) => setFormData({...formData, measurementMode: v})}>
                           <SelectTrigger className="h-9 w-40 border-0 font-black text-xs shadow-none"><SelectValue /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="quantity" className="font-bold">{isRtl ? 'كميات (Units)' : 'Unit Quantity'}</SelectItem>
                              <SelectItem value="lumpsum" className="font-bold">{isRtl ? 'مقطوع (Lump Sum)' : 'Lump Sum'}</SelectItem>
                              <SelectItem value="hybrid" className="font-bold">{isRtl ? 'هجين (Hybrid)' : 'Hybrid'}</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                     <div className="md:col-span-2 space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الكود المرجعي' : 'Ref Code'}</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" placeholder="BOQ_STD_01" />
                     </div>
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-white shadow-inner">
                        <div className="text-start"><p className="text-[10px] font-black text-slate-400 uppercase">{t('defaultTemplate')}</p></div>
                        <Switch checked={formData.isDefault} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t('orgRef')}</Label>
                        <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t('techRef')}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t('newPath')}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!}>{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* محرر جداول الكميات التفاعلي */}
            <div className="mt-12 space-y-10">
               <div className="flex justify-between items-end px-4">
                  <div className="text-start">
                     <h3 className="text-2xl font-black font-headline text-slate-800 flex items-center gap-3"><Boxes className="h-8 w-8 text-primary" /> {isRtl ? 'توصيف بنود الأعمال' : 'Work Items Breakdown'}</h3>
                     <p className="text-sm font-bold text-slate-400 mt-1">{isRtl ? 'قم بتنظيم البنود داخل أقسام فنية لسهولة التتبع.' : 'Organize items into technical sections for easier tracking.'}</p>
                  </div>
                  <Button onClick={addSection} variant="outline" className="rounded-xl h-12 px-6 border-2 font-black gap-2 hover:bg-slate-50">
                     <Layers className="h-4 w-4" /> {isRtl ? 'إضافة قسم فني' : 'Add Section'}
                  </Button>
               </div>

               {formData.sections?.map((section, sIdx) => {
                  const sectionItems = formData.items?.filter(it => it.sectionName === section.name) || [];
                  
                  return (
                    <Card key={sIdx} className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4 duration-500">
                       <CardHeader className="bg-slate-900 text-white p-8 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                             <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center font-black text-primary border border-white/10">
                                {sIdx + 1}
                             </div>
                             <Input 
                               value={section.name} 
                               onChange={e => updateSection(sIdx, e.target.value)}
                               placeholder={isRtl ? "اسم القسم (مثلاً: الأعمال الكهربائية)..." : "Section Name..."}
                               className="bg-transparent border-0 border-b border-white/20 rounded-none h-10 text-xl font-black text-white focus-visible:ring-0 w-full max-w-md"
                             />
                          </div>
                          <div className="flex items-center gap-3">
                             <Button onClick={() => addItem(section.name)} className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl h-10 px-4 gap-2">
                                <Plus className="h-4 w-4" /> {isRtl ? 'إضافة بند' : 'Add Item'}
                             </Button>
                             {formData.sections!.length > 1 && (
                               <Button variant="ghost" size="icon" onClick={() => removeSection(sIdx)} className="h-10 w-10 text-white/40 hover:text-rose-400 rounded-full">
                                  <Trash2 className="h-5 w-5" />
                               </Button>
                             )}
                          </div>
                       </CardHeader>
                       <CardContent className="p-0 overflow-x-auto">
                          <table className="w-full text-start text-sm">
                             <thead className="bg-slate-50 border-b">
                                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                   <th className="p-6 text-start w-12">#</th>
                                   <th className="p-6 text-start">{isRtl ? 'وصف العمل' : 'Work Description'}</th>
                                   <th className="p-6 text-center w-32">{isRtl ? 'الوحدة' : 'Unit'}</th>
                                   <th className="p-6 text-center w-32">{isRtl ? 'الكمية' : 'Qty'}</th>
                                   <th className="p-6 text-center w-40">{isRtl ? 'السعر (KWD)' : 'Rate'}</th>
                                   <th className="p-6 text-end w-16"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                {sectionItems.map((item, iIdx) => {
                                   const realIdx = formData.items?.findIndex(it => it === item);
                                   return (
                                     <tr key={iIdx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-6 text-center font-bold text-slate-300">{iIdx + 1}</td>
                                        <td className="p-6">
                                           <Textarea 
                                             value={item.description} 
                                             onChange={e => updateItem(realIdx!, 'description', e.target.value)}
                                             placeholder={isRtl ? "توصيف البند..." : "Description..."}
                                             className="min-h-[40px] border-0 bg-transparent p-0 resize-none font-bold text-slate-700 shadow-none focus-visible:ring-0"
                                           />
                                        </td>
                                        <td className="p-6">
                                           <Input 
                                             value={item.unit} 
                                             onChange={e => updateItem(realIdx!, 'unit', e.target.value)}
                                             className="h-10 text-center font-bold rounded-lg border-slate-100"
                                           />
                                        </td>
                                        <td className="p-6">
                                           <Input 
                                             type="number"
                                             value={item.quantity} 
                                             onChange={e => updateItem(realIdx!, 'quantity', Number(e.target.value))}
                                             className="h-10 text-center font-black rounded-lg border-slate-100"
                                           />
                                        </td>
                                        <td className="p-6">
                                           <Input 
                                             type="number"
                                             step="0.001"
                                             value={item.rate} 
                                             onChange={e => updateItem(realIdx!, 'rate', Number(e.target.value))}
                                             className="h-10 text-center font-black text-emerald-600 rounded-lg border-slate-100 bg-emerald-50/10"
                                           />
                                        </td>
                                        <td className="p-6">
                                           <Button 
                                             variant="ghost" 
                                             size="icon" 
                                             onClick={() => removeItem(realIdx!)} 
                                             className="h-8 w-8 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"
                                           >
                                              <X className="h-4 w-4" />
                                           </Button>
                                        </td>
                                     </tr>
                                   );
                                })}
                                {sectionItems.length === 0 && (
                                  <tr>
                                     <td colSpan={6} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                           <Plus className="h-8 w-8" />
                                           <p className="font-bold text-xs">{isRtl ? 'لا يوجد بنود في هذا القسم. اضغط "إضافة بند" للبدء.' : 'No items. Click "Add Item" to start.'}</p>
                                        </div>
                                     </td>
                                  </tr>
                                )}
                             </tbody>
                          </table>
                       </CardContent>
                    </Card>
                  );
               })}
            </div>
         </div>
      </div>
    </div>
  );
}
