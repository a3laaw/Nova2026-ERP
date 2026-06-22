/**
 * @fileOverview واجهة مصفوفة الصلاحيات الديناميكية.
 * تولد الأعمدة والأفعال بناءً على كتالوج الموارد المحدث.
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
  Settings2, LayoutGrid, Globe, User, Users
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
        matrix: role.matrix || []
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

  const SCOPES: { value: Scope; label: string; icon: any }[] = [
    { value: 'none', label: isRtl ? 'محجوب' : 'None', icon: X },
    { value: 'own', label: isRtl ? 'خاص بالموظف' : 'Own Records', icon: User },
    { value: 'dept', label: isRtl ? 'القسم' : 'Department', icon: Users },
    { value: 'all', label: isRtl ? 'المنشأة كاملة' : 'Full Access', icon: Globe },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
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
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50/30 border-b">
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (Ar)' : 'Role Name (AR)'}</Label>
                 <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 rounded-2xl border-2 font-bold" placeholder="مثال: مدير محاسبة" />
              </div>
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (En)' : 'Role Name (EN)'}</Label>
                 <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 font-bold text-start" dir="ltr" placeholder="e.g. Accounting Manager" />
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
                       <TableRow key={resource.id} className="hover:bg-slate-50/50 transition-colors">
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
                                {resource.allowedActions.map((action) => (
                                   <div key={action} className="flex flex-col gap-2 min-w-[140px] text-start">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                         {isRtl ? ACTION_LABELS[action].ar : ACTION_LABELS[action].en}
                                      </span>
                                      <Select 
                                        value={getScope(resource.id, action)} 
                                        onValueChange={(v: Scope) => setScope(resource.id, action, v)}
                                      >
                                         <SelectTrigger className={cn(
                                           "h-10 rounded-xl border-2 text-[10px] font-black transition-all",
                                           getScope(resource.id, action) !== 'none' ? "border-primary/30 bg-primary/5 text-primary shadow-sm" : "bg-white border-slate-100"
                                         )}>
                                            <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent className="rounded-2xl">
                                            {SCOPES.map(s => (
                                               <SelectItem key={s.value} value={s.value} className="font-bold text-xs">
                                                  <div className="flex items-center gap-2">
                                                     <s.icon className="h-3.5 w-3.5" /> {s.label}
                                                  </div>
                                               </SelectItem>
                                            ))}
                                         </SelectContent>
                                      </Select>
                                   </div>
                                ))}
                             </div>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </div>

           <div className="p-10 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-start gap-3 max-w-md text-start">
                 <Settings2 className="h-5 w-5 text-slate-300 shrink-0 mt-1" />
                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">
                    * {isRtl 
                      ? 'يتم تطبيق الصلاحيات ديناميكياً بناءً على نوع المورد. الأفعال الظاهرة أعلاه هي فقط ما يدعمه الموديول برمجياً.' 
                      : 'Permissions are applied dynamically per resource. Actions shown are only those supported by the module logic.'}
                 </p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                 <Button variant="outline" onClick={onClose} className="flex-1 md:w-32 h-16 rounded-[1.5rem] font-black border-2">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={loading}
                   className="flex-1 md:w-72 h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                 >
                    {loading ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-6 w-6" />}
                    {isRtl ? 'حفظ الصلاحيات' : 'Commit Matrix'}
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
