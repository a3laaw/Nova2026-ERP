'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, Plus, Loader2, Edit3, 
  Search, Wand2, Users, ChevronLeft, ChevronRight,
  MoreVertical, Briefcase, Eye, Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { RoleService } from '@/services/role-service';
import { cn } from '@/lib/utils';
import { Role } from '@/types/roles';
import { RoleMatrixForm } from './role-matrix-form';

export default function RolesManagerPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const roleService = useMemo(() => 
    db && companyId ? new RoleService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const rolesQuery = useMemo(() => companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, [db, companyId]);
  const { data: roles, loading } = useCollection<Role>(rolesQuery);

  const filteredRoles = roles?.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleRunSeed = async () => {
    if (!roleService) return;
    setSeeding(true);
    try {
      await roleService.seedInitialRoles();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            {isRtl ? 'إدارة الأدوار والصلاحيات' : 'Roles & Permissions Management'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'تعيين حدود الوصول وتوزيع المسؤوليات على فريق العمل' : 'Assign access limits and distribute responsibilities'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
             <CardHeader className="bg-slate-50/50 border-b p-6 text-start">
                <CardTitle className="text-lg font-black">{isRtl ? 'الأدوار الحالية' : 'Current Roles'}</CardTitle>
                <div className="relative mt-4">
                   <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                   <Input 
                     placeholder={t('search')} 
                     className="ps-9 rounded-xl h-10 bg-white text-xs" 
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                   />
                </div>
             </CardHeader>
             <CardContent className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
                {loading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div> : (
                  <>
                    {filteredRoles.map((role) => (
                      <div 
                        key={role.id}
                        onClick={() => { setSelectedRole(role); setIsAddingNew(false); }}
                        className={cn(
                          "p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between group border-2 border-transparent",
                          selectedRole?.id === role.id 
                            ? "bg-primary/5 border-primary/20 shadow-sm" 
                            : "hover:bg-slate-50"
                        )}
                      >
                         <div className="text-start">
                            <p className={cn("font-black text-sm transition-colors", selectedRole?.id === role.id ? "text-primary" : "text-slate-700")}>
                               {isRtl ? role.name : role.nameEn}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                  {isRtl ? role.nameEn : role.name}
                               </span>
                               <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-slate-200 text-slate-400 font-bold">
                                  {role.permissions.includes('*') ? 'Admin' : `${role.permissions.length} perms`}
                                </Badge>
                            </div>
                         </div>
                         <div className={cn(
                           "h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-sm",
                           selectedRole?.id === role.id ? "bg-primary text-white" : "bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100"
                         )}>
                            {selectedRole?.id === role.id ? <ChevronLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Eye className="h-4 w-4" />}
                         </div>
                      </div>
                    ))}
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => { setSelectedRole(null); setIsAddingNew(true); }}
                      className="w-full mt-4 h-12 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary/40 hover:text-primary hover:bg-primary/5 font-black text-xs gap-2"
                    >
                       <Plus className="h-4 w-4" /> {isRtl ? 'إضافة دور جديد' : 'Add New Role'}
                    </Button>
                  </>
                )}
             </CardContent>
          </Card>

          {!roles?.length && !loading && (
             <Button onClick={handleRunSeed} disabled={seeding} className="w-full h-16 rounded-[2rem] bg-slate-900 text-white font-black text-xs shadow-xl gap-2">
                {seeding ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                {isRtl ? 'ضخ الأدوار الأساسية' : 'Seed Default Roles'}
             </Button>
          )}
        </div>

        <div className="lg:col-span-9">
           {selectedRole || isAddingNew ? (
             <RoleMatrixForm 
               role={selectedRole} 
               onClose={() => { setSelectedRole(null); setIsAddingNew(false); }}
               roleService={roleService!} 
             />
           ) : (
             <Card className="border-4 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50 p-20 flex flex-col items-center justify-center text-center">
                <div className="h-24 w-24 bg-white rounded-[2rem] flex items-center justify-center text-slate-200 shadow-sm mb-6">
                   <ShieldCheck className="h-12 w-12" />
                </div>
                <h3 className="text-xl font-black text-slate-400">{isRtl ? 'يرجى اختيار دور وظيفي للتعديل' : 'Select a role to edit permissions'}</h3>
                <p className="text-sm text-slate-300 font-bold mt-2 max-w-xs">{isRtl ? 'أو قم بإنشاء دور جديد من القائمة الجانبية.' : 'Or create a new role from the sidebar menu.'}</p>
             </Card>
           )}
        </div>

      </div>
    </div>
  );
}
