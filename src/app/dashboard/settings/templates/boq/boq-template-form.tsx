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
  FileSpreadsheet, Boxes, Layers, DollarSign, Calculator, AlertTriangle,
  ChevronDown, ChevronRight, LayoutGrid, CheckCircle2
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem } from '@/types/templates';
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
  const [items, setItems] = useState<BOQTemplateItem[]>([]);
  const [templateLoading, setTemplateLoading] = useState(!!template);
  
  const [formData, setFormData] = useState<Partial<BOQTemplate>>(
    template || {
      name: '',
      code: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      isDefault: false,
      isActive: true
    }
  );

  // جلب المراجع الفنية
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  // جلب البنود إذا كان تعديلاً
  useEffect(() => {
    if (template?.id && db && companyId) {
      const service = new TemplateService(db, companyId, permissions);
      service.getBOQTemplateItems(template.id).then(res => {
        setItems(res);
        setTemplateLoading(false);
      });
    }
  }, [template, db, companyId, permissions]);

  const totalItemsCost = useMemo(() => {
    return items.reduce((acc, item) => acc + ((item.plannedQuantity || 0) * (item.estimatedRate || 0)), 0);
  }, [items]);

  const isMathValid = Math.abs(totalItemsCost - (formData.baseAmount || 0)) < 0.001;

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    
    // Validations
    if (!formData.name) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "يرجى إدخل اسم القالب." : "Name is required." });
      return;
    }

    const invalidItems = items.filter(it => !it.description || !it.unit || (it.plannedQuantity || 0) <= 0 || !it.sectionName || !it.mainCategoryName || !it.componentName);
    if (invalidItems.length > 0) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "يوجد بنود غير مكتملة البيانات الأساسية." : "Some items have missing data." });
      return;
    }

    if (!isMathValid) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "مجموع بنود الجدول لا يطابق الإجمالي التقديري." : "Items sum mismatch with base amount." });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      await service.saveBOQTemplateWithItems(template?.id || null, formData, items, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const addNewItem = () => {
    const newItem: BOQTemplateItem = {
      sectionId: '',
      sectionName: '',
      mainCategoryId: '',
      mainCategoryName: '',
      componentId: '',
      componentName: '',
      description: '',
      unit: '',
      plannedQuantity: 1,
      executedQuantity: 0,
      estimatedRate: 0,
      estimatedCostRate: 0,
      materialCodes: [],
      order: items.length,
      companyId
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof BOQTemplateItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // تجميع البنود شجرياً للعرض فقط (Section -> Main Category -> Component)
  const groupedItems = useMemo(() => {
    const groups: any = {};
    items.forEach((item, index) => {
      const sName = item.sectionName || (isRtl ? 'بدون قسم' : 'Unassigned Section');
      const mName = item.mainCategoryName || (isRtl ? 'بدون فئة' : 'Unassigned Category');
      const cName = item.componentName || (isRtl ? 'بدون عنصر' : 'Unassigned Component');

      if (!groups[sName]) groups[sName] = {};
      if (!groups[sName][mName]) groups[sName][mName] = {};
      if (!groups[sName][mName][cName]) groups[sName][mName][cName] = [];
      
      groups[sName][mName][cName].push({ ...item, originalIndex: index });
    });
    return groups;
  }, [items, isRtl]);

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <h1 className="text-3xl font-black font-headline">{isRtl ? 'محرر جداول الكميات الذكي' : 'BOQ Template Editor'}</h1>
        </div>
        <div className="flex gap-4">
           <Button variant="outline" onClick={onClose} className="rounded-xl h-12 px-6 font-bold">{t('logout')}</Button>
           <Button onClick={handleSave} disabled={loading} className="bg-primary text-white font-black rounded-xl h-12 px-10 shadow-xl gap-2 hover:scale-[1.02] transition-all">
             {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
             {t('save')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-12 space-y-8">
            {/* القالب الأساسي */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardContent className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود المقياسة' : 'BOQ Code'}</Label>
                        <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-14 rounded-2xl border-2 font-mono text-lg" />
                     </div>
                     <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-white shadow-inner">
                        <p className="text-[11px] font-black text-slate-500 uppercase">{t('defaultTemplate')}</p>
                        <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase">{t('orgRef')}</Label>
                      <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                         <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent className="rounded-2xl">
                            {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase">{t('newService')}</Label>
                      <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                         <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent className="rounded-xl">
                            {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase">{t('newPath')}</Label>
                      <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                         <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent className="rounded-xl">
                            {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                    </div>
                  </div>
               </CardContent>
            </Card>

            {/* صندوق القيمة الزمردي */}
            <div className="p-12 bg-emerald-50/50 rounded-[3.5rem] border-2 border-emerald-100 text-center relative overflow-hidden group shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="h-40 w-40" /></div>
               <div className="max-w-md mx-auto space-y-4 relative z-10">
                  <Label className="text-xs font-black uppercase text-emerald-600 tracking-[0.2em]">
                     {isRtl ? 'إجمالي قيمة المقياسة التقديرية (KWD)' : 'Total Estimated BOQ Budget (KWD)'}
                  </Label>
                  <Input 
                     type="number" 
                     value={formData.baseAmount || 0} 
                     onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                     className="h-20 rounded-[2.5rem] border-4 border-emerald-200 font-black text-4xl text-emerald-700 bg-white shadow-2xl text-center"
                  />
               </div>
            </div>

            {/* محرر البنود الشجري المطور */}
            <div className="space-y-10">
               <div className="flex justify-between items-center px-6">
                  <h3 className="text-2xl font-black font-headline flex items-center gap-3"><Calculator className="h-8 w-8 text-primary" /> {isRtl ? 'هيكلة البنود التنفيذية' : 'Work Items Breakdown'}</h3>
                  <Button onClick={addNewItem} className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black gap-2 hover:scale-105 transition-all"><Plus className="h-5 w-5" /> {isRtl ? 'بند تنفيذ جديد' : 'Add Item'}</Button>
               </div>

               <div className="space-y-12">
                  {Object.keys(groupedItems).map((sectionName) => (
                    <div key={sectionName} className="space-y-6">
                       <div className="flex items-center gap-4 bg-slate-100 p-4 rounded-2xl border-2 border-white shadow-sm">
                          <Badge className="bg-primary text-white font-black rounded-lg">SECTION</Badge>
                          <h4 className="text-xl font-black text-slate-800">{sectionName}</h4>
                       </div>

                       {Object.keys(groupedItems[sectionName]).map((mainCatName) => (
                         <div key={mainCatName} className="ms-8 space-y-4">
                            <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                               <ChevronRight className="h-4 w-4 text-blue-400" />
                               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Main Category:</span>
                               <h5 className="text-lg font-black text-blue-900">{mainCatName}</h5>
                            </div>

                            {Object.keys(groupedItems[sectionName][mainCatName]).map((compName) => (
                              <div key={compName} className="ms-8 space-y-4">
                                 <div className="flex items-center gap-2 text-slate-500">
                                    <Layers className="h-4 w-4" />
                                    <span className="text-[9px] font-black uppercase">Component:</span>
                                    <span className="font-bold text-slate-800">{compName}</span>
                                 </div>

                                 <div className="grid grid-cols-1 gap-4">
                                    {groupedItems[sectionName][mainCatName][compName].map((item: any) => (
                                      <Card key={item.originalIndex} className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all border-s-8 border-s-primary/20">
                                         <CardContent className="p-8">
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                               {/* التنظيم الهرمي داخل البند */}
                                               <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-dashed">
                                                  <div className="space-y-1">
                                                     <Label className="text-[8px] font-black text-slate-400 uppercase">Section</Label>
                                                     <Input value={item.sectionName} onChange={e => updateItem(item.originalIndex, 'sectionName', e.target.value)} className="h-8 text-[11px] font-bold rounded-lg" />
                                                  </div>
                                                  <div className="space-y-1">
                                                     <Label className="text-[8px] font-black text-slate-400 uppercase">Main Category</Label>
                                                     <Input value={item.mainCategoryName} onChange={e => updateItem(item.originalIndex, 'mainCategoryName', e.target.value)} className="h-8 text-[11px] font-bold rounded-lg" />
                                                  </div>
                                                  <div className="space-y-1">
                                                     <Label className="text-[8px] font-black text-slate-400 uppercase">Component</Label>
                                                     <Input value={item.componentName} onChange={e => updateItem(item.originalIndex, 'componentName', e.target.value)} className="h-8 text-[11px] font-bold rounded-lg" />
                                                  </div>
                                               </div>

                                               {/* بيانات البند التفصيلية */}
                                               <div className="lg:col-span-5 space-y-2">
                                                  <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'توصيف العمل التفصيلي' : 'Item Description'}</Label>
                                                  <Textarea 
                                                    value={item.description} 
                                                    onChange={e => updateItem(item.originalIndex, 'description', e.target.value)}
                                                    className="min-h-[80px] rounded-xl border-2 font-bold text-sm bg-slate-50/30"
                                                  />
                                               </div>

                                               <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                  <div className="space-y-1">
                                                     <Label className="text-[9px] font-black text-slate-400 uppercase">Unit</Label>
                                                     <Input value={item.unit} onChange={e => updateItem(item.originalIndex, 'unit', e.target.value)} className="h-10 font-bold border-2 rounded-xl text-center" />
                                                  </div>
                                                  <div className="space-y-1">
                                                     <Label className="text-[9px] font-black text-slate-400 uppercase">Qty</Label>
                                                     <Input type="number" value={item.plannedQuantity} onChange={e => updateItem(item.originalIndex, 'plannedQuantity', Number(e.target.value))} className="h-10 font-black border-2 rounded-xl text-center" />
                                                  </div>
                                                  <div className="space-y-1">
                                                     <Label className="text-[9px] font-black text-slate-400 uppercase">Rate (KWD)</Label>
                                                     <Input type="number" value={item.estimatedRate} onChange={e => updateItem(item.originalIndex, 'estimatedRate', Number(e.target.value))} className="h-10 font-black border-2 rounded-xl text-center text-emerald-600" />
                                                  </div>
                                                  <div className="space-y-1">
                                                     <Label className="text-[9px] font-black text-slate-400 uppercase">Subtotal</Label>
                                                     <div className="h-10 flex items-center justify-center font-mono font-black text-emerald-700 bg-emerald-50 rounded-xl">
                                                        {((item.plannedQuantity || 0) * (item.estimatedRate || 0)).toLocaleString()}
                                                     </div>
                                                  </div>
                                               </div>

                                               <div className="lg:col-span-1 flex flex-col justify-end pb-1.5">
                                                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.originalIndex)} className="h-10 w-10 text-rose-200 hover:text-rose-600 transition-colors">
                                                     <Trash2 className="h-5 w-5" />
                                                  </Button>
                                               </div>
                                            </div>
                                         </CardContent>
                                      </Card>
                                    ))}
                                 </div>
                              </div>
                            ))}
                         </div>
                       ))}
                    </div>
                  ))}
               </div>
            </div>

            {/* شريط التوازن المالي النهائي */}
            <div className={cn(
              "p-10 rounded-[3.5rem] border-4 border-dashed flex flex-col md:flex-row items-center justify-between shadow-2xl transition-all",
              isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
            )}>
               <div className="text-center bg-white p-8 rounded-[2.5rem] shadow-xl min-w-[250px] border-2 border-emerald-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي البنود الفعلي' : 'Items Aggregated Total'}</p>
                 <span className="text-4xl font-black font-headline">{totalItemsCost.toLocaleString()} KWD</span>
               </div>
               
               <div className="text-center md:text-end space-y-2 mt-6 md:mt-0">
                 <h4 className="font-black text-2xl font-headline flex items-center gap-3 justify-center md:justify-end">
                    {isMathValid ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <AlertTriangle className="h-8 w-8 text-rose-500" />}
                    {isRtl ? 'حالة التوازن المالي للمقياسة' : 'Financial Balance Status'}
                 </h4>
                 <p className="text-sm font-bold opacity-70 leading-relaxed max-w-md">
                    {isMathValid 
                      ? (isRtl ? 'المقياسة متوازنة تماماً وجاهزة للاعتماد.' : 'BOQ is perfectly balanced and ready for commit.')
                      : (isRtl ? `تنبيه: يوجد فرق قدره ${(formData.baseAmount || 0) - totalItemsCost} KWD بين الإجمالي التقديري ومجموع البنود.` : `Mismatch detected. Diff: ${(formData.baseAmount || 0) - totalItemsCost} KWD`)}
                 </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
