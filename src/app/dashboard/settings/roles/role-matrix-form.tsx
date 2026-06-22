
/**
 * @fileOverview واجهة مصفوفة الصلاحيات الذكية المطورة.
 * تم إصلاح خطأ الحفظ عبر مزامنة مصفوفة الصلاحيات (Matrix) مع الـ Permissions النصية آلياً.
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
  LayoutGrid, Globe, User, Users,
  Info
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { Role } from '@/types/roles';
import { RoleService } from '@/services/role-service';
import { SYSTEM_RESOURCES, ACTION_LABELS } from '@/lib/permissions/catalog';
import { Action, Scope, PermissionRule } from '@/lib/permissions/types';
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
  
  // حالة الفورم مع ضمان تهيئة المصفوفة
  const [formData, setFormData] = useState<any>({ 
    name: '', 
    nameEn: '', 
    matrix: [], 
    permissions: [] 
  });

  useEffect(() => {
    if (role) {
      setFormData({
        ...role,
        matrix: (role as any).matrix || [],
        permissions: role.permissions || []
      });
    } else {
      setFormData({ name: '', nameEn: '', matrix: [], permissions: [] });
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

    // توليد مصفوفة الصلاحيات الكلاسيكية (String-based) لضمان توافق الخدمات القديمة
    const generatedPerms = currentMatrix.map((m: PermissionRule) => `${m.resourceId}:${m.action}`);
    
    setFormData({ 
      ...formData, 
      matrix: currentMatrix,
      permissions: Array.from(new Set(generatedPerms)) 
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.nameEn) {
      toast({ variant: "destructive", title: isRtl ? "اسم الدور مطلوب" : "Role name is required" });
      return;
    }
    
    setLoading(true);
    try {
      // إزالة حقل ID من بيانات الحفظ إذا كان موجوداً لتجنب مشاكل Firestore
      const { id, ...saveData } = formData;

      // التأكد من وجود مصفوفة نصية للصلاحيات حتى في الأدوار الجديدة
      if (!saveData.permissions) {
        saveData.permissions = saveData.matrix?.map((m: PermissionRule) => `${m.resourceId}:${m.action}`) || [];
      }

      if (role?.id) {
        await roleService.updateRole(role.id, saveData);
      } else {
        const code = formData.nameEn.toUpperCase().replace(/\s+/g, '_');
        await roleService.addRole({ 
          ...saveData, 
          code, 
          isActive: true, 
          isSystemRole: false, 
          order: 10 
        });
      }
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      console.error("Save Error:", e);
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const SCOPES: { value: Scope; label: string; icon: any; color: string; desc: string }[] = [
    { value: 'none', label: isRtl ? 'محجوب' : 'None', icon: X, color: 'text-slate-400', desc: isRtl ? 'لا يوجد وصول.' : 'No access.' },
    { value: 'own', label: isRtl ? 'الموظف' : 'Own', icon: User, color: 'text-blue-500', desc: isRtl ? 'سجلاته فقط.' : 'Own records.' },
    { value: 'dept', label: isRtl ? 'القسم' : 'Dept', icon: Users, color: 'text-orange-500', desc: isRtl ? 'سجلات قسمه.' : 'Dept records.' },
    { value: 'all', label: isRtl ? 'المنشأة' : 'All', icon: Globe, color: 'text-emerald-500', desc: isRtl ? 'كل البيانات.' : 'All data.' },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-primary/5 p-8 border-b flex flex-row items-center justify-between">
           <div className="text-start">
              <CardTitle className="text-2xl font-black font-headline flex items-center gap-3">
                 <ShieldCheck className="h-8 w-8 text-primary" />
                 {isRtl ? 'مصفوفة الصلاحيات الميدانية' : 'Field Permission Matrix'}
              </CardTitle>
              <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
                {isRtl ? 'تحكم في الأفعال ونطاق الوصول لكل موديول' : 'Control actions and scopes per module'}
              </p>
           </div>
           <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 hover:bg-white"><X className="h-6 w-6" /></Button>
        </CardHeader>
        
        <CardContent className="p-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50/50 border-b">
              <div className="space-y-3 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (AR)' : 'Role Name (AR)'}</Label>
                 <Input 
                   value={formData.name} 
                   onChange={e => setFormData({...formData, name: e.target.value})} 
                   className="h-14 rounded-2xl border-2 font-black text-lg bg-white" 
                 />
              </div>
              <div className="space-y-3 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (EN)' : 'Role Name (EN)'}</Label>
                 <Input 
                   value={formData.nameEn} 
                   onChange={e => setFormData({...formData, nameEn: e.target.value})} 
                   className="h-14 rounded-2xl border-2 font-black text-lg bg-white text-start" 
                   dir="ltr" 
                 />
              </div>
           </div>

           <div className="overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/80">
                    <TableRow>
                       <TableHead className="py-6 ps-10 w-[240px] text-start font-black text-[#1e1b4b] uppercase text-[10px] tracking-widest">{isRtl ? 'المورد / الشاشة' : 'Module / Screen'}</TableHead>
                       <TableHead className="text-start font-black text-[#1e1b4b] uppercase text-[10px] tracking-widest">{isRtl ? 'العمليات المتاحة والنطاق' : 'Available Actions & Scopes'}</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {SYSTEM_RESOURCES.map((resource) => (
                       <TableRow key={resource.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group">
                          <TableCell className="py-8 ps-10 align-top">
                             <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center text-primary shadow-sm group-hover:border-primary/20 transition-all">
                                   <LayoutGrid className="h-6 w-6" />
                                </div>
                                <div className="text-start">
                                   <p className="font-black text-slate-900 text-base">{isRtl ? resource.labelAr : resource.labelEn}</p>
                                   <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-tighter bg-slate-100 text-slate-400 border-0 mt-1">
                                      {resource.module}
                                   </Badge>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="py-8 pe-10">
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {resource.allowedActions.map((action) => {
                                   const currentScope = getScope(resource.id, action);
                                   const scopeInfo = SCOPES.find(s => s.value === currentScope);

                                   return (
                                     <div key={action} className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border-2 border-slate-50 shadow-sm hover:border-primary/10 transition-all">
                                        <div className="min-w-[50px] text-start">
                                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                              {isRtl ? ACTION_LABELS[action].ar : ACTION_LABELS[action].en}
                                           </span>
                                        </div>
                                        <Select 
                                          value={currentScope} 
                                          onValueChange={(v: Scope) => setScope(resource.id, action, v)}
                                        >
                                           <SelectTrigger className={cn(
                                             "h-10 rounded-xl border-2 text-[10px] font-black transition-all flex-1",
                                             currentScope !== 'none' ? "border-primary/30 bg-primary/5 text-primary" : "bg-white border-slate-100 text-slate-400"
                                           )}>
                                              <SelectValue>
                                                 <div className="flex items-center gap-2">
                                                    {scopeInfo?.icon && <scopeInfo.icon className={cn("h-3 w-3", scopeInfo.color)} />}
                                                    <span className="truncate">{scopeInfo?.label}</span>
                                                 </div>
                                              </SelectValue>
                                           </SelectTrigger>
                                           <SelectContent className="rounded-2xl border-0 shadow-2xl">
                                              {SCOPES.map(s => (
                                                 <SelectItem key={s.value} value={s.value} className="font-bold text-xs py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                       <div className={cn("p-1.5 rounded-lg bg-slate-50", s.color)}>
                                                          <s.icon className="h-3.5 w-3.5" />
                                                       </div>
                                                       <div className="flex flex-col">
                                                          <span className="font-black">{s.label}</span>
                                                          <span className="text-[8px] text-slate-400 font-normal">{s.desc}</span>
                                                       </div>
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

           <div className="p-10 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-start gap-4 max-w-lg text-start">
                 <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 mt-1 shadow-sm border border-blue-100">
                    <Info className="h-5 w-5" />
                 </div>
                 <div className="space-y-1">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest">{isRtl ? 'دليل نطاق البيانات (Scope)' : 'Data Scope Guide'}</h5>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                       {isRtl 
                         ? 'يتم ربط الصلاحيات آلياً بمعرفات الأقسام والموظفين القادمة من مركز المراجع لضمان عزل البيانات.' 
                         : 'Permissions are automatically linked to Dept and Emp IDs from Reference Hub.'}
                    </p>
                 </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                 <Button variant="outline" onClick={onClose} className="flex-1 md:w-40 h-16 rounded-[1.5rem] font-black border-2 border-slate-200 bg-white">
                    {isRtl ? 'إلغاء' : 'Cancel'}
                 </Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={loading}
                   className="flex-1 md:w-80 h-16 rounded-[1.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-3 border-b-8 border-orange-700"
                 >
                    {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                    {isRtl ? 'حفظ إعدادات الصلاحيات' : 'Commit Changes'}
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
