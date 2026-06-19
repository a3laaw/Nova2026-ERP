'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShieldCheck, Save, X, Info, 
  Loader2, CheckCircle2, SlidersHorizontal,
  LayoutGrid
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { Role } from '@/types/roles';
import { RoleService } from '@/services/role-service';
import { MATRIX_MODULES } from './permissions-list';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Props {
  role: Role | null;
  onClose: () => void;
  roleService: RoleService;
}

export function RoleMatrixForm({ role, onClose, roleService }: Props) {
  const { lang, dir, t } = useLanguage();
  const isRtl = lang === 'ar';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Role>>({ 
    name: '', nameEn: '', description: '', permissions: [], isActive: true, order: 10 
  });

  useEffect(() => {
    if (role) setFormData(role);
    else setFormData({ name: '', nameEn: '', description: '', permissions: [], isActive: true, order: 10 });
  }, [role]);

  const togglePermission = (code: string) => {
    if (!code) return;
    const current = formData.permissions || [];
    const updated = current.includes(code) 
      ? current.filter(c => c !== code) 
      : [...current, code];
    setFormData({ ...formData, permissions: updated });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allCodes = MATRIX_MODULES.flatMap(m => Object.values(m.actions).filter(Boolean));
      setFormData({ ...formData, permissions: allCodes });
    } else {
      setFormData({ ...formData, permissions: [] });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.nameEn) {
        toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Data" });
        return;
    }
    setLoading(true);
    try {
      if (role?.id) {
        await roleService.updateRole(role.id, formData);
      } else {
        const internalCode = formData.nameEn!.toUpperCase().replace(/\s+/g, '_');
        await roleService.addRole({ ...formData, code: internalCode } as any);
      }
      toast({ title: t('saved') });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (code: string) => formData.permissions?.includes(code);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-primary/5 p-8 border-b">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                    <SlidersHorizontal className="h-6 w-6" />
                 </div>
                 <div className="text-start">
                    <h2 className="text-2xl font-black font-headline">
                       {isRtl ? 'مصفوفة الصلاحيات:' : 'Permissions Matrix:'} <span className="text-primary">{isRtl ? formData.name : formData.nameEn || '...'}</span>
                    </h2>
                    <p className="text-xs font-bold text-muted-foreground opacity-70">
                       {isRtl ? 'تعديل صلاحيات الوصول لكل وحدة برمجية' : 'Modify access permissions for each module'}
                    </p>
                 </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-primary/10">
                 <Checkbox 
                   id="select-all" 
                   checked={formData.permissions?.length === MATRIX_MODULES.flatMap(m => Object.values(m.actions).filter(Boolean)).length}
                   onCheckedChange={handleSelectAll}
                 />
                 <Label htmlFor="select-all" className="text-xs font-black cursor-pointer">{isRtl ? 'تفعيل الكل' : 'Select All'}</Label>
              </div>
           </div>
        </CardHeader>
        
        <CardContent className="p-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 border-b bg-slate-50/30">
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (عربي)' : 'Role Name (AR)'}</Label>
                 <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
              </div>
              <div className="space-y-2 text-start">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الدور (English)' : 'Role Name (EN)'}</Label>
                 <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} className="h-12 rounded-xl border-2 font-bold" dir="ltr" />
              </div>
           </div>

           <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-start font-black py-6 ps-8 w-[250px]">{isRtl ? 'اسم الوحدة' : 'Module Name'}</TableHead>
                    <TableHead className="text-center font-black">{isRtl ? 'عرض' : 'View'}</TableHead>
                    <TableHead className="text-center font-black">{isRtl ? 'إضافة' : 'Add'}</TableHead>
                    <TableHead className="text-center font-black">{isRtl ? 'تعديل' : 'Edit'}</TableHead>
                    <TableHead className="text-center font-black">{isRtl ? 'حذف' : 'Delete'}</TableHead>
                    <TableHead className="text-center font-black pe-8">{isRtl ? 'ميزات متقدمة' : 'Advanced'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MATRIX_MODULES.map((module) => (
                    <TableRow key={module.id} className="hover:bg-primary/5 transition-colors border-b-slate-100">
                      <TableCell className="py-6 ps-8 text-start">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                               <LayoutGrid className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                               <span className="font-black text-slate-800 text-sm">{isRtl ? module.label : module.labelEn}</span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">({module.id})</span>
                            </div>
                         </div>
                      </TableCell>
                      
                      {['view', 'create', 'edit', 'delete', 'advanced'].map((action) => (
                        <TableCell key={action} className="text-center">
                           {module.actions[action as keyof typeof module.actions] ? (
                             <Checkbox 
                               checked={isSelected(module.actions[action as keyof typeof module.actions])}
                               onCheckedChange={() => togglePermission(module.actions[action as keyof typeof module.actions])}
                               className="h-5 w-5 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                             />
                           ) : (
                             <div className="h-5 w-5 mx-auto bg-slate-50 rounded border-2 border-slate-100 opacity-20" />
                           )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </div>

           <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-[10px] font-bold text-slate-400 max-w-md text-start leading-relaxed">
                 * {isRtl 
                   ? 'الميزات المتقدمة تشمل تصدير البيانات، الوصول إلى الأرشيف، وتغيير الأكواد المرجعية والسياسات العامة للوحدة برمجياً.' 
                   : 'Advanced features include data export, archive access, and modifying reference codes and general module policies.'}
              </p>
              <div className="flex gap-4 w-full md:w-auto">
                 <Button variant="outline" onClick={onClose} className="flex-1 md:w-32 h-14 rounded-2xl font-black border-2">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={loading}
                   className="flex-1 md:w-64 h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                 >
                    {loading ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
                    {isRtl ? 'حفظ التغييرات' : 'Save Changes'}
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
