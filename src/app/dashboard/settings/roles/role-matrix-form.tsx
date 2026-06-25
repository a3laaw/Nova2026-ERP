
/**
 * @fileOverview واجهة مصفوفة الصلاحيات المدمجة والعملية (Compact Matrix Form).
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
      <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-primary/5 p-5 border-b flex flex-row items-center justify-between">
           <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <CardTitle className="text-lg font-black font-headline">
                 {isRtl ? 'مصفوفة الصلاحيات الميدانية' : 'Permission Matrix'}
              </CardTitle>
           </div>
           <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-white"><X className="h-4 w-4" /></Button>
        </CardHeader>
        
        <CardContent className="p-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/30 border-b">
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')} (AR)</Label>
                 <Input 
                   value={formData.name} 
                   onChange={e => setFormData({...formData, name: e.target.value})} 
                   className="h-10 rounded-lg border-2 font-bold text-sm bg-white" 
                 />
              </div>
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')} (EN)</Label>
                 <Input 
                   value={formData.nameEn} 
                   onChange={e => setFormData({...formData, nameEn: e.target.value})} 
                   className="h-10 rounded-lg border-2 font-bold text-sm bg-white" 
                   dir="ltr" 
                 />
              </div>
           </div>

           <div className="overflow-x-auto max-h-[60vh] scrollbar-hide">
              <Table>
                 <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                    <TableRow>
                       <TableHead className="py-4 ps-6 w-[200px] text-start font-black text-slate-900 uppercase text-[9px] tracking-widest">{isRtl ? 'المورد' : 'Module'}</TableHead>
                       <TableHead className="text-start font-black text-slate-900 uppercase text-[9px] tracking-widest">{isRtl ? 'العمليات والنطاق' : 'Actions & Scopes'}</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {SYSTEM_RESOURCES.map((resource) => (
                       <TableRow key={resource.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-100 group">
                          <TableCell className="py-5 ps-6 align-top">
                             <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm group-hover:border-primary/20 transition-all">
                                   <LayoutGrid className="h-4 w-4" />
                                </div>
                                <div className="text-start">
                                   <p className="font-bold text-slate-900 text-xs">{isRtl ? resource.labelAr : resource.labelEn}</p>
                                   <span className="text-[7px] font-black uppercase tracking-tighter text-slate-300">
                                      {resource.module}
                                   </span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="py-5 pe-6">
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {resource.allowedActions.map((action) => {
                                   const currentScope = getScope(resource.id, action);
                                   const scopeInfo = SCOPES.find(s => s.value === currentScope);

                                   return (
                                     <div key={action} className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm">
                                        <div className="min-w-[40px] text-start">
                                           <span className="text-[8px] font-black text-slate-400 uppercase">
                                              {isRtl ? ACTION_LABELS[action].ar : ACTION_LABELS[action].en}
                                           </span>
                                        </div>
                                        <Select 
                                          value={currentScope} 
                                          onValueChange={(v: Scope) => setScope(resource.id, action, v)}
                                        >
                                           <SelectTrigger className={cn(
                                             "h-8 rounded-md border text-[9px] font-black transition-all flex-1 px-2",
                                             currentScope !== 'none' ? "border-primary/20 bg-primary/5 text-primary" : "bg-white border-slate-100 text-slate-300"
                                           )}>
                                              <SelectValue>
                                                 <div className="flex items-center gap-1.5">
                                                    {scopeInfo?.icon && <scopeInfo.icon className={cn("h-2.5 w-2.5", scopeInfo.color)} />}
                                                    <span className="truncate">{scopeInfo?.label}</span>
                                                 </div>
                                              </SelectValue>
                                           </SelectTrigger>
                                           <SelectContent className="rounded-xl border-0 shadow-2xl bg-white">
                                              {SCOPES.map(s => (
                                                 <SelectItem key={s.value} value={s.value} className="font-bold text-[10px] py-2 px-3">
                                                    <div className="flex items-center gap-2">
                                                       <div className={cn("p-1 rounded-md bg-slate-50", s.color)}>
                                                          <s.icon className="h-3 w-3" />
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

           <div className="p-6 bg-slate-50 border-t flex justify-end">
              <div className="flex gap-3 w-full md:w-auto">
                 <Button variant="outline" onClick={onClose} className="flex-1 md:w-32 h-11 rounded-xl font-bold text-xs bg-white">
                    {t('logout')}
                 </Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={loading}
                   className="flex-1 md:w-64 h-11 rounded-xl bg-primary text-white font-black text-sm shadow-lg gap-2 border-b-4 border-orange-700"
                 >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {t('save')}
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
