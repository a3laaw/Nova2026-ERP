'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { 
  Loader2, CheckCircle2, RefreshCw, 
  Save, Building2, ShieldCheck, Trash2, 
  Power, Search, Key, Copy, Eye, EyeOff,
  Settings2, Zap, Rocket
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, isAfter, parseISO } from 'date-fns';
import { UserService } from '@/services/user-service';

export default function DeveloperDashboard() {
  const { lang, dir, t } = useLanguage(); 
  const { globalUser, loading: authLoading } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [activeTab, setActiveTab] = useState("requests");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [ownerData, setOwnerData] = useState<any>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const companiesQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'companies')) : null, 
  [db, globalUser?.isDeveloper]);

  const requestsQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'company_requests')) : null, 
  [db, globalUser?.isDeveloper]);

  const { data: companies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: requests, loading: requestsLoading } = useCollection<any>(requestsQuery);

  /**
   * محرك التأسيس السيادي (Sovereign Provisioning Engine)
   * يقوم بإنشاء الشركة، الدور، الحساب، وأول سجل موظف في عملية واحدة.
   */
  const handleActivate = async (req: any) => {
    if (!db) return;
    setProcessingId(req.id);
    
    const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
    const userService = new UserService(db, companyId);
    
    try {
      const batch = writeBatch(db);

      // 1. تأسيس سجل الشركة
      const companyRef = doc(db, 'companies', companyId);
      const expiry = addDays(new Date(), 7).toISOString();
      batch.set(companyRef, {
        id: companyId,
        name: req.companyName,
        status: 'active',
        subscriptionType: 'trial',
        expiryDate: expiry,
        activity: req.activity,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. تأسيس دور الأدمن الافتراضي (لأنه مطلوب لربط المستخدم)
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

      // 3. تأسيس أول قسم (إداري) وأول وظيفة للمالك
      const deptRef = doc(collection(db, 'companies', companyId, 'departments'));
      batch.set(deptRef, {
        name: 'الإدارة العليا',
        nameEn: 'General Management',
        isActive: true,
        order: 1,
        companyId: companyId,
        createdAt: serverTimestamp()
      });

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

      // تنفيذ الكتابات الهيكلية أولاً لضمان وجود الرول قبل إنشاء المستخدم
      await batch.commit();

      // 4. إنشاء حساب المستخدم (Auth + Global + Company User)
      // نستخدم معرف مؤقت للموظف سيتم تثبيته لاحقاً
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

      // 5. إنشاء سجل الموظف الفعلي (لربط موديول HR)
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

      // 6. تحديث سجل الشركة بـ ownerUid وتحديث الطلب
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

  const handleOpenEdit = async (company: any) => {
    setEditingCompany(company);
    setOwnerData(null);
    if (company.ownerUid && db) {
      setLoadingOwner(true);
      const ownerSnap = await getDoc(doc(db, 'global_users', company.ownerUid));
      if (ownerSnap.exists()) setOwnerData(ownerSnap.data());
      setLoadingOwner(false);
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
           <TabsTrigger value="requests" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">طلبات التأسيس المعلقة</TabsTrigger>
           <TabsTrigger value="companies" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">المنشآت المفعلة</TabsTrigger>
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
                    <TableRow key={req.id} className="hover:bg-primary/[0.01]">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm">{req.companyName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{req.email}</p>
                         </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{req.activity}</Badge></TableCell>
                      <TableCell><code className="text-[10px] bg-slate-100 px-2 py-1 rounded">{req.proposedPassword}</code></TableCell>
                      <TableCell className="pe-8 text-end">
                         <Button onClick={() => handleActivate(req)} disabled={!!processingId} size="sm" className="h-10 px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 border-b-4 border-emerald-800">
                            {processingId === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                            تأسيس وتفعيل الآن
                         </Button>
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
                    <TableHead>الحالة / الخطة</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead className="pe-8 text-end">التحكم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : companies?.map((comp: any) => (
                    <TableRow key={comp.id} className="hover:bg-primary/[0.01]">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-900 text-sm">{comp.name}</p>
                            <p className="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">ID: {comp.id}</p>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black text-[9px] uppercase px-3 py-1 rounded-md border-0 shadow-sm",
                           comp.status === 'active' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                         )}>
                            {comp.status === 'active' ? comp.subscriptionType : comp.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-slate-600 text-start">{comp.expiryDate?.split('T')[0] || '---'}</TableCell>
                      <TableCell className="pe-8 text-end">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(comp)} className="h-8 gap-2 border-2 hover:bg-slate-50">
                           <Settings2 className="h-3 w-3" /> إدارة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingCompany} onOpenChange={v => !v && setEditingCompany(null)}>
         <DialogContent className="rounded-3xl max-w-xl p-0 overflow-hidden border-0 shadow-3xl bg-white">
            <div className="bg-slate-50 p-8 border-b text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
                  <Settings2 className="h-7 w-7 text-primary" /> إدارة التراخيص
               </DialogTitle>
            </div>
            <div className="p-8 space-y-8 text-start">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">نوع الاشتراك</Label>
                     <Select value={editingCompany?.subscriptionType} onValueChange={v => setEditingCompany({...editingCompany, subscriptionType: v})}>
                        <SelectTrigger className="h-12 border-2 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           <SelectItem value="trial" className="font-bold">Trial</SelectItem>
                           <SelectItem value="monthly" className="font-bold">Monthly</SelectItem>
                           <SelectItem value="annual" className="font-bold">Annual</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ الانتهاء</Label>
                     <Input type="date" value={editingCompany?.expiryDate?.split('T')[0] || ''} onChange={e => setEditingCompany({...editingCompany, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} className="h-12 border-2 rounded-xl font-black text-center" />
                  </div>
               </div>
               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner">
                  <div className="space-y-1"><Label className="font-black text-base text-slate-800">الحالة التشغيلية</Label><p className="text-[10px] text-slate-400 font-bold">تعطيل وصول المنشأة للنظام</p></div>
                  <div className="flex gap-2">
                     <Button onClick={() => setEditingCompany({...editingCompany, status: 'active'})} variant={editingCompany?.status === 'active' ? 'default' : 'outline'} size="sm" className="h-10 rounded-xl font-black text-[10px]">ACTIVE</Button>
                     <Button onClick={() => setEditingCompany({...editingCompany, status: 'suspended'})} variant={editingCompany?.status === 'suspended' ? 'destructive' : 'outline'} size="sm" className="h-10 rounded-xl font-black text-[10px]">SUSPENDED</Button>
                  </div>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={() => setEditingCompany(null)} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl">تطبيق التعديلات</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
