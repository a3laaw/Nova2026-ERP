'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, Save, X, Info, 
  Loader2, Lock, CheckCircle2, ChevronRight
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { Role } from '@/types/roles';
import { RoleService } from '@/services/role-service';
import { AVAILABLE_PERMISSIONS } from './permissions-list';
import { cn } from '@/lib/utils';

interface Props {
  role: Role | null;
  onClose: () => void;
  roleService: RoleService;
}

export function RoleForm({ role, onClose, roleService }: Props) {
  const { lang, dir } = useLanguage();
  const isRtl = lang === 'ar';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Role>>(
    role || { 
      code: '', name: '', description: '', permissions: [], 
      isActive: true, isSystemRole: false, order: 10 
    }
  );

  const togglePermission = (code: string) => {
    const current = formData.permissions || [];
    const updated = current.includes(code) 
      ? current.filter(c => c !== code) 
      : [...current, code];
    setFormData({ ...formData, permissions: updated });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) return;
    setLoading(true);
    try {
      if (role?.id) {
        await roleService.updateRole(role.id, formData);
      } else {
        await roleService.addRole(formData as any);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] bg-white" dir={dir}>
      <div className="p-8 border-b bg-primary/5 flex justify-between items-center shrink-0">
        <div className="text-start">
          <h2 className="text-2xl font-black font-headline flex items-center gap-3">
             <ShieldCheck className="h-7 w-7 text-primary" />
             {role ? (isRtl ? 'تعديل دور' : 'Edit Role') : (isRtl ? 'إضافة دور جديد' : 'New Role')}
          </h2>
          <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
            {isRtl ? 'تحديد نطاق الوصول وصلاحيات العمل' : 'Define access scope and work permissions'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white">
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* الحقول الأساسية */}
        <div className="lg:col-span-4 p-8 space-y-6 border-e overflow-y-auto">
          <div className="space-y-4 text-start">
             <div className="space-y-2">
                <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{isRtl ? 'كود الدور (Code)' : 'Role Code'}</Label>
                <Input 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  placeholder="EX: ENGINEER"
                  className="h-12 rounded-xl font-mono text-sm"
                  disabled={!!role?.isSystemRole}
                />
             </div>
             <div className="space-y-2">
                <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{isRtl ? 'اسم الدور' : 'Role Name'}</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="h-12 rounded-xl font-bold"
                />
             </div>
             <div className="space-y-2">
                <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{isRtl ? 'الوصف' : 'Description'}</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="min-h-[100px] rounded-xl text-sm"
                />
             </div>
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                <div className="space-y-0.5">
                   <Label className="font-black text-sm">{isRtl ? 'حالة الدور' : 'Role Status'}</Label>
                   <p className="text-[10px] text-muted-foreground font-bold">{isRtl ? 'تفعيل أو تعطيل هذا الدور للموظفين' : 'Enable or disable this role'}</p>
                </div>
                <Switch 
                  checked={formData.isActive} 
                  onCheckedChange={v => setFormData({...formData, isActive: v})}
                />
             </div>
          </div>
        </div>

        {/* مصفوفة الصلاحيات */}
        <div className="lg:col-span-8 bg-slate-50/30 overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-white/50 backdrop-blur-sm flex justify-between items-center">
             <h3 className="font-black text-lg flex items-center gap-2">
               <Lock className="h-5 w-5 text-slate-400" />
               {isRtl ? 'مصفوفة الصلاحيات' : 'Permissions Matrix'}
             </h3>
             <Badge variant="outline" className="font-black bg-white">
               {formData.permissions?.length || 0} {isRtl ? 'صلاحية مختارة' : 'Selected'}
             </Badge>
          </div>
          
          <ScrollArea className="flex-1 p-8">
             <div className="space-y-10">
                {AVAILABLE_PERMISSIONS.map(group => (
                  <div key={group.id} className="space-y-4">
                    <h4 className="font-black text-sm text-primary uppercase tracking-widest border-s-4 border-primary ps-3">
                      {isRtl ? group.label : group.labelEn}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.permissions.map(perm => (
                        <div 
                          key={perm.code} 
                          onClick={() => togglePermission(perm.code)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                            formData.permissions?.includes(perm.code)
                              ? "bg-white border-primary/20 shadow-md ring-1 ring-primary/5"
                              : "bg-transparent border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className="text-start">
                             <p className={cn("font-black text-sm", formData.permissions?.includes(perm.code) ? "text-slate-900" : "text-slate-500")}>
                               {isRtl ? perm.label : perm.labelEn}
                             </p>
                             <p className="text-[9px] font-mono text-slate-300 group-hover:text-primary transition-colors">{perm.code}</p>
                          </div>
                          <Checkbox 
                            checked={formData.permissions?.includes(perm.code)}
                            className="h-5 w-5 pointer-events-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
             </div>
          </ScrollArea>
        </div>
      </div>

      <div className="p-8 border-t bg-slate-50 flex justify-end shrink-0">
         <Button 
           onClick={handleSave} 
           disabled={loading}
           className="h-14 rounded-2xl px-12 bg-primary font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
         >
           {loading ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
           {isRtl ? 'حفظ إعدادات الدور' : 'Save Role Settings'}
         </Button>
      </div>
    </div>
  );
}
