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
  Calculator, DollarSign, AlertTriangle, 
  ChevronRight, Layers, LayoutGrid, CheckCircle2,
  Settings2, Boxes, Hammer
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
import { transformToBOQTree } from '@/lib/boq-tree-utils';
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

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  useEffect(() => {
    if (template?.id && db && companyId) {
      const service = new TemplateService(db, companyId, permissions);
      service.getBOQTemplateItems(template.id).then(res => {
        setItems(res);
        setTemplateLoading(false);
      });
    }
  }, [template, db, companyId, permissions]);

  const boqTree = useMemo(() => transformToBOQTree(items), [items]);

  const totalItemsCost = useMemo(() => {
    return items.reduce((acc, item) => acc + ((item.plannedQuantity || 0) * (item.estimatedRate || 0)), 0);
  }, [items]);

  const isMathValid = Math.abs(totalItemsCost - (formData.baseAmount || 0)) < 0.001;

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    
    if (!formData.name) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "يرجى إدخال اسم القالب." : "Name required." });
      return;
    }

    if (!isMathValid) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "مجموع البنود لا يطابق الإجمالي التقديري." : "Balance mismatch." });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      const selectedAct = activities?.find(a => a.id === formData.activityTypeId);
      const selectedSrv = services?.find(s => s.id === formData.serviceId);
      const selectedSub = subServices?.find(ss => ss.id === formData.subServiceId);

      const finalData = {
        ...formData,
        activityTypeName: isRtl ? selectedAct?.name : selectedAct?.nameEn,
        serviceName: isRtl ? selectedSrv?.name : selectedSrv?.nameEn,
        subServiceName: isRtl ? selectedSub?.name : selectedSub?.nameEn,
      };

      await service.saveBOQTemplateWithItems(template?.id || null, finalData, items, user.uid);
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
      sectionId: 'SEC-' + Date.now(),
      sectionName: isRtl ? 'قسم جديد' : 'New Section',
      mainCategoryId: 'CAT-' + Date.now(),
      mainCategoryName: isRtl ? 'بند رئيسي جديد' : 'New Category',
      componentId: 'COMP-' + Date.now(),
      componentName: isRtl ? 'عنصر عمل' : 'Component',
      description: '',
      unit: 'm2',
      plannedQuantity: 1,
      executedQuantity: 0,
      estimatedRate: 0,
      estimatedCostRate: 0,
      materialCodes: [],
      order: items.length,
      companyId: companyId!
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

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all">
            <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start space-y-1">
             <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'هندسة المقايسات وجداول الكميات' : 'BOQ Engineering Editor'}</h1>
             <p className="text-xs font-bold text-muted-foreground italic opacity-70">{isRtl ? 'بناء الهيكل التنفيذي والمالي لبنود الأعمال.' : 'Structuring operational and financial work items.'}</p>
          </div>
        </div>
        <div className="flex gap-4">
           <Button variant="outline" onClick={onClose} className="rounded-xl h-12 px-8 font-black border-2">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
           <Button onClick={handleSave} disabled={loading} className="btn-nova-primary h-14 px-12 rounded-2xl text-lg gap-3">
             {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
             {t('save')}
           </Button>
        </div>
      </div>

      <div className="space-y-10">
        <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
           <div className="bg-primary/5 p-8 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Settings2 className="h-6 w-6 text-primary" />
                 <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'تعريف وارتباط القالب' : 'Template Identity & Link'}</h3>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'افتراضي' : 'Default'}</Label>
                 <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
              </div>
           </div>
           <CardContent className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                    <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود المرجعية' : 'Ref Code'}</Label>
                    <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} className="h-14 rounded-2xl border-2 font-mono text-lg text-primary" placeholder="BOQ_RES_01" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'النشاط الفني المخصص' : 'Activity Path'}</Label>
                    <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-black"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-2xl">
                          {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 border-t border-slate-50">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الخدمة الرئيسية' : 'Main Service'}</Label>
                    <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-2xl">
                          {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المسار التشغيلي (Pipeline)' : 'Operational Pipeline'}</Label>
                    <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-2xl">
                          {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
              </div>
           </CardContent>
        </Card>

        <div className="p-12 bg-emerald-50/50 rounded-[3.5rem] border-4 border-emerald-100/50 text-center relative overflow-hidden group shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-700"><DollarSign className="h-48 w-48 text-emerald-600" /></div>
           <div className="max-w-xl mx-auto space-y-6 relative z-10">
              <Label className="text-xs font-black uppercase text-emerald-600 tracking-[0.3em]">
                 {isRtl ? 'إجمالي قيمة المقياسة التقديرية (KWD)' : 'Total Estimated BOQ Budget (KWD)'}
              </Label>
              <div className="relative">
                 <Input 
                    type="number" 
                    value={formData.baseAmount || 0} 
                    onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                    className="h-28 rounded-[3rem] border-4 border-emerald-200 font-black text-6xl text-emerald-700 bg-white shadow-2xl text-center focus:ring-emerald-200 transition-all"
                 />
                 <div className="absolute -bottom-4 left-1/2 -translate-x-1/2"><Badge className="bg-emerald-600 text-white font-black px-6 py-1.5 shadow-xl">SI CONTROL</Badge></div>
              </div>
           </div>
        </div>

        <div className="space-y-12">
           <div className="flex justify-between items-center px-8">
              <div className="text-start">
                 <h3 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-800"><Calculator className="h-8 w-8 text-primary" /> {isRtl ? 'محرك هيكلة بنود الأعمال' : 'Work Items Engineering'}</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hierarchical Tree Structure / Flat Storage</p>
              </div>
              <Button onClick={addNewItem} className="h-16 px-10 rounded-2xl bg-[#1e1b4b] text-white font-black text-lg gap-3 hover:bg-slate-800 shadow-2xl transition-all"><Plus className="h-6 w-6 text-primary" /> {isRtl ? 'إضافة بند تنفيذي' : 'Add Item'}</Button>
           </div>

           <div className="space-y-16">
              {boqTree.map((section) => (
                <div key={section.id} className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                   <div className="flex items-center gap-6 bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl ring-4 ring-primary/5">
                      <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                         <LayoutGrid className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                         <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{isRtl ? 'القسم الفني' : 'TECHNICAL SECTION'}</span>
                         <Input 
                            value={section.name} 
                            onChange={e => {
                               const newItems = items.map(it => it.sectionId === section.id ? { ...it, sectionName: e.target.value } : it);
                               setItems(newItems);
                            }}
                            className="bg-transparent border-0 text-2xl font-black p-0 h-auto focus-visible:ring-0 text-white placeholder:text-white/20"
                            placeholder="..."
                         />
                      </div>
                   </div>

                   <div className="ms-10 space-y-12 border-s-4 border-slate-100 ps-10">
                      {section.children.map((category) => (
                        <div key={category.id} className="space-y-6">
                           <div className="flex items-center gap-4 bg-blue-50/50 p-4 rounded-3xl border-2 border-white shadow-sm group">
                              <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg"><Boxes className="h-5 w-5" /></div>
                              <div className="flex-1">
                                 <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{isRtl ? 'البند الرئيسي' : 'MAIN CATEGORY'}</span>
                                 <Input 
                                    value={category.name} 
                                    onChange={e => {
                                       const newItems = items.map(it => it.mainCategoryId === category.id ? { ...it, mainCategoryName: e.target.value } : it);
                                       setItems(newItems);
                                    }}
                                    className="bg-transparent border-0 font-black text-xl p-0 h-auto focus-visible:ring-0 text-blue-900"
                                 />
                              </div>
                           </div>

                           <div className="ms-12 space-y-8 border-s-2 border-blue-50 ps-8">
                              {category.children.map((comp) => (
                                <div key={comp.id} className="space-y-4">
                                   <div className="flex items-center gap-3 text-slate-400 group">
                                      <div className="h-8 w-8 rounded-lg bg-white border-2 flex items-center justify-center shadow-sm"><Hammer className="h-4 w-4" /></div>
                                      <div className="flex-1 flex items-center gap-3">
                                         <span className="text-[8px] font-black uppercase tracking-widest">{isRtl ? 'العنصر الفرعي' : 'COMPONENT'}</span>
                                         <Input 
                                            value={comp.name} 
                                            onChange={e => {
                                               const newItems = items.map(it => it.componentId === comp.id ? { ...it, componentName: e.target.value } : it);
                                               setItems(newItems);
                                            }}
                                            className="bg-transparent border-0 font-bold text-base p-0 h-auto focus-visible:ring-0 text-slate-700 w-fit min-w-[200px]"
                                         />
                                      </div>
                                   </div>

                                   <div className="grid grid-cols-1 gap-4">
                                      {comp.children.map((item: any) => (
                                        <Card key={`${item.id}-${item.originalIndex}`} className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden group hover:ring-4 hover:ring-primary/5 transition-all">
                                           <CardContent className="p-8">
                                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                                 <div className="lg:col-span-6 space-y-3">
                                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'توصيف البند التنفيذي الدقيق' : 'DETAILED EXECUTION DESCRIPTION'}</Label>
                                                    <Textarea 
                                                       value={item.description} 
                                                       onChange={e => updateItem(item.originalIndex, 'description', e.target.value)}
                                                       className="min-h-[100px] rounded-2xl border-2 bg-slate-50/50 p-5 font-bold text-sm focus:bg-white transition-all shadow-inner"
                                                       placeholder="..."
                                                    />
                                                 </div>
                                                 <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="space-y-1.5">
                                                       <Label className="text-[9px] font-black text-slate-400 uppercase">Unit</Label>
                                                       <Input value={item.unit} onChange={e => updateItem(item.originalIndex, 'unit', e.target.value)} className="h-12 border-2 rounded-xl text-center font-black" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                       <Label className="text-[9px] font-black text-slate-400 uppercase">Qty</Label>
                                                       <Input type="number" value={item.plannedQuantity} onChange={e => updateItem(item.originalIndex, 'plannedQuantity', Number(e.target.value))} className="h-12 border-2 rounded-xl text-center font-black" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                       <Label className="text-[9px] font-black text-slate-400 uppercase">Rate (KWD)</Label>
                                                       <Input type="number" value={item.estimatedRate} onChange={e => updateItem(item.originalIndex, 'estimatedRate', Number(e.target.value))} className="h-12 border-2 rounded-xl text-center font-black text-emerald-600 bg-emerald-50/20" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                       <Label className="text-[9px] font-black text-slate-400 uppercase">Subtotal</Label>
                                                       <div className="h-12 flex items-center justify-center font-mono font-black text-emerald-700 bg-emerald-100 rounded-xl shadow-inner">
                                                          {((item.plannedQuantity || 0) * (item.estimatedRate || 0)).toLocaleString()}
                                                       </div>
                                                    </div>
                                                 </div>
                                                 <div className="lg:col-span-1 flex flex-col items-center justify-center pt-6">
                                                    <Button 
                                                      variant="ghost" 
                                                      size="icon" 
                                                      onClick={() => removeItem(item.originalIndex)} 
                                                      className="h-12 w-12 rounded-2xl text-rose-200 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                    >
                                                       <Trash2 className="h-6 w-6" />
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
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className={cn(
          "p-12 rounded-[4rem] border-4 border-dashed flex flex-col md:flex-row items-center justify-between shadow-3xl transition-all duration-500",
          isMathValid ? "bg-emerald-100/50 border-emerald-300 text-emerald-900" : "bg-rose-100/50 border-rose-300 text-rose-900"
        )}>
           <div className="text-center bg-white p-10 rounded-[3rem] shadow-2xl min-w-[300px] border-4 border-white ring-8 ring-black/[0.02]">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{isRtl ? 'إجمالي البنود المجمعة' : 'Aggregated Total'}</p>
             <span className="text-6xl font-black font-headline">{totalItemsCost.toLocaleString()} <span className="text-sm">KWD</span></span>
           </div>
           
           <div className="text-center md:text-end space-y-3 mt-10 md:mt-0">
             <h4 className="font-black text-3xl font-headline flex items-center gap-4 justify-center md:justify-end">
                {isMathValid ? <CheckCircle2 className="h-10 w-10 text-emerald-600 animate-in zoom-in" /> : <AlertTriangle className="h-10 w-10 text-rose-600 animate-pulse" />}
                {isRtl ? 'رادار الموازنة المالية' : 'Financial Balance Radar'}
             </h4>
             <p className="text-base font-bold opacity-80 leading-relaxed max-w-lg">
                {isMathValid 
                  ? (isRtl ? 'المقياسة في حالة توازن مطلق. مجموع البنود يطابق الميزانية المحددة.' : 'BOQ is perfectly balanced. Items sum matches defined budget.')
                  : (isRtl ? `يوجد تباين قدره ${((formData.baseAmount || 0) - totalItemsCost).toFixed(3)} KWD بين الميزانية ومجموع البنود.` : `Variance detected: ${((formData.baseAmount || 0) - totalItemsCost).toFixed(3)} KWD`)}
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}
