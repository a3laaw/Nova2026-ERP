'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, Plus, Loader2, Trash2, Edit3, 
  Search, ShieldAlert, CheckCircle2, MoreHorizontal,
  Wand2, DatabaseZap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { RoleService } from '@/services/role-service';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Role } from '@/types/roles';
import { RoleForm } from './role-form';

export default function RolesManagerPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [searchTerm, setSearchTerm] = useState("");
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const roleService = useMemo(() => db && companyId ? new RoleService(db, companyId) : null, [db, companyId]);
  const rolesQuery = useMemo(() => companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, [db, companyId]);
  const { data: roles, loading } = useCollection<Role>(rolesQuery);

  const handleRunSeed = async () => {
    if (!roleService) return;
    setSeeding(true);
    try {
      await roleService.seedInitialRoles();
      toast({ title: isRtl ? "تم ضخ الأدوار" : "Roles Seeded" });
    } finally {
      setSeeding(false);
    }
  };

  const filteredRoles = roles?.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            {isRtl ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة هياكل الوصول وتوزيع المسؤوليات داخل المنشأة' : 'Manage access structures and responsibilities'}
          </p>
        </div>

        <div className="flex gap-3">
           {!roles?.length && !loading && (
             <Button onClick={handleRunSeed} disabled={seeding} variant="outline" className="rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5">
                {seeding ? <Loader2 className="animate-spin me-2" /> : <Wand2 className="me-2 h-4 w-4" />}
                {isRtl ? 'ضخ الأدوار الأساسية' : 'Seed Basic Roles'}
             </Button>
           )}
           <Button onClick={() => { setEditingRole(null); setIsFormOpen(true); }} className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
             <Plus className="me-2 h-6 w-6" />
             {isRtl ? 'دور جديد' : 'New Role'}
           </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder={isRtl ? 'بحث في الأدوار...' : 'Search roles...'} 
          className="ps-12 rounded-2xl h-14 bg-white text-start border-2 border-slate-100" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-[2.5rem] bg-white overflow-hidden group">
              <div className="h-2 w-full bg-slate-50 group-hover:bg-primary transition-colors" />
              <CardHeader className="p-8 pb-4 flex flex-row justify-between items-start">
                <div className="text-start">
                  <div className="flex items-center gap-2 mb-2">
                     <Badge variant="outline" className="font-mono text-[10px] text-slate-400">{role.code}</Badge>
                     {role.isSystemRole && <Badge className="bg-blue-50 text-blue-600 border-0 text-[8px] font-black uppercase">System</Badge>}
                  </div>
                  <CardTitle className="text-2xl font-black font-headline">{role.name}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setEditingRole(role); setIsFormOpen(true); }} className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                   <Edit3 className="h-5 w-5 text-blue-600" />
                </Button>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-6 text-start">
                <p className="text-muted-foreground text-xs font-bold leading-relaxed line-clamp-2 h-8">
                  {role.description || '...'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                   {role.permissions[0] === '*' ? (
                     <Badge className="bg-emerald-500 text-white font-black px-3 py-1">صلاحيات كاملة (FULL ACCESS)</Badge>
                   ) : (
                     role.permissions.slice(0, 3).map(p => (
                       <Badge key={p} variant="secondary" className="bg-slate-100 text-slate-500 text-[9px] font-bold">{p}</Badge>
                     ))
                   )}
                   {role.permissions.length > 3 && role.permissions[0] !== '*' && (
                     <Badge variant="outline" className="text-[9px] font-bold text-slate-300">+{role.permissions.length - 3}</Badge>
                   )}
                </div>
                <div className="pt-6 border-t flex justify-between items-center">
                   <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", role.isActive ? "bg-emerald-500 shadow-lg shadow-emerald-200" : "bg-slate-300")} />
                      <span className="text-[10px] font-black uppercase text-slate-400">{role.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Disabled')}</span>
                   </div>
                   <Button variant="ghost" size="sm" onClick={() => roleService?.deleteRole(role.id!)} disabled={role.isSystemRole} className="text-destructive hover:bg-destructive/5 font-black text-xs">
                     {isRtl ? 'حذف الدور' : 'Delete'}
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* نموذج الإضافة/التعديل */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-4xl p-0 overflow-hidden border-0 shadow-2xl">
          <RoleForm 
            role={editingRole} 
            onClose={() => setIsFormOpen(false)} 
            roleService={roleService!} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
