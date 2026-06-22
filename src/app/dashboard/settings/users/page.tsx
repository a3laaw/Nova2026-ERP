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
  ShieldAlert, UserPlus, Info, Save,
  LayoutGrid, Copy, Link as LinkIcon
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { UserService } from '@/services/user-service';
import { Role } from '@/types/roles';
import { Employee } from '@/types/hr';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // فورم الدعوة
  const [inviteForm, setInviteForm] = useState({
    employeeId: '',
    roleId: ''
  });

  const userService = useMemo(() => 
    db && companyId ? new UserService(db, companyId) : null, 
  [db, companyId]);

  // داتا
  const usersQuery = useMemo(() => companyId && db ? query(collection(db, 'companies', companyId, 'users')) : null, [db, companyId]);
  const rolesQuery = useMemo(() => companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);

  const { data: users, loading: usersLoading } = useCollection(usersQuery);
  const { data: roles } = useCollection<Role>(rolesQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const handleCreateInvite = async () => {
    if (!userService || !inviteForm.employeeId || !inviteForm.roleId) return;
    setLoadingAction('create_invite');
    try {
      const emp = employees?.find(e => e.id === inviteForm.employeeId);
      const role = roles?.find(r => r.id === inviteForm.roleId);
      if (!emp || !role) return;

      const inviteId = await userService.createInvitation({
        employeeId: emp.id!,
        employeeName: emp.fullName,
        email: emp.email || '',
        roleId: role.id!,
        roleCode: role.code,
        departmentId: emp.departmentId
      });

      const link = `${window.location.origin}/join/${companyId}/${inviteId}`;
      setGeneratedLink(link);
      toast({ title: isRtl ? "تم توليد رابط الدعوة" : "Invite Link Generated" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateRole = async (uid: string, roleId: string) => {
    if (!userService) return;
    setLoadingAction(uid);
    try {
      const role = roles?.find(r => r.id === roleId);
      if (!role) return;
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

        <Dialog open={isInviteOpen} onOpenChange={(v) => { setIsInviteOpen(v); if(!v) setGeneratedLink(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2">
               <UserPlus className="h-6 w-6" />
               {isRtl ? 'تفعيل حساب موظف' : 'Activate Employee'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl" dir={dir}>
            <div className="bg-slate-900 p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <UserPlus className="h-9 w-9 text-primary" />
                  {isRtl ? 'دعوة موظف للنظام' : 'Invite Employee'}
               </DialogTitle>
               <p className="text-slate-400 font-bold mt-2">{isRtl ? 'قم بربط ملف الموظف بحساب دخول جديد.' : 'Link employee profile to a new login account.'}</p>
            </div>

            <div className="p-10 space-y-8 text-start bg-white">
               {!generatedLink ? (
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'اختر الموظف (من سجلات HR)' : 'Select Employee'}</Label>
                       <Select value={inviteForm.employeeId} onValueChange={v => setInviteForm({...inviteForm, employeeId: v})}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                             <SelectValue placeholder="..." />
                          </SelectTrigger>
                          <SelectContent>
                             {employees?.map(e => <SelectItem key={e.id} value={e.id!} className="font-bold">{e.fullName}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'تعيين الدور الأمني' : 'Assign Role'}</Label>
                       <Select value={inviteForm.roleId} onValueChange={v => setInviteForm({...inviteForm, roleId: v})}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                             <SelectValue placeholder="..." />
                          </SelectTrigger>
                          <SelectContent>
                             {roles?.map(r => <SelectItem key={r.id} value={r.id!} className="font-bold">{isRtl ? r.name : r.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>

                    <Button onClick={handleCreateInvite} disabled={loadingAction === 'create_invite' || !inviteForm.employeeId} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20">
                       {loadingAction === 'create_invite' ? <Loader2 className="animate-spin h-6 w-6" /> : (isRtl ? 'توليد رابط التفعيل' : 'Generate Activation Link')}
                    </Button>
                 </div>
               ) : (
                 <div className="space-y-6 animate-in zoom-in-95">
                    <div className="p-8 rounded-[2rem] bg-emerald-50 border-2 border-emerald-100 flex flex-col items-center text-center gap-4">
                       <div className="h-16 w-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><CheckCircle2 className="h-8 w-8" /></div>
                       <div className="space-y-1">
                          <h4 className="font-black text-emerald-900 text-xl">{isRtl ? 'رابط التفعيل جاهز' : 'Link Ready'}</h4>
                          <p className="text-xs font-bold text-emerald-700/70">{isRtl ? 'أرسل هذا الرابط للموظف ليكمل إعداد كلمة مروره.' : 'Send this link to the employee to set their password.'}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <Input readOnly value={generatedLink} className="h-14 rounded-xl font-mono text-[10px] bg-slate-50" dir="ltr" />
                       <Button onClick={() => { navigator.clipboard.writeText(generatedLink); toast({title: "Copied"}); }} className="bg-slate-900 h-14 px-6 rounded-xl font-black"><Copy className="h-5 w-5" /></Button>
                    </div>
                    <p className="text-[10px] text-center text-slate-400 font-bold italic">{isRtl ? '* الرابط صالح للاستخدام مرة واحدة فقط ولمدة 48 ساعة.' : '* Link is valid for one use and expires in 48 hours.'}</p>
                 </div>
               )}
            </div>
          </DialogContent>
        </Dialog>
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
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
