
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
  ShieldAlert, UserPlus, Info, Save
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
      // مزامنة الدور عبر الخدمة المحدثة
      await userService.updateUserRole(uid, role.id!, role.code || role.nameEn);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{isRtl ? 'إجمالي الحسابات' : 'Total Users'}</p>
            <h3 className="text-4xl font-black font-headline text-slate-900">{users?.length || 0}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{isRtl ? 'الأدوار المعرفة' : 'System Roles'}</p>
            <h3 className="text-4xl font-black font-headline text-primary">{roles?.length || 0}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{isRtl ? 'نشط حالياً' : 'Active Accounts'}</p>
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
                <TableHead className="text-start">{isRtl ? 'الدور الوظيفي' : 'Assigned Role'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'آخر دخول' : 'Join Date'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الحالة' : 'Account Status'}</TableHead>
                <TableHead className="pe-8 text-end">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredUsers.map((u: any) => (
                <TableRow key={u.id} className="hover:bg-primary/5 transition-colors group border-b-slate-50">
                  <TableCell className="py-6 ps-8 text-start">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 rounded-2xl border-2 border-white shadow-lg ring-1 ring-slate-100">
                           <AvatarImage src={`https://picsum.photos/seed/${u.id}/100/100`} />
                           <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xl">{u.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-start">
                           <p className="font-black text-slate-800 text-base">{u.displayName}</p>
                           <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {u.email}</p>
                        </div>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <Badge variant="outline" className="font-black border-2 px-4 py-1 bg-white text-[10px] uppercase text-primary border-primary/20 shadow-sm">
                        {u.role || 'Basic User'}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-start font-mono text-[10px] text-slate-500 font-bold">
                     {u.joinedAt?.toDate().toLocaleDateString() || '---'}
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex items-center justify-center gap-2">
                        <span className={cn("h-3 w-3 rounded-full shadow-sm", u.isActive !== false ? "bg-emerald-500 shadow-emerald-200" : "bg-rose-500 shadow-rose-200")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{u.isActive !== false ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'موقوف' : 'Suspended')}</span>
                     </div>
                  </TableCell>
                  <TableCell className="pe-8 text-end">
                     <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-xl hover:bg-primary/10 text-primary border-slate-200 h-10 w-10 shadow-sm"
                          onClick={() => setEditingUser(u)}
                        >
                           <UserCog className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("rounded-xl h-10 w-10", u.isActive !== false ? "text-rose-500 hover:bg-rose-50" : "text-emerald-500 hover:bg-emerald-50")}
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

      {/* مودال تعديل الصلاحيات (الدور الأمني) */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl" dir={dir}>
            <div className="bg-gradient-to-r from-primary to-orange-400 p-10 text-white text-start">
               <div className="flex justify-between items-start">
                  <div className="space-y-1">
                     <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                        <ShieldCheck className="h-9 w-9 text-white/50" />
                        {isRtl ? 'تعديل الدور الأمني' : 'Assign Security Role'}
                     </DialogTitle>
                     <p className="text-white/80 font-bold text-lg italic mt-2">{editingUser?.displayName}</p>
                  </div>
                  <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center">
                     <UserCircle className="h-10 w-10" />
                  </div>
               </div>
            </div>

            <div className="p-10 space-y-8 text-start bg-white">
               <div className="space-y-4">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                     <LayoutGrid className="h-3 w-3" /> {isRtl ? 'اختر قالب الصلاحيات المطلوب' : 'Select Permission Template'}
                  </Label>
                  <div className="grid grid-cols-1 gap-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
                     {roles?.map(role => (
                       <div 
                         key={role.id}
                         onClick={() => handleUpdateRole(editingUser.id, role.id!, role.code || role.nameEn)}
                         className={cn(
                           "p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all flex items-center justify-between group relative overflow-hidden",
                           editingUser?.roleId === role.id 
                            ? "bg-primary border-primary text-white shadow-2xl shadow-primary/30" 
                            : "bg-white border-slate-100 hover:border-primary/30 hover:bg-primary/5"
                         )}
                       >
                          <div className="text-start relative z-10">
                             <p className={cn("font-black text-lg", editingUser?.roleId === role.id ? "text-white" : "text-slate-900")}>
                                {isRtl ? role.name : role.nameEn}
                             </p>
                             <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", editingUser?.roleId === role.id ? "text-white/70" : "text-slate-400")}>
                                {role.permissions.includes('*') ? 'Master Access' : `${role.permissions.length} Action Points`}
                             </p>
                          </div>
                          {loadingAction === editingUser?.id ? (
                             <Loader2 className="h-6 w-6 animate-spin text-white" />
                          ) : (
                             <ArrowRight className={cn("h-6 w-6 transition-transform group-hover:translate-x-1", editingUser?.roleId === role.id ? "text-white" : "text-slate-200")} />
                          )}
                       </div>
                     ))}
                  </div>
               </div>

               <div className="p-6 rounded-[1.5rem] bg-amber-50 border-2 border-amber-100/50 flex items-start gap-4">
                  <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                     <p className="text-xs font-black text-amber-800 uppercase tracking-tight">{isRtl ? 'الأثر الأمني' : 'Security Impact'}</p>
                     <p className="text-[10px] font-bold text-amber-700/70 leading-relaxed">
                        {isRtl 
                          ? 'تغيير الدور سيؤدي لتعديل صلاحيات الموظف على كافة موديولات النظام والتقارير فور حفظ البيانات.' 
                          : 'Changing the role will immediately update the user\'s access to all modules and reports.'}
                     </p>
                  </div>
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row justify-end gap-4">
               <Button variant="ghost" onClick={() => setEditingUser(null)} className="h-14 px-8 rounded-xl font-black text-slate-500">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* مودال دعوة مستخدم جديد */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-lg border-0 shadow-3xl" dir={dir}>
          <div className="bg-slate-900 p-10 border-b text-white text-start">
             <div className="flex justify-between items-center">
                <div className="space-y-1">
                   <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3 text-primary">
                      <UserPlus className="h-9 w-9" />
                      {isRtl ? 'إضافة موظف للنظام' : 'Add New User'}
                   </DialogTitle>
                   <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-[10px]">Invite to Enterprise Account</p>
                </div>
             </div>
          </div>
          <div className="p-10 space-y-8 text-start bg-white">
             <div className="space-y-6">
                <div className="p-8 rounded-[2rem] bg-blue-50/50 border-2 border-blue-100 flex items-start gap-5">
                   <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                      <Info className="h-6 w-6" />
                   </div>
                   <div className="space-y-2">
                      <p className="text-base font-black text-blue-900">{isRtl ? 'كيف يتم التسجيل؟' : 'Registration Protocol'}</p>
                      <p className="text-xs font-bold text-blue-700/70 leading-relaxed">
                        {isRtl 
                          ? 'لأغراض أمن المعلومات، يرجى تزويد الموظف برابط النظام. بمجرد تسجيله بحسابه الرسمي، سيظهر اسمه في هذه القائمة تلقائياً بحالة "مستخدم عادي". يمكنك بعد ذلك الضغط على أيقونة التعديل لتعيين دوره وصلاحياته.' 
                          : 'Provide the employee with the portal link. Once they register, they will appear here as a "Basic User". You can then assign their specific role and permissions.'}
                      </p>
                   </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-[1.5rem] border-2 border-dashed space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'رابط التسجيل السريع' : 'Quick Access Link'}</p>
                   </div>
                   <div className="flex gap-2">
                      <Input readOnly value={typeof window !== 'undefined' ? `${window.location.origin}/register` : ''} className="bg-white rounded-xl h-12 font-mono text-[10px]" dir="ltr" />
                      <Button onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/register`);
                          toast({ title: isRtl ? "تم نسخ الرابط" : "Link Copied" });
                        }
                      }} className="bg-primary h-12 px-4 rounded-xl font-black">Copy</Button>
                   </div>
                </div>
             </div>
          </div>
          <DialogFooter className="p-10 bg-slate-50 border-t">
             <Button onClick={() => setIsInviteOpen(false)} className="w-full h-16 rounded-2xl font-black text-xl bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200">
                {isRtl ? 'حسناً، فهمت' : 'Understood'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
