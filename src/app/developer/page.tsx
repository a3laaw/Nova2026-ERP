'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Loader2, CheckCircle2, RefreshCw, 
  Save, Building2, ShieldCheck, Trash2, 
  Power, Search, Key, Copy, Eye, EyeOff,
  Settings2, Zap, Rocket, AlertTriangle,
  Clock, CalendarClock, Ban, CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, parseISO } from 'date-fns';
import { UserService } from '@/services/user-service';

export default function DeveloperDashboard() {
  const { lang, dir, t } = useLanguage(); 
  const { globalUser, loading: authLoading } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [activeTab, setActiveTab] = useState("requests");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [deletingContext, setDeletingContext] = useState<{ id: string, type: 'request' | 'company' } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const companiesQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'companies')) : null, 
  [db, globalUser?.isDeveloper]);

  const requestsQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'company_requests')) : null, 
  [db, globalUser?.isDeveloper]);

  const { data: companies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: requests, loading: requestsLoading } = useCollection<any>(requestsQuery);

  const handleDelete = async () => {
    if (!db || !deletingContext) return;
    const { id, type } = deletingContext;
    setProcessingId(id);
    try {
      const path = type === 'request' ? 'company_requests' : 'companies';
      await deleteDoc(doc(db, path, id));
      toast({ title: isRtl ? "تم الحذف بنجاح" : "Deleted Successfully" });
      setDeletingContext(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleActivate = async (req: any) => {
    if (!db) return;
    setProcessingId(req.id);
    
    // إنشاء معرف منشأة سيادي
    const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
    const userService = new UserService(db, companyId);
    
    try {
      const batch = writeBatch(db);

      // 1. تأسيس ملف الشركة بنظام "تجريبي" لمدة 7 أيام
      const companyRef = doc(db, 'companies', companyId);
      const expiry = addDays(new Date(), 7).toISOString();
      batch.set(companyRef, {
        id: companyId,
        name: req.companyName,
        status: 'active',
        subscriptionType: 'trial',
        expiryDate: expiry,
        activity: req.activity,
        maxUsers: 5,
        ownerEmail: req.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. إنشاء الدور الأمني الافتراضي (ADMIN)
      const roleRef = doc(collection(db, 'companies', companyId, 'roles'));
      batch.set(roleRef, {
        code: 'ADMIN',
        name: 'مدير النظام',
        nameEn: 'System Admin',
        permissions: ['*'],
        matrix: [{ resourceId: '*', action: 'view', scope: 'all' }],
        isSystemRole: true,
        isActive: true,
        order: 1,
        companyId: companyId,
        createdAt: serverTimestamp()
      });

      // 3. إنشاء القسم الأول (الإدارة العليا)
      const deptRef = doc(collection(db, 'companies', companyId, 'departments'));
      batch.set(deptRef, {
        name: 'الإدارة العليا',
        nameEn: 'General Management',
        isActive: true,
        order: 1,
        companyId: companyId,
        createdAt: serverTimestamp()
      });

      // 4. إنشاء الوظيفة الأولى (المدير العام) مربوطة بدور ADMIN
      const jobRef = doc(collection(db, 'companies', companyId, 'departments', deptRef.id, 'jobs'));
      batch.set(jobRef, {
        name: 'المدير العام',
        nameEn: 'General Manager',
        roleId: roleRef.id,
        roleCode: 'ADMIN',
        hourlyCost: 0,
        isActive: true,
        order: 1,
        companyId: companyId,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      // 5. إنشاء حساب الدخول الفعلي (Auth + Global Identity)
      const empId = `emp_1001`;
      const uid = await userService.createUserAccount({
        employeeId: empId,
        employeeName: req.contactName,
        email: req.email,
        username: req.proposedUsername || req.email.split('@')[0],
        password: req.proposedPassword,
        roleId: roleRef.id,
        roleCode: 'ADMIN',
        departmentId: deptRef.id
      });

      // 6. إنشاء سجل الموظف الموازي لضمان عمل الـ HR
      await setDoc(doc(db, 'companies', companyId, 'employees', empId), {
        id: empId,
        employeeNumber: '1001',
        fullName: req.contactName,
        email: req.email,
        mobile: req.phone,
        departmentId: deptRef.id,
        departmentName: 'الإدارة العليا',
        jobId: jobRef.id,
        jobTitle: 'المدير العام',
        status: 'active',
        employeeType: 'internal',
        hireDate: new Date().toISOString().split('T')[0],
        basicSalary: 0,
        annualLeaveBalance: 30,
        isActive: true,
        companyId: companyId,
        createdAt: serverTimestamp()
      });

      // 7. ربط الملكية بالشركة وتحديث الطلب
      await updateDoc(companyRef, { ownerUid: uid });
      await updateDoc(doc(db, 'company_requests', req.id), { 
        status: 'activated', 
        activatedAt: serverTimestamp(),
        companyId: companyId,
        ownerUid: uid
      });

      toast({ title: isRtl ? "تم التأسيس والتفعيل بنجاح" : "Company Provisioned Successfully" });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Provisioning Error", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApplyUpdate = async () => {
    if (!db || !editingCompany) return;
    setProcessingId(editingCompany.id);
    try {
      const ref = doc(db, 'companies', editingCompany.id);
      await updateDoc(ref, {
        status: editingCompany.status,
        subscriptionType: editingCompany.subscriptionType,
        expiryDate: editingCompany.expiryDate,
        updatedAt: serverTimestamp()
      });
      toast({ title: isRtl ? "تم تحديث الترخيص بنجاح" : "License Updated" });
      setEditingCompany(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 text-start" dir={dir}>
      <header className="flex justify-between items-end border-b pb-6">
        <div className="text-start">
          <h2 className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'رادار تأسيس المنشآت' : 'Sovereign Provisioning'}</h2>
          <Badge className="bg-primary text-white border-0 text-[8px] uppercase px-3 rounded-full mt-2">Core Developer Hub</Badge>
        </div>
        <div className="relative w-full max-w-xs">
           <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
           <Input placeholder={t('search')} className="ps-9 h-10 rounded-xl bg-white border-2" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border h-12 rounded-xl p-1.5 gap-2 mb-6 shadow-sm inline-flex">
           <TabsTrigger value="requests" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Zap className="h-4 w-4" /> طلبات التأسيس
           </TabsTrigger>
           <TabsTrigger value="companies" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Building2 className="h-4 w-4" /> المنشآت المفعلة
           </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2">
           <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 ps-8">المنشأة</TableHead>
                    <TableHead>النشاط</TableHead>
                    <TableHead>كلمة المرور المقترحة</TableHead>
                    <TableHead className="pe-8 text-end">الإجراء السيادي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : requests?.filter(r => r.status === 'pending').length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-300 font-bold italic">لا يوجد طلبات تأسيس جديدة.</TableCell></TableRow>
                  ) : requests?.filter(r => r.status === 'pending').map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-primary/[0.01] group border-b-slate-50">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm">{req.companyName}</p>
                            <div className="flex items-center gap-2 mt-1">
                               <p className="text-[10px] text-slate-400 font-mono">{req.email}</p>
                               <span className="text-slate-200">|</span>
                               <p className="text-[10px] font-bold text-primary">{req.phone}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">{req.activity}</Badge></TableCell>
                      <TableCell><code className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono font-bold">{req.proposedPassword}</code></TableCell>
                      <TableCell className="pe-8 text-end">
                         <div className="flex items-center justify-end gap-2">
                            <Button 
                              onClick={() => setDeletingContext({ id: req.id, type: 'request' })}
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                               <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => handleActivate(req)} disabled={!!processingId} size="sm" className="h-10 px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 border-b-4 border-emerald-800 transition-all active:scale-95">
                               {processingId === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                               تأسيس وتفعيل الآن
                            </Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="companies" className="animate-in slide-in-from-bottom-2">
           <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 ps-8">المنشأة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الاشتراك / الانتهاء</TableHead>
                    <TableHead className="pe-8 text-end">التحكم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : companies?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-300 italic">لا يوجد منشآت مفعلة.</TableCell></TableRow>
                  ) : companies?.map((comp: any) => (
                    <TableRow key={comp.id} className="hover:bg-primary/[0.01] group border-b-slate-50">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-900 text-sm">{comp.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                               <p className="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">ID: {comp.id}</p>
                               <span className="text-slate-100">•</span>
                               <p className="text-[8px] font-bold text-slate-300">{comp.ownerEmail}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black text-[9px] uppercase px-3 py-1 rounded-md border-0 shadow-sm",
                           comp.status === 'active' ? "bg-emerald-500 text-white" : 
                           comp.status === 'suspended' ? "bg-rose-500 text-white" : "bg-slate-400 text-white"
                         )}>
                            {comp.status}
                         </Badge>
                      </TableCell>
                      <TableCell>
                         <div className="text-start space-y-1">
                            <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary">{comp.subscriptionType?.toUpperCase()}</Badge>
                            <p className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1">
                               <Clock className="h-3 w-3" /> {comp.expiryDate ? format(parseISO(comp.expiryDate), 'dd/MM/yyyy') : '---'}
                            </p>
                         </div>
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                        <div className="flex items-center justify-end gap-2">
                           <Button 
                             onClick={() => setDeletingContext({ id: comp.id, type: 'company' })}
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                              <Trash2 className="h-4 w-4" />
                           </Button>
                           <Button variant="outline" size="sm" onClick={() => setEditingCompany(comp)} className="h-9 gap-2 border-2 border-slate-100 hover:bg-slate-50 font-bold text-xs rounded-xl shadow-sm">
                              <Settings2 className="h-3.5 w-3.5" /> إدارة التراخيص
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>

      {/* مودال إدارة المنشأة المطور */}
      <Dialog open={!!editingCompany} onOpenChange={v => !v && setEditingCompany(null)}>
         <DialogContent className="rounded-[2.5rem] max-w-xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-8 border-b text-start flex justify-between items-center">
               <div>
                  <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
                     <CalendarClock className="h-7 w-7 text-primary" /> إدارة التراخيص والاشتراك
                  </DialogTitle>
                  <p className="text-sm font-bold text-slate-400 mt-1">{editingCompany?.name}</p>
               </div>
               <Button variant="ghost" size="icon" onClick={() => setEditingCompany(null)} className="rounded-full"><X className="h-5 w-5" /></Button>
            </div>
            
            <div className="p-10 space-y-8 text-start bg-white">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">نوع الاشتراك الفعال</Label>
                     <Select value={editingCompany?.subscriptionType} onValueChange={v => setEditingCompany({...editingCompany, subscriptionType: v})}>
                        <SelectTrigger className="h-12 border-2 rounded-xl font-black text-slate-700">
                           <SelectValue placeholder="..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl">
                           <SelectItem value="trial" className="font-bold">Trial (تجريبي)</SelectItem>
                           <SelectItem value="monthly" className="font-bold">Monthly (شهري)</SelectItem>
                           <SelectItem value="annual" className="font-bold">Annual (سنوي)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">تاريخ انتهاء الوصول</Label>
                     <Input 
                       type="date" 
                       value={editingCompany?.expiryDate?.split('T')[0] || ''} 
                       onChange={e => setEditingCompany({...editingCompany, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} 
                       className="h-12 border-2 rounded-xl font-black text-center" 
                     />
                  </div>
               </div>

               <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner space-y-6">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <Label className="font-black text-lg text-slate-800">الحالة التشغيلية للمنصة</Label>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                           {isRtl ? 'تعطيل وصول المنشأة للنظام يمنع كافة الموظفين من الدخول فوراً.' : 'Suspending prevents all users from logging in immediately.'}
                        </p>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <Button 
                       onClick={() => setEditingCompany({...editingCompany, status: 'active'})} 
                       variant={editingCompany?.status === 'active' ? 'default' : 'outline'} 
                       className={cn("h-14 rounded-2xl font-black gap-2 transition-all", editingCompany?.status === 'active' ? "bg-emerald-600 shadow-emerald-100" : "bg-white")}
                     >
                        <CheckCircle className="h-5 w-5" /> فعال (Active)
                     </Button>
                     <Button 
                       onClick={() => setEditingCompany({...editingCompany, status: 'suspended'})} 
                       variant={editingCompany?.status === 'suspended' ? 'destructive' : 'outline'} 
                       className={cn("h-14 rounded-2xl font-black gap-2 transition-all", editingCompany?.status === 'suspended' ? "bg-rose-600 shadow-rose-100" : "bg-white")}
                     >
                        <Ban className="h-5 w-5" /> مجمد (Suspend)
                     </Button>
                  </div>
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleApplyUpdate} disabled={!!processingId} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 gap-3">
                  {processingId ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                  حفظ وتطبيق التعديلات السيادية
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* حوار تأكيد الحذف السيادي */}
      <AlertDialog open={!!deletingContext} onOpenChange={v => !v && setDeletingContext(null)}>
         <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
               <Trash2 className="h-10 w-10" />
            </div>
            <AlertDialogHeader className="text-center">
               <AlertDialogTitle className="font-black text-3xl font-headline text-slate-900 leading-tight">
                  {isRtl ? 'حذف السجل نهائياً' : 'Permanent Deletion'}
               </AlertDialogTitle>
               <AlertDialogDescription className="text-center font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {isRtl 
                    ? 'تحذير سيادي: هذا الإجراء سيمحو كافة البيانات المرتبطة بهذا السجل (طلبات أو شركات) من قاعدة البيانات السحابية فوراً. لا يمكن التراجع عن هذا الإجراء.' 
                    : 'Sovereign Warning: This will permanently wipe all data linked to this record from the cloud. This action is irreversible.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row items-center justify-center">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white">إلغاء</AlertDialogCancel>
               <AlertDialogAction 
                  onClick={handleDelete} 
                  disabled={!!processingId}
                  className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
               >
                  {processingId ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف نهائياً' : 'Confirm Wipeout')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

