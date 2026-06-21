
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Loader2, Edit3, 
  Search, ShieldCheck, Mail, ArrowRight,
  UserCircle, Ban, CheckCircle2, UserCog,
  ShieldAlert, UserPlus, Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { UserService } from '@/services/user-service';
import { Role } from '@/types/roles';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function UsersManagementPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const userService = useMemo(() => 
    db && companyId ? new UserService(db, companyId) : null, 
  [db, companyId]);

  const usersQuery = useMemo(() => 
    companyId && db ? query(collection(db, 'companies', companyId, 'users')) : null, 
  [db, companyId]);
  
  const rolesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: users, loading: usersLoading } = useCollection(usersQuery);
  const { data: roles } = useCollection<Role>(rolesQuery);

  const handleUpdateRole = async (uid: string, roleId: string) => {
    if (!userService) return;
    setLoadingAction(uid);
    try {
      const role = roles?.find(r => r.id === roleId);
      if (!role) return;
      await userService.updateUserRole(uid, role.code as any || role.nameEn);
      toast({ title: t('saved') });
      setEditingUser(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleToggleStatus = async (uid: string, currentStatus: boolean) => {
    if (!userService) return;
    setLoadingAction(`status_${uid}`);
    try {
      await userService.toggleUserStatus(uid, !currentStatus);
      toast({ title: t('saved') });
    } finally {
      setLoadingAction(null);
    }
  };

  const filteredUsers = users?.filter((u: any) => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Users className="h-10 w-10 text-primary" />
            {isRtl ? 'إدارة مستخدمي النظام' : 'User Management'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'التحكم في حسابات الدخول، الصلاحيات، وحالة النشاط' : 'Control login accounts, permissions, and active status'}
          </p>
        </div>

        <Button 
          onClick={() => setIsInviteOpen(true)}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2"
        >
           <UserPlus className="h-6 w-6" />
           {isRtl ? 'إضافة مستخدم' : 'Add User'}
        </Button>
      </div>

      {/* مودال شرح إضافة مستخدم */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden max-w-lg" dir={dir}>
          <div className="bg-primary/5 p-8 border-b text-start">
             <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                <UserPlus className="h-7 w-7 text-primary" />
                {isRtl ? 'كيفية إضافة مستخدم جديد' : 'How to Add New User'}
             </DialogTitle>
          </div>
          <div className="p-8 space-y-6 text-start">
             <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4">
                <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                <div className="space-y-2">
                   <p className="text-sm font-bold text-blue-900">
                     {isRtl ? 'طريقة التسجيل الآمنة:' : 'Secure Registration Method:'}
                   </p>
                   <p className="text-xs text-blue-700 leading-relaxed">
                     {isRtl 
                       ? 'لأغراض الأمان، يرجى من المستخدم الجديد الدخول لصفحة "تسجيل شركة" واختيار حسابه الشخصي فقط، أو يمكنك تزويده برابط تسجيل خاص. بمجرد تسجيله، سيظهر في هذه القائمة لتتمكن من تعيين دوره وصلاحياته.' 
                       : 'For security, new users should register through the portal. Once registered, they will appear here for you to assign roles and permissions.'}
                   </p>
                </div>
             </div>
             <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 space-y-3">
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">{isRtl ? 'دليل المسؤول' : 'Admin Guide'}</p>
                <p className="text-xs text-amber-700 font-bold">
                   {isRtl ? '1. اطلب من الموظف إنشاء حساب بريد إلكتروني.' : '1. Ask employee to create an account.'}
                </p>
                <p className="text-xs text-amber-700 font-bold">
                   {isRtl ? '2. ابحث عن بريده هنا وقم بتفعيله.' : '2. Find their email here and activate.'}
                </p>
             </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t">
             <Button variant="ghost" onClick={() => setIsInviteOpen(false)} className="w-full h-12 rounded-xl font-black">{isRtl ? 'فهمت' : 'Got it'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي الحسابات' : 'Total Users'}</p>
            <h3 className="text-4xl font-black font-headline text-slate-900">{users?.length || 0}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'المدراء' : 'Admins'}</p>
            <h3 className="text-4xl font-black font-headline text-primary">{users?.filter((u: any) => u.role === 'admin').length || 0}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'نشط حالياً' : 'Active'}</p>
            <h3 className="text-4xl font-black font-headline text-emerald-600">{users?.filter((u: any) => u.isActive !== false).length || 0}</h3>
         </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={isRtl ? 'بحث باسم المستخدم أو البريد...' : 'Search by name or email...'} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 text-lg font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'المستخدم' : 'User'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الدور الوظيفي' : 'Role'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'آخر دخول' : 'Last Login'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredUsers.map((u: any) => (
                <TableRow key={u.id} className="hover:bg-primary/5 transition-colors group">
                  <TableCell className="py-6 ps-8 text-start">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 rounded-xl border-2 border-white shadow-sm">
                           <AvatarImage src={`https://picsum.photos/seed/${u.id}/100/100`} />
                           <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">{u.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-start">
                           <p className="font-black text-slate-800">{u.displayName}</p>
                           <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Mail className="h-2 w-2" /> {u.email}</p>
                        </div>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <Badge variant="outline" className="font-black border-2 px-3 py-1 bg-white text-[10px] uppercase text-primary border-primary/10">
                        {u.role || 'Basic User'}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-start font-mono text-[10px] text-slate-500">
                     {u.joinedAt?.toDate().toLocaleDateString() || '---'}
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex items-center justify-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full shadow-sm", u.isActive !== false ? "bg-emerald-500" : "bg-rose-500")} />
                        <span className="text-[10px] font-black uppercase">{u.isActive !== false ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'موقوف' : 'Banned')}</span>
                     </div>
                  </TableCell>
                  <TableCell className="pe-8 text-end">
                     <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl hover:bg-primary/10 text-primary"
                          onClick={() => setEditingUser(u)}
                        >
                           <UserCog className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("rounded-xl", u.isActive !== false ? "text-rose-500 hover:bg-rose-50" : "text-emerald-500 hover:bg-emerald-50")}
                          onClick={() => handleToggleStatus(u.id, u.isActive !== false)}
                          disabled={loadingAction === `status_${u.id}`}
                        >
                           {loadingAction === `status_${u.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : (u.isActive !== false ? <Ban className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />)}
                        </Button>
                     </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* مودال تعديل الصلاحيات */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden max-w-lg" dir={dir}>
            <div className="bg-primary/5 p-8 border-b text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                  {isRtl ? 'تعديل دور المستخدم' : 'Edit User Role'}
               </DialogTitle>
               <p className="text-xs font-bold text-muted-foreground mt-1 italic">{editingUser?.displayName}</p>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اختر الدور الوظيفي الجديد' : 'Select New Role'}</Label>
                  <div className="grid grid-cols-1 gap-3">
                     {roles?.map(role => (
                       <div 
                         key={role.id}
                         onClick={() => handleUpdateRole(editingUser.id, role.id!)}
                         className={cn(
                           "p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group",
                           editingUser?.role === (role.code || role.nameEn) ? "bg-primary border-primary text-white shadow-xl" : "bg-white border-slate-100 hover:border-primary/30"
                         )}
                       >
                          <div className="text-start">
                             <p className="font-black text-sm">{isRtl ? role.name : role.nameEn}</p>
                             <p className={cn("text-[9px] font-bold uppercase", editingUser?.role === (role.code || role.nameEn) ? "text-white/70" : "text-slate-400")}>
                                {role.permissions.includes('*') ? 'Full Access' : `${role.permissions.length} Permissions`}
                             </p>
                          </div>
                          {loadingAction === editingUser?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />}
                       </div>
                     ))}
                  </div>
               </div>

               <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                     {isRtl 
                       ? 'تنبيه: تغيير دور المستخدم سيؤدي فوراً لتحديث صلاحيات وصوله لكافة الوحدات والبيانات في النظام.' 
                       : 'Note: Changing the user role will immediately update their access permissions to all modules and data.'}
                  </p>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button variant="ghost" onClick={() => setEditingUser(null)} className="w-full h-12 rounded-xl font-black">{isRtl ? 'إغلاق' : 'Close'}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
