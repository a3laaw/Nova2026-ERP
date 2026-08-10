'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch, getDocs, setDoc, deleteDoc, where, limit } from 'firebase/firestore';
import { 
  Loader2, CheckCircle2, RefreshCw, 
  Save, Building2, ShieldCheck, Trash2, 
  Power, Search, Key, Copy, Eye, EyeOff,
  Settings2, Zap, Rocket, AlertTriangle,
  Clock, CalendarClock, Ban, CheckCircle,
  X, Fingerprint, Database, SearchCode,
  ArrowRight, ShieldAlert, GitBranch
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, parseISO } from 'date-fns';
import { UserService } from '@/services/user-service';
import { SeedService } from '@/services/seed-service';

export default function DeveloperDashboard() {
  const { lang, dir, t, tSafe } = useLanguage(); 
  const { globalUser, loading: authLoading } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [activeTab, setActiveTab] = useState("integrity"); 
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [deletingContext, setDeletingContext] = useState<{ id: string, type: 'request' | 'company' } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [migrating, setMigrating] = useState(false);

  const companiesQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'companies')) : null, 
  [db, globalUser?.isDeveloper]);

  const requestsQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'company_requests')) : null, 
  [db, globalUser?.isDeveloper]);

  const { data: companies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: requests, loading: requestsLoading } = useCollection<any>(requestsQuery);

  const [diagTransaction, setDiagTransaction] = useState<any>(null);
  const [diagTemplates, setDiagTemplates] = useState<any[]>([]);
  const [loadingDiag, setLoadingDiag] = useState(false);

  const runDiagnostics = async () => {
    if (!db) return;
    setLoadingDiag(true);
    try {
      const targetCompanyId = 'comp_x898l4i70';
      const targetClientId = '8MbfW3Aexh8Nkz2adHOI';

      const transQ = query(
        collection(db, 'companies', targetCompanyId, 'transactions'),
        where('clientId', '==', targetClientId),
        limit(1)
      );
      const transSnap = await getDocs(transQ);
      const trans = transSnap.empty ? null : transSnap.docs[0].data();
      setDiagTransaction(trans);

      const tempsQ = collection(db, 'companies', targetCompanyId, 'boqTemplates');
      const tempsSnap = await getDocs(tempsQ);
      const temps = tempsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDiagTemplates(temps);

      toast({ title: tSafe('inline.diag.complete', 'اكتمل الفحص الميداني', 'Diagnostic Complete') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoadingDiag(false);
    }
  };

  const handleIdentityMigration = async () => {
    if (!db || !globalUser?.companyId) return;
    setMigrating(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      const count = await service.runIdentityMigration();
      toast({ title: tSafe('inline.identity.fixed', 'تم إصلاح الهويات', 'Identity Fixed'), description: `Updated ${count} users.` });
    } finally { setMigrating(false); }
  };

  const handleActivate = async (req: any) => {
    if (!db) return;
    setProcessingId(req.id);
    const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
    const userService = new UserService(db, companyId);
    try {
      const batch = writeBatch(db);
      const companyRef = doc(db, 'companies', companyId);
      const expiry = addDays(new Date(), 7).toISOString();
      batch.set(companyRef, {
        id: companyId, name: req.companyName, status: 'active',
        subscriptionType: 'trial', expiryDate: expiry, activity: req.activity,
        maxUsers: 5, ownerEmail: req.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      const roleRef = doc(collection(db, 'companies', companyId, 'roles'));
      batch.set(roleRef, {
        code: 'ADMIN', name: 'مدير النظام', nameEn: 'System Admin',
        permissions: ['*'], matrix: [{ resourceId: '*', action: 'view', scope: 'all' }],
        isSystemRole: true, isActive: true, order: 1, companyId: companyId, createdAt: serverTimestamp()
      });
      const deptRef = doc(collection(db, 'companies', companyId, 'departments'));
      batch.set(deptRef, { name: 'الإدارة العليا', nameEn: 'General Management', isActive: true, order: 1, companyId: companyId, createdAt: serverTimestamp() });
      const jobRef = doc(collection(db, 'companies', companyId, 'departments', deptRef.id, 'jobs'));
      batch.set(jobRef, { name: 'المدير العام', nameEn: 'General Manager', roleId: roleRef.id, roleCode: 'ADMIN', hourlyCost: 0, isActive: true, order: 1, companyId: companyId, createdAt: serverTimestamp() });
      await batch.commit();
      const empId = `emp_1001`;
      const uid = await userService.createUserAccount({ employeeId: empId, employeeName: req.contactName, email: req.email, username: req.proposedUsername || req.email.split('@')[0], password: req.proposedPassword, roleId: roleRef.id, roleCode: 'ADMIN', departmentId: deptRef.id });
      await setDoc(doc(db, 'companies', companyId, 'employees', empId), { id: empId, employeeNumber: '1001', fullName: req.contactName, email: req.email, mobile: req.phone, departmentId: deptRef.id, departmentName: 'الإدارة العليا', jobId: jobRef.id, jobTitle: 'المدير العام', status: 'active', employeeType: 'internal', hireDate: new Date().toISOString().split('T')[0], basicSalary: 0, annualLeaveBalance: 30, isActive: true, companyId: companyId, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'company_requests', req.id), { status: 'activated', activatedAt: serverTimestamp(), companyId: companyId, ownerUid: uid });
      toast({ title: tSafe('inline.provisioning.success', 'تم التأسيس بنجاح', 'Provisioning Success') });
    } finally { setProcessingId(null); }
  };

  if (authLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 text-start" dir={dir}>
      <header className="flex justify-between items-end border-b pb-6">
        <div className="text-start">
          <h2 className="text-2xl font-black font-headline text-slate-900">{tSafe('inline.sovereign.dev.console', 'لوحة تحكم المطور السيادية', 'Sovereign Dev Console')}</h2>
          <Badge className="bg-primary text-white border-0 text-[8px] uppercase px-3 rounded-full mt-2">{tSafe('inline.core.kernel.maintenance', 'صيانة النواة الأساسية', 'Core Kernel Maintenance')}</Badge>
        </div>
        <div className="flex gap-3">
           <Button onClick={handleIdentityMigration} disabled={migrating} variant="outline" className="h-10 rounded-xl border-2 font-black gap-2">
              {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              {tSafe('inline.fix.identities', 'إصلاح الهويات', 'Fix Identities')}
           </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border h-12 rounded-xl p-1.5 gap-2 mb-6 shadow-sm inline-flex">
           <TabsTrigger value="integrity" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <SearchCode className="h-4 w-4" /> {tSafe('inline.path.integrity', 'فحص مطابقة المسارات', 'Path Integrity')}
           </TabsTrigger>
           <TabsTrigger value="requests" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Zap className="h-4 w-4" /> {tSafe('inline.requests', 'طلبات التأسيس', 'Requests')}
           </TabsTrigger>
           <TabsTrigger value="companies" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Building2 className="h-4 w-4" /> {tSafe('inline.companies', 'المنشآت المفعلة', 'Companies')}
           </TabsTrigger>
        </TabsList>

        <TabsContent value="integrity" className="animate-in slide-in-from-bottom-2 space-y-6">
           <Card className="border-0 shadow-2xl rounded-3xl bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50 p-8 border-b flex flex-row items-center justify-between">
                 <div className="text-start">
                    <CardTitle className="text-xl font-black">{tSafe('inline.diag.tool.title', 'أداة فحص سلامة الربط', 'Diagnostic Tool')}</CardTitle>
                    <p className="text-xs font-bold text-slate-400 mt-1">{tSafe('inline.diag.tool.desc', 'تقوم هذه الأداة بالتحقق من مطابقة subServiceId بين المعاملة والقوالب.', 'This tool verifies subServiceId matching between transaction and templates.')}</p>
                 </div>
                 <Button onClick={runDiagnostics} disabled={loadingDiag} className="h-12 px-8 rounded-xl bg-slate-900 text-white font-black gap-2 shadow-xl">
                    {loadingDiag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {tSafe('inline.run.diag', 'تشغيل الفحص الآن', 'Run Diagnostics')}
                 </Button>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                 {loadingDiag ? (
                   <div className="py-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/20" /></div>
                 ) : !diagTransaction ? (
                   <div className="py-20 text-center opacity-30 italic font-bold">{tSafe('inline.no.data.diag', 'لا يوجد بيانات للعرض. اضغط على تشغيل الفحص.', 'No data to display. Click run diagnostics.')}</div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-4">
                         <h4 className="text-sm font-black text-primary uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" /> {tSafe('inline.target.transaction', 'بيانات المعاملة المستهدفة', 'Target Transaction')}
                         </h4>
                         <div className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 space-y-4 text-start">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-slate-400 uppercase">{t('projectId')}</p>
                               <p className="text-xs font-mono font-bold bg-white p-2 rounded border truncate">{diagTransaction.id}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-primary uppercase">{tSafe('inline.subservice.key', 'مفتاح المسار الفرعي', 'subServiceId (The Key)')}</p>
                               <div className="bg-primary/10 text-primary p-3 rounded-xl border-2 border-primary/20 font-mono text-sm font-black break-all">
                                  {diagTransaction.subServiceId}
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                            <Database className="h-4 w-4" /> {tSafe('inline.available.templates', 'القوالب المتوفرة', 'Available Templates')}
                         </h4>
                         <div className="space-y-3">
                            {diagTemplates.map(t => {
                               const isMatch = t.subServiceId === diagTransaction.subServiceId;
                               return (
                                 <div key={t.id} className={cn(
                                   "p-5 rounded-2xl border-2 transition-all",
                                   isMatch ? "bg-emerald-50 border-emerald-500 shadow-lg" : "bg-rose-50 border-rose-200"
                                 )}>
                                    <div className="flex justify-between items-start mb-2">
                                       <p className="font-black text-xs text-slate-800">{t.name}</p>
                                       <Badge className={isMatch ? "bg-emerald-600" : "bg-rose-600"}>
                                          {isMatch ? tSafe('inline.matched', 'مطابق', 'MATCHED') : tSafe('inline.mismatch', 'غير مطابق', 'MISMATCH')}
                                       </Badge>
                                    </div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{tSafe('inline.subservice.in.template', 'المسار الفرعي في القالب:', 'subServiceId in Template:')}</p>
                                    <p className="text-xs font-mono font-bold bg-white/50 p-2 rounded truncate">{t.subServiceId}</p>
                                 </div>
                               );
                            })}
                            {diagTemplates.length === 0 && <p className="text-xs font-bold text-rose-500 italic">{tSafe('inline.no.templates.found.db', 'لا توجد قوالب في قاعدة البيانات.', 'No templates found in database.')}</p>}
                         </div>
                      </div>
                   </div>
                 )}
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2">
           <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 ps-8">{t('common.company')}</TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead className="pe-8 text-end">{tSafe('inline.sovereign.action', 'الإجراء السيادي', 'Sovereign Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests?.filter(r => r.status === 'pending').map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-primary/[0.01] group border-b-slate-50">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm">{req.companyName}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">{req.email}</p>
                         </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{req.activity}</Badge></TableCell>
                      <TableCell className="pe-8 text-end">
                         <Button onClick={() => handleActivate(req)} disabled={!!processingId} size="sm" className="h-10 px-6 gap-2 bg-emerald-600 text-white font-black shadow-lg shadow-emerald-100">
                            {processingId === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                            {tSafe('inline.provision.activate', 'تأسيس وتفعيل', 'Provision & Activate')}
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
                    <TableHead className="py-4 ps-8">{t('common.company')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="pe-8 text-end">{tSafe('inline.control', 'التحكم', 'Control')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies?.map((comp: any) => (
                    <TableRow key={comp.id} className="hover:bg-primary/[0.01] group border-b-slate-50">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-900 text-sm">{comp.name}</p>
                            <p className="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">ID: {comp.id}</p>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black text-[9px] uppercase px-3 py-1 rounded-md border-0 shadow-sm",
                           comp.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                         )}>
                            {comp.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingCompany(comp)} className="h-9 gap-2 border-2 font-bold text-xs rounded-xl shadow-sm">
                           <Settings2 className="h-3.5 w-3.5" /> {tSafe('inline.manage.licenses', 'إدارة التراخيص', 'Manage Licenses')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}