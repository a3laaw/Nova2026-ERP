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
      sectionName: isRtl ? 'قسم فني جديد' : 'New Section',
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'هندسة المقايسات (BOQ)' : 'BOQ Engineering'}</h1>
             <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-widest">Template Hierarchy Manager</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={onClose} className="rounded-lg h-10 px-6 font-bold border-2 text-xs">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading} className="btn-nova-primary h-10 px-8 rounded-lg text-xs gap-2">
             {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
             {t('save')}
           </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white overflow-hidden ring-1 ring-black/5">
           <div className="bg-slate-50 p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Settings2 className="h-4 w-4 text-primary" />
                 <h3 className="text-sm font-black font-headline text-slate-800">{isRtl ? 'إعدادات القالب' : 'Template Identity'}</h3>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border-2">
                 <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'افتراضي' : 'Default'}</Label>
                 <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} className="scale-75" />
              </div>
           </div>
           <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                    <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-10 rounded-xl border-2 font-bold" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود المرجعية' : 'Ref Code'}</Label>
                    <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} className="h-10 rounded-xl border-2 font-mono text-primary" placeholder="BOQ_01" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'النشاط الفني' : 'Activity'}</Label>
                    <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                       <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent>
                          {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-50">
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">الخدمة والمسار التشغيلي</Label>
                    <div className="flex gap-2">
                       <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                          <SelectTrigger className="h-10 rounded-xl border-2 font-bold flex-1"><SelectValue placeholder={isRtl ? "الخدمة..." : "Service..."} /></SelectTrigger>
                          <SelectContent>
                             {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                       <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                          <SelectTrigger className="h-10 rounded-xl border-2 font-bold flex-1"><SelectValue placeholder={isRtl ? "المسار..." : "Pipeline..."} /></SelectTrigger>
                          <SelectContent>
                             {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold text-xs">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">{isRtl ? 'إجمالي الميزانية التقديرية' : 'Total Estimated Budget'}</Label>
                    <div className="relative">
                       <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                       <Input 
                          type="number" 
                          value={formData.baseAmount || 0} 
                          onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                          className="h-10 rounded-xl border-2 ps-9 font-black text-lg text-emerald-700 bg-emerald-50/10 text-center"
                       />
                    </div>
                 </div>
              </div>
           </CardContent>
        </Card>

        {/* محرك الشجرة الهندسية - تصميم Odoo المبسط */}
        <div className="space-y-8">
           <div className="flex justify-between items-center px-4">
              <div className="text-start">
                 <h3 className="text-lg font-black font-headline flex items-center gap-2 text-slate-800"><Calculator className="h-5 w-5 text-primary" /> {isRtl ? 'هيكلة بنود العمل' : 'Work Items Engineering'}</h3>
              </div>
              <Button onClick={addNewItem} size="sm" className="rounded-xl bg-[#1e1b4b] text-white font-black gap-2 shadow-lg"><Plus className="h-4 w-4" /> {isRtl ? 'بند جديد' : 'New Item'}</Button>
           </div>

           <div className="space-y-10">
              {boqTree.map((section) => (
                <div key={section.id} className="space-y-4 animate-in slide-in-from-bottom-2">
                   {/* رأس القسم الفني - فاتح وأنيق */}
                   <div className="flex items-center gap-4 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                         <LayoutGrid className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'القسم الفني' : 'TECHNICAL SECTION'}</span>
                         <Input 
                            value={section.name} 
                            onChange={e => {
                               const newItems = items.map(it => it.sectionId === section.id ? { ...it, sectionName: e.target.value } : it);
                               setItems(newItems);
                            }}
                            className="bg-transparent border-0 text-lg font-black p-0 h-auto focus-visible:ring-0 text-slate-800"
                         />
                      </div>
                   </div>

                   <div className="ms-6 space-y-6 border-s-2 border-slate-100 ps-6">
                      {section.children.map((category) => (
                        <div key={category.id} className="space-y-4">
                           <div className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-slate-50 shadow-sm group">
                              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><Boxes className="h-4 w-4" /></div>
                              <div className="flex-1">
                                 <span className="text-[8px] font-black text-blue-400 uppercase">{isRtl ? 'البند الرئيسي' : 'MAIN CATEGORY'}</span>
                                 <Input 
                                    value={category.name} 
                                    onChange={e => {
                                       const newItems = items.map(it => it.mainCategoryId === category.id ? { ...it, mainCategoryName: e.target.value } : it);
                                       setItems(newItems);
                                    }}
                                    className="bg-transparent border-0 font-black text-sm p-0 h-auto focus-visible:ring-0 text-blue-900"
                                 />
                              </div>
                           </div>

                           <div className="ms-10 space-y-4 border-s border-blue-50 ps-6">
                              {category.children.map((comp) => (
                                <div key={comp.id} className="space-y-3">
                                   <div className="flex items-center gap-2 text-slate-400">
                                      <Hammer className="h-3 w-3" />
                                      <div className="flex-1 flex items-center gap-2">
                                         <span className="text-[7px] font-black uppercase tracking-widest">{isRtl ? 'العنصر' : 'COMPONENT'}</span>
                                         <Input 
                                            value={comp.name} 
                                            onChange={e => {
                                               const newItems = items.map(it => it.componentId === comp.id ? { ...it, componentName: e.target.value } : it);
                                               setItems(newItems);
                                            }}
                                            className="bg-transparent border-0 font-bold text-xs p-0 h-auto focus-visible:ring-0 text-slate-600"
                                         />
                                      </div>
                                   </div>

                                   <div className="grid grid-cols-1 gap-2">
                                      {comp.children.map((item: any) => (
                                        <div key={`${item.id}-${item.originalIndex}`} className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row gap-4 items-start">
                                           <div className="flex-1 w-full space-y-1.5">
                                              <Label className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'وصف البند التنفيذي' : 'DESCRIPTION'}</Label>
                                              <Textarea 
                                                 value={item.description} 
                                                 onChange={e => updateItem(item.originalIndex, 'description', e.target.value)}
                                                 className="min-h-[60px] rounded-lg border-2 bg-slate-50/30 p-3 text-xs font-bold focus:bg-white transition-all shadow-inner"
                                              />
                                           </div>
                                           <div className="grid grid-cols-4 gap-2 w-full lg:w-[400px]">
                                              <div className="space-y-1">
                                                 <Label className="text-[8px] font-black text-slate-400 uppercase">Unit</Label>
                                                 <Input value={item.unit} onChange={e => updateItem(item.originalIndex, 'unit', e.target.value)} className="h-8 border-2 rounded-lg text-center font-black text-[10px]" />
                                              </div>
                                              <div className="space-y-1">
                                                 <Label className="text-[8px] font-black text-slate-400 uppercase">Qty</Label>
                                                 <Input type="number" value={item.plannedQuantity} onChange={e => updateItem(item.originalIndex, 'plannedQuantity', Number(e.target.value))} className="h-8 border-2 rounded-lg text-center font-black text-[10px]" />
                                              </div>
                                              <div className="space-y-1">
                                                 <Label className="text-[8px] font-black text-slate-400 uppercase">Rate</Label>
                                                 <Input type="number" value={item.estimatedRate} onChange={e => updateItem(item.originalIndex, 'estimatedRate', Number(e.target.value))} className="h-8 border-2 rounded-lg text-center font-black text-[10px] text-emerald-600 bg-emerald-50/10" />
                                              </div>
                                              <div className="flex items-end justify-center pb-1">
                                                 <Button 
                                                   variant="ghost" 
                                                   size="icon" 
                                                   onClick={() => removeItem(item.originalIndex)} 
                                                   className="h-8 w-8 rounded-lg text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                                                 >
                                                    <Trash2 className="h-4 w-4" />
                                                 </Button>
                                              </div>
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
              ))}
           </div>
        </div>

        {/* تذييل التحقق - أنيق وغير داكن */}
        <div className={cn(
          "p-8 rounded-[2rem] border-2 border-dashed flex flex-col md:flex-row items-center justify-between shadow-xl transition-all duration-500",
          isMathValid ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
        )}>
           <div className="text-center bg-white p-6 rounded-[1.5rem] shadow-md min-w-[200px] border-2 border-white">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي البنود المجمعة' : 'Aggregated Total'}</p>
             <span className="text-3xl font-black">{totalItemsCost.toLocaleString()} <span className="text-xs">KWD</span></span>
           </div>
           
           <div className="text-center md:text-end space-y-1 mt-6 md:mt-0">
             <h4 className="font-black text-lg font-headline flex items-center justify-center md:justify-end gap-2">
                {isMathValid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" />}
                {isRtl ? 'حالة التوازن المالي' : 'Financial Status'}
             </h4>
             <p className="text-xs font-bold opacity-70 leading-relaxed max-w-sm">
                {isMathValid 
                  ? (isRtl ? 'المقياسة في حالة توازن مطلق. مجموع البنود يطابق الميزانية.' : 'Perfectly balanced. Items match budget.')
                  : (isRtl ? `تنبيه: يوجد تباين قدره ${((formData.baseAmount || 0) - totalItemsCost).toFixed(3)} KWD.` : `Variance detected: ${((formData.baseAmount || 0) - totalItemsCost).toFixed(3)} KWD`)}
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}
