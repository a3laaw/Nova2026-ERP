
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Loader2, Edit3, 
  Search, ShieldCheck, Mail, ArrowRight,
  UserCircle, Ban, CheckCircle2, UserCog,
  ShieldAlert, UserPlus, Info, Save,
  LayoutGrid, Copy, Key, Eye, EyeOff,
  Pencil, Lock, RefreshCcw
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});

  // فورم الإنشاء
  const [createForm, setCreateForm] = useState({
    employeeId: '',
    roleId: '',
    username: '',
    password: '',
    email: ''
  });

  // فورم التعديل
  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    roleId: '',
    newPassword: ''
  });

  const userService = useMemo(() => 
    db && companyId ? new UserService(db, companyId) : null, 
  [db, companyId]);

  const usersQuery = useMemo(() => companyId && db ? query(collection(db, 'companies', companyId, 'users')) : null, [db, companyId]);
  const rolesQuery = useMemo(() => companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);

  const { data: users, loading: usersLoading } = useCollection(usersQuery);
  const { data: roles } = useCollection<Role>(rolesQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  // تحديث فورم التعديل عند اختيار مستخدم
  useEffect(() => {
    if (editingUser) {
      setEditForm({
        displayName: editingUser.displayName || '',
        username: editingUser.username || '',
        roleId: editingUser.roleId || '',
        newPassword: ''
      });
    }
  }, [editingUser]);

  const handleCreateAccount = async () => {
    if (!userService || !createForm.employeeId || !createForm.password) return;
    setLoadingAction('creating');
    try {
      const emp = employees?.find(e => e.id === createForm.employeeId);
      const role = roles?.find(r => r.id === createForm.roleId);
      if (!emp || !role) return;

      await userService.createUserAccount({
        employeeId: emp.id!,
        employeeName: emp.fullName,
        email: createForm.email || emp.email || '',
        username: createForm.username || emp.employeeNumber,
        password: createForm.password,
        roleId: role.id!,
        roleCode: role.code,
        departmentId: emp.departmentId
      });

      toast({ title: isRtl ? "تم إنشاء الحساب بنجاح" : "Account Created Successfully" });
      setIsCreateOpen(false);
      setCreateForm({ employeeId: '', roleId: '', username: '', password: '', email: '' });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateAccount = async () => {
    if (!userService || !editingUser) return;
    setLoadingAction(editingUser.id);
    try {
      const role = roles?.find(r => r.id === editForm.roleId);
      if (!role) return;

      await userService.updateUserAccount(editingUser.id, {
        displayName: editForm.displayName,
        username: editForm.username,
        roleId: role.id!,
        roleCode: role.code,
        initialPassword: editForm.newPassword || editingUser.initialPassword
      });

      toast({ title: t('saved') });
      setEditingUser(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
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

  const togglePassVisibility = (uid: string) => {
    setShowPassMap(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const filteredUsers = users?.filter((u: any) => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
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
            {isRtl ? 'التحكم في حسابات الدخول، الصلاحيات، واسترجاع كلمات المرور' : 'Control accounts, permissions, and password retrieval'}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2">
               <UserPlus className="h-6 w-6" />
               {isRtl ? 'إنشاء حساب موظف' : 'Create User'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl" dir={dir}>
            <div className="bg-slate-900 p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <Key className="h-9 w-9 text-primary" />
                  {isRtl ? 'إعداد حساب دخول جديد' : 'Setup Login Account'}
               </DialogTitle>
            </div>

            <div className="p-10 space-y-6 text-start bg-white">
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'اختر الموظف' : 'Select Employee'}</Label>
                   <Select value={createForm.employeeId} onValueChange={v => {
                      const emp = employees?.find(e => e.id === v);
                      setCreateForm({...createForm, employeeId: v, email: emp?.email || '', username: emp?.employeeNumber || ''});
                   }}>
                      <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                         <SelectValue placeholder="..." />
                      </SelectTrigger>
                      <SelectContent>
                         {employees?.map(e => <SelectItem key={e.id} value={e.id!} className="font-bold">{e.fullName}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'اسم المستخدم' : 'Username'}</Label>
                      <Input value={createForm.username} onChange={e => setCreateForm({...createForm, username: e.target.value})} className="h-12 rounded-xl border-2 font-mono" placeholder={isRtl ? "اختياري (الافتراضي الرقم الوظيفي)" : "Optional (Default Emp #)"} />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الدور الأمني' : 'Role'}</Label>
                      <Select value={createForm.roleId} onValueChange={v => setCreateForm({...createForm, roleId: v})}>
                         <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                         <SelectContent>
                            {roles?.map(r => <SelectItem key={r.id} value={r.id!} className="font-bold">{isRtl ? r.name : r.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'البريد الإلكتروني للدخول' : 'Email'}</Label>
                   <Input value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="h-12 rounded-xl border-2 text-start" dir="ltr" />
                </div>

                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'كلمة المرور المبدئية' : 'Initial Password'}</Label>
                   <Input value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="h-14 rounded-xl border-2 font-mono text-lg text-primary" placeholder="P@ssw0rd123" />
                </div>

                <Button onClick={handleCreateAccount} disabled={loadingAction === 'creating'} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 mt-4">
                   {loadingAction === 'creating' ? <Loader2 className="animate-spin h-6 w-6" /> : (isRtl ? 'إنشاء الحساب الآن' : 'Create Account Now')}
                </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                <TableHead className="text-start">{isRtl ? 'الدور' : 'Role'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'كلمة المرور الحالية' : 'Managed Pass'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الحالة' : 'Status'}</TableHead>
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
                           <p className="text-[9px] font-mono text-primary/60 font-bold mt-0.5">@{u.username}</p>
                        </div>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <Badge variant="outline" className="font-black border-2 px-4 py-1 bg-white text-[10px] uppercase text-primary border-primary/20">
                        {u.role || 'Basic User'}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-start">
                     <div className="flex items-center gap-2">
                        <div className="bg-slate-100 px-3 py-1.5 rounded-lg border font-mono text-[10px] min-w-[120px] flex items-center justify-between">
                           <span>{showPassMap[u.id] ? u.initialPassword : '••••••••'}</span>
                           <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent" onClick={() => togglePassVisibility(u.id)}>
                              {showPassMap[u.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                           </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(u.initialPassword || ''); toast({title: "Copied"}); }}>
                           <Copy className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                     </div>
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex items-center justify-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", u.isActive !== false ? "bg-emerald-500" : "bg-rose-500")} />
                        <span className="text-[10px] font-black uppercase">{u.isActive !== false ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'موقوف' : 'Suspended')}</span>
                     </div>
                  </TableCell>
                  <TableCell className="pe-8 text-end">
                     <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 text-primary hover:bg-primary hover:text-white" onClick={() => setEditingUser(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl h-10 w-10 text-rose-500"
                          onClick={() => handleToggleStatus(u.id, u.isActive !== false)}
                          disabled={loadingAction === `status_${u.id}`}
                        >
                           {loadingAction === `status_${u.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <Ban className="h-5 w-5" />}
                        </Button>
                     </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* مودال التعديل الشامل */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl" dir={dir}>
            <div className="bg-primary p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <UserCog className="h-9 w-9" />
                  {isRtl ? 'تعديل حساب المستخدم' : 'Edit User Account'}
               </DialogTitle>
               <p className="text-white/80 font-bold mt-2">{editingUser?.email}</p>
            </div>
            
            <div className="p-10 space-y-6 text-start bg-white">
               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الاسم المعروض' : 'Display Name'}</Label>
                  <Input value={editForm.displayName} onChange={e => setEditForm({...editForm, displayName: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم المستخدم (معرف الدخول)' : 'Username'}</Label>
                     <Input value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الدور الأمني (الصلاحيات)' : 'Role'}</Label>
                     <Select value={editForm.roleId} onValueChange={v => setEditForm({...editForm, roleId: v})}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                           <SelectValue placeholder="..." />
                        </SelectTrigger>
                        <SelectContent>
                           {roles?.map(role => (
                             <SelectItem key={role.id} value={role.id!} className="font-bold">{isRtl ? role.name : role.nameEn}</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                     <Lock className="h-4 w-4" /> {isRtl ? 'تحديث كلمة المرور الإدارية' : 'Manage Password'}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400">{isRtl ? 'كلمة مرور جديدة (اتركه فارغاً للإبقاء على الحالية)' : 'New Password (Leave blank to keep current)'}</Label>
                    <div className="relative">
                      <Input 
                        type="text" 
                        value={editForm.newPassword} 
                        onChange={e => setEditForm({...editForm, newPassword: e.target.value})}
                        className="h-12 rounded-xl border-2 font-mono text-primary bg-slate-50"
                        placeholder="••••••••"
                      />
                      <RefreshCcw className="absolute end-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-200" />
                    </div>
                  </div>
               </div>

               <div className="pt-4 flex items-start gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] font-bold text-amber-800 leading-relaxed">
                     {isRtl 
                       ? 'تنبيه: تغيير كلمة المرور هنا هو "تعديل إداري" للسجل. سيظهر للموظف في حسابه ليتمكن من استخدامه، وتأكد من إبلاغه بالبيانات الجديدة.' 
                       : 'Warning: Changing password here is an administrative update. The employee will see it in their record for login purposes.'}
                  </p>
               </div>

               <Button 
                onClick={handleUpdateAccount} 
                disabled={loadingAction === editingUser?.id} 
                className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20"
               >
                  {loadingAction === editingUser?.id ? <Loader2 className="animate-spin h-6 w-6" /> : (isRtl ? 'حفظ التغييرات' : 'Save Changes')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
