/**
 * @fileOverview واجهة مصفوفة الصلاحيات الذكية.
 * تم تصميمها لتوضيح أن الصلاحيات تعمل كقالب (Template) يتم تخصيصه ميدانياً 
 * عبر ربطه بالوظائف والأقسام المرجعية.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShieldCheck, Save, X, Loader2, 
  Settings2, LayoutGrid, Globe, User, Users,
  Building2, Info
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { Role } from '@/types/roles';
import { RoleService } from '@/services/role-service';
import { SYSTEM_RESOURCES, ACTION_LABELS } from '@/lib/permissions/catalog';
import { Action, Scope } from '@/lib/permissions/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface Props {
  role: Role | null;
  onClose: () => void;
  roleService: RoleService;
}

export function RoleMatrixForm({ role, onClose, roleService }: Props) {
  const { lang, dir, t } = useLanguage();
  const isRtl = lang === 'ar';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({ 
    name: '', nameEn: '', matrix: [] 
  });

  useEffect(() => {
    if (role) {
      setFormData({
        ...role,
        matrix: (role as any).matrix || []
      });
    } else {
      setFormData({ name: '', nameEn: '', matrix: [] });
    }
  }, [role]);

  const getScope = (resourceId: string, action: Action): Scope => {
    const rule = formData.matrix?.find((m: any) => m.resourceId === resourceId && m.action === action);
    return rule?.scope || 'none';
  };

  const setScope = (resourceId: string, action: Action, scope: Scope) => {
    const currentMatrix = [...(formData.matrix || [])];
    const index = currentMatrix.findIndex((m: any) => m.resourceId === resourceId && m.action === action);

    if (index > -1) {
      if (scope === 'none') {
        currentMatrix.splice(index, 1);
      } else {
        currentMatrix[index].scope = scope;
      }
    } else if (scope !== 'none') {
      currentMatrix.push({ resourceId, action, scope });
    }

    setFormData({ ...formData, matrix: currentMatrix });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.nameEn) {
      toast({ variant: "destructive", title: isRtl ? "اسم الدور مطلوب" : "Role name is required" });
      return;
    }
    setLoading(true);
    try {
      if (role?.id) {
        await roleService.updateRole(role.id, formData);
      } else {
        const code = formData.nameEn.toUpperCase().replace(/\s+/g, '_');
        await roleService.addRole({ 
          ...formData, 
          code, 
          isActive: true, 
          isSystemRole: false, 
          order: 10 
        });
      }
      toast({ title: t('saved') });
      onClose();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const SCOPES: { value: Scope; label: string; icon: any; color: string; desc: string }[] = [
    { value: 'none', label: isRtl ? 'محجوب' : 'None', icon: X, color: 'text-slate-400', desc: isRtl ? 'لا يمكنه رؤية أو إجراء هذا الفعل نهائياً.' : 'No access at all.' },
    { value: 'own', label: isRtl ? 'خاص بالموظف' : 'Own Only', icon: User, color: 'text-blue-500', desc: isRtl ? 'يتعامل فقط مع السجلات التي أنشأها هو.' : 'Only records created by the user.' },
    { value: 'dept', label: isRtl ? 'نطاق القسم' : 'Department', icon: Users, color: 'text-orange-500', desc: isRtl ? 'يتعامل مع كافة سجلات زملائه في نفس القسم المرجعي.' : 'Access records within the same reference department.' },
    { value: 'all', label: isRtl ? 'المنشأة كاملة' : 'Full Access', icon: Globe, color: 'text-emerald-500', desc: isRtl ? 'سلطة كاملة على مستوى كافة الأقسام والمنشأة.' : 'Access to all company data regardless of department.' },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-primary/5 p-8 border-b flex flex-row items-center justify-between">
           <div className="text-start">
              <CardTitle className="text-2xl font-black font-headline flex items-center gap-3">
                 <ShieldCheck className="h-8 w-8 text-primary" />
                 {isRtl ? 'مصفوفة الصلاحيات الذكية' : 'Intelligent Permission Matrix'}
              </CardTitle>
              <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
                {isRtl ? 'تخصيص نطاق الوصول لكل عملية ومورد في النظام' : 'Customizing granular access scope per action and module'}
              </p>
           </div>
           <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="h-6 w-6" /></Button>
        </CardHeader>
        
        <CardContent className="p-0">
           {/* تعليمات الربط المرجعي */}
           <div className="p-6 bg-blue-50 border-b border-blue-100 flex items-start gap-4 text-start">
              <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
              <div>
                 <h5 className="font-black text-blue-900 text-sm">{isRtl ? 'تنبيه الربط المرجعي (Reference Link)' : 'Reference Link Warning'}</h5>
                 <p className="text-xs text-blue-700/70 leading-relaxed font-bold">
                    {isRtl 
                      ? 'هذا الدور يعمل كـ "قالب". عند اختيار نطاق "القسم"، سيعتمد النظام آلياً على كود القسم المرجعي الذي تمنحه للموظف عند التوظيف لفلترة البيانات.' 
                      : 'This role acts as a template. When choosing "Department" scope, the system uses the reference department ID assigned to the employee during hiring to filter data.'}
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50/30 border-b">
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (Ar)' : 'Role Name (AR)'}</Label>
                 <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 rounded-2xl border-2 font-bold shadow-inner" placeholder="مثال: مدير محاسبة" />
              </div>
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (En)' : 'Role Name (EN)'}</Label>
                 <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 font-bold text-start shadow-inner" dir="ltr" placeholder="e.g. Accounting Manager" />
              </div>
           </div>

           <div className="overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow>
                       <TableHead className="py-6 ps-8 w-[280px] text-start font-black">{isRtl ? 'المورد / الشاشة' : 'Module / Screen'}</TableHead>
                       <TableHead className="text-start font-black">{isRtl ? 'العمليات المتاحة والنطاق' : 'Granular Actions & Scopes'}</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {SYSTEM_RESOURCES.map((resource) => (
                       <TableRow key={resource.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100">
                          <TableCell className="py-8 ps-8">
                             <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/10">
                                   <LayoutGrid className="h-5 w-5" />
                                </div>
                                <div className="text-start">
                                   <p className="font-black text-slate-800 text-sm">{isRtl ? resource.labelAr : resource.labelEn}</p>
                                   <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-tighter border-slate-200 text-slate-400">
                                      {resource.module}
                                   </Badge>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell>
                             <div className="flex flex-wrap gap-6">
                                {resource.allowedActions.map((action) => {
                                   const currentScope = getScope(resource.id, action);
                                   const scopeInfo = SCOPES.find(s => s.value === currentScope);

                                   return (
                                     <div key={action} className="flex flex-col gap-2 min-w-[160px] text-start">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                           {isRtl ? ACTION_LABELS[action].ar : ACTION_LABELS[action].en}
                                        </span>
                                        <Select 
                                          value={currentScope} 
                                          onValueChange={(v: Scope) => setScope(resource.id, action, v)}
                                        >
                                           <SelectTrigger className={cn(
                                             "h-11 rounded-xl border-2 text-[10px] font-black transition-all",
                                             currentScope !== 'none' ? "border-primary/30 bg-primary/5 text-primary shadow-sm" : "bg-white border-slate-100"
                                           )}>
                                              <SelectValue>
                                                 <div className="flex items-center gap-2">
                                                    {scopeInfo?.icon && <scopeInfo.icon className={cn("h-3.5 w-3.5", scopeInfo.color)} />}
                                                    {scopeInfo?.label}
                                                 </div>
                                              </SelectValue>
                                           </SelectTrigger>
                                           <SelectContent className="rounded-2xl">
                                              {SCOPES.map(s => (
                                                 <SelectItem key={s.value} value={s.value} className="font-bold text-xs py-3">
                                                    <div className="flex flex-col gap-1">
                                                       <div className="flex items-center gap-2">
                                                          <s.icon className={cn("h-4 w-4", s.color)} /> {s.label}
                                                       </div>
                                                       <p className="text-[8px] text-slate-400 font-normal ps-6">{s.desc}</p>
                                                    </div>
                                                 </SelectItem>
                                              ))}
                                           </SelectContent>
                                        </Select>
                                     </div>
                                   );
                                })}
                             </div>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </div>

           <div className="p-10 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-start gap-4 max-w-md text-start">
                 <Building2 className="h-6 w-6 text-slate-300 shrink-0 mt-1" />
                 <div>
                    <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest">{isRtl ? 'دليل النطاقات (Scopes Guide)' : 'Scopes Guide'}</h5>
                    <p className="text-[10px] font-bold text-slate-400 leading-relaxed mt-1 italic">
                       {isRtl 
                         ? 'نطاق القسم (Dept) هو الأمان المرجعي؛ يمنع الموظف من رؤية بيانات أي قسم آخر بخلاف القسم المذكور في ملفه الوظيفي.' 
                         : 'Department scope is your safety net; it prevents employees from accessing data belonging to any other reference department.'}
                    </p>
                 </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                 <Button variant="outline" onClick={onClose} className="flex-1 md:w-32 h-16 rounded-[1.5rem] font-black border-2">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={loading}
                   className="flex-1 md:w-72 h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                 >
                    {loading ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
                    {isRtl ? 'حفظ قالب الصلاحيات' : 'Commit Template'}
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
