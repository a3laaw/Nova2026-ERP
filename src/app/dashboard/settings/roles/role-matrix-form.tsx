/**
 * @fileOverview واجهة مصفوفة الصلاحيات المدمجة والعملية (Compact Matrix Form).
 * تم تطهير اللون الكحلي تماماً واستبداله بالهوية الفاتحة.
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
  Info, Shield
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

    const generatedPerms = currentMatrix.map((m: PermissionRule) => `${m.resourceId}:${m.action}`);
    
    setFormData({ 
      ...formData, 
      matrix: currentMatrix,
      permissions: Array.from(new Set(generatedPerms)) 
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.nameEn) {
      toast({ variant: "destructive", title: t('error') });
      return;
    }
    
    setLoading(true);
    try {
      const { id, ...saveData } = formData;
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
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const SCOPES: { value: Scope; label: string; icon: any; color: string }[] = [
    { value: 'none', label: t('scopeNone'), icon: X, color: 'text-slate-400' },
    { value: 'own', label: t('scopeOwn'), icon: User, color: 'text-blue-500' },
    { value: 'dept', label: t('scopeDept'), icon: Users, color: 'text-orange-500' },
    { value: 'all', label: t('scopeAll'), icon: Globe, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300 pb-10 text-start">
      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-primary/5 p-8 border-b flex flex-row items-center justify-between">
           <div className="flex items-center gap-4 text-start">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg border border-primary/10">
                 <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                 <CardTitle className="text-xl font-black font-headline text-slate-900">
                    {isRtl ? 'مصفوفة الصلاحيات الميدانية' : 'Permission Matrix'}
                 </CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure Access Levels</p>
              </div>
           </div>
           <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 hover:bg-white text-slate-300"><X className="h-6 w-6" /></Button>
        </CardHeader>
        
        <CardContent className="p-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50/50 border-b">
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')} (AR)</Label>
                 <Input 
                   value={formData.name} 
                   onChange={e => setFormData({...formData, name: e.target.value})} 
                   className="h-12 rounded-xl border-2 font-black text-lg bg-white shadow-inner" 
                 />
              </div>
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')} (EN)</Label>
                 <Input 
                   value={formData.nameEn} 
                   onChange={e => setFormData({...formData, nameEn: e.target.value})} 
                   className="h-12 rounded-xl border-2 font-black text-lg bg-white shadow-inner text-start" 
                   dir="ltr" 
                 />
              </div>
           </div>

           <div className="overflow-x-auto max-h-[60vh] scrollbar-hide">
              <Table>
                 <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b-2">
                    <TableRow className="hover:bg-slate-50 border-0">
                       <TableHead className="py-5 ps-10 w-[240px] text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'المورد' : 'Module'}</TableHead>
                       <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'العمليات والنطاق' : 'Actions & Scopes'}</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {SYSTEM_RESOURCES.map((resource) => (
                       <TableRow key={resource.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-100 group">
                          <TableCell className="py-6 ps-10 align-top">
                             <div className="flex items-center gap-4 text-start">
                                <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-primary shadow-sm group-hover:border-primary/20 transition-all">
                                   <LayoutGrid className="h-5 w-5" />
                                </div>
                                <div className="text-start">
                                   <p className="font-black text-slate-800 text-sm leading-none">{isRtl ? resource.labelAr : resource.labelEn}</p>
                                   <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest mt-1.5 border-slate-100 bg-white">
                                      {resource.module}
                                   </Badge>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="py-6 pe-10">
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {resource.allowedActions.map((action) => {
                                   const currentScope = getScope(resource.id, action);
                                   const scopeInfo = SCOPES.find(s => s.value === currentScope);

                                   return (
                                     <div key={action} className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border-2 border-slate-50 shadow-sm transition-all hover:border-primary/20">
                                        <div className="min-w-[50px] text-start">
                                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                              {isRtl ? ACTION_LABELS[action].ar : ACTION_LABELS[action].en}
                                           </span>
                                        </div>
                                        <Select 
                                          value={currentScope} 
                                          onValueChange={(v: Scope) => setScope(resource.id, action, v)}
                                        >
                                           <SelectTrigger className={cn(
                                             "h-9 rounded-xl border text-[10px] font-black transition-all flex-1 px-3",
                                             currentScope !== 'none' ? "border-primary/20 bg-primary/5 text-primary" : "bg-slate-50 border-slate-100 text-slate-300"
                                           )}>
                                              <SelectValue>
                                                 <div className="flex items-center gap-2">
                                                    {scopeInfo?.icon && <scopeInfo.icon className={cn("h-3 w-3", scopeInfo.color)} />}
                                                    <span className="truncate">{scopeInfo?.label}</span>
                                                 </div>
                                              </SelectValue>
                                           </SelectTrigger>
                                           <SelectContent className="rounded-xl border-0 shadow-3xl bg-white z-[200]">
                                              {SCOPES.map(s => (
                                                 <SelectItem key={s.value} value={s.value} className="font-bold text-[10px] py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                       <div className={cn("p-2 rounded-xl bg-slate-50", s.color)}>
                                                          <s.icon className="h-4 w-4" />
                                                       </div>
                                                       <span>{s.label}</span>
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

           <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-slate-400 bg-white px-6 py-3 rounded-2xl border-2 border-white shadow-sm">
                 <Shield className="h-5 w-5" />
                 <p className="text-[10px] font-bold italic leading-relaxed">{isRtl ? 'الأدمن يتمتع بصلاحية وصول مطلقة (N نجمة) لكافة الموارد تلقائياً.' : 'Admins have absolute wildcard access (*) to all resources automatically.'}</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                 <Button variant="outline" onClick={onClose} className="flex-1 md:w-40 h-14 rounded-2xl font-black text-base bg-white border-2">
                    {isRtl ? 'إغلاق بدون حفظ' : 'Cancel'}
                 </Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={loading}
                   className="flex-[2] md:w-72 h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-3 border-b-8 border-orange-700 hover:scale-[1.02] transition-all"
                 >
                    {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                    {t('save')}
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
