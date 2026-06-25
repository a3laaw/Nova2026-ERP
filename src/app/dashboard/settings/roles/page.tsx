
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, Plus, Loader2, Edit3, 
  Search, Wand2, Users, ChevronLeft, ChevronRight,
  MoreVertical, Briefcase, Eye, Trash2, Info, Lock
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
import { useRouter } from 'next/navigation';

export default function RolesManagerPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, isAdmin, isLoading } = usePermissions(); 
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      // Redirect handled by permissions
    }
  }, [isLoading, isAdmin, router]);

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

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary/30" /></div>;

  if (!isAdmin) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 text-center">
         <div className="h-20 w-20 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shadow-inner">
            <Lock className="h-10 w-10" />
         </div>
         <div>
            <h2 className="text-xl font-black text-slate-800">{isRtl ? 'صلاحيات إدارية مطلوبة' : 'Admin Access Required'}</h2>
            <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto mt-1">
              {isRtl ? 'لا تملك تصريحاً كافياً للتحكم في مصفوفة الأدوار.' : 'Insufficient permissions to manage roles.'}
            </p>
         </div>
         <Button onClick={() => router.push('/dashboard')} variant="outline" className="rounded-xl px-8 h-10 text-xs">
           {isRtl ? 'العودة للرئيسية' : 'Back to Dashboard'}
         </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-2xl font-black font-headline flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-8 w-8 text-primary" />
            {isRtl ? 'إدارة الصلاحيات' : 'Roles & Permissions'}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-[10px] font-bold opacity-80 uppercase tracking-widest">
            {isRtl ? 'تعيين حدود الوصول وتوزيع المسؤوليات' : 'Access Control & Responsibility Matrix'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
             <CardHeader className="bg-slate-50/50 border-b p-4 text-start">
                <CardTitle className="text-sm font-black">{isRtl ? 'قوالب الصلاحيات' : 'Templates'}</CardTitle>
                <div className="relative mt-3">
                   <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                   <Input 
                     placeholder={t('search')} 
                     className="ps-8 rounded-lg h-9 bg-white text-[10px] border-slate-200" 
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                   />
                </div>
             </CardHeader>
             <CardContent className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
                {loading ? <div className="p-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/20" /></div> : (
                  <>
                    {filteredRoles.map((role) => (
                      <div 
                        key={role.id}
                        onClick={() => { setSelectedRole(role); setIsAddingNew(false); }}
                        className={cn(
                          "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group border-2 border-transparent",
                          selectedRole?.id === role.id 
                            ? "bg-primary/5 border-primary/10" 
                            : "hover:bg-slate-50"
                        )}
                      >
                         <div className="text-start">
                            <p className={cn("font-bold text-xs transition-colors", selectedRole?.id === role.id ? "text-primary" : "text-slate-700")}>
                               {isRtl ? role.name : role.nameEn}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                               <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-tighter">
                                  {role.code}
                               </span>
                            </div>
                         </div>
                         <div className={cn(
                           "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                           selectedRole?.id === role.id ? "bg-primary text-white" : "bg-slate-100 text-slate-300 opacity-0 group-hover:opacity-100"
                         )}>
                            {selectedRole?.id === role.id ? <ChevronLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Eye className="h-3.5 w-3.5" />}
                         </div>
                      </div>
                    ))}
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => { setSelectedRole(null); setIsAddingNew(true); }}
                      className="w-full mt-3 h-10 rounded-xl border-2 border-dashed border-slate-100 text-slate-300 hover:text-primary hover:border-primary/20 hover:bg-primary/5 font-bold text-[10px] gap-2"
                    >
                       <Plus className="h-3.5 w-3.5" /> {isRtl ? 'قالب جديد' : 'New Role'}
                    </Button>
                  </>
                )}
             </CardContent>
          </Card>

          <Card className="border-0 shadow-md rounded-2xl bg-blue-50/50 p-4 text-start border-l-4 border-l-blue-400">
             <div className="flex items-center gap-2 mb-2 text-blue-600">
                <Info className="h-4 w-4" />
                <h4 className="font-black text-[9px] uppercase tracking-widest">{isRtl ? 'دليل الربط' : 'Guide'}</h4>
             </div>
             <p className="text-[9px] font-bold text-blue-700/60 leading-relaxed">
                {isRtl 
                  ? 'يتم ربط القالب بالموظف عبر (الهيكل التنظيمي -> تعديل الوظيفة).' 
                  : 'Link template via (Org Structure -> Edit Job).'}
             </p>
          </Card>
        </div>

        <div className="lg:col-span-9">
           {selectedRole || isAddingNew ? (
             <RoleMatrixForm 
               role={selectedRole} 
               onClose={() => { setSelectedRole(null); setIsAddingNew(false); }}
               roleService={roleService!} 
             />
           ) : (
             <Card className="border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30 p-20 flex flex-col items-center justify-center text-center opacity-40">
                <ShieldCheck className="h-12 w-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-400">{isRtl ? 'اختر دوراً للتعديل' : 'Select a role to edit'}</h3>
             </Card>
           )}
        </div>

      </div>
    </div>
  );
}
