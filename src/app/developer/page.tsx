
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch, getDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { 
  Loader2, CheckCircle2, ShieldAlert, Ban, RefreshCw, 
  Edit3, Save, Users, Zap, Building2, 
  CalendarClock, Timer, ShieldCheck, AlertTriangle, X,
  ExternalLink, Lock, Unlock, CreditCard, History,
  CalendarDays, Play, Pause, Power, Info, Settings2, Sparkles,
  Search, Mail, Key, Copy, Eye, EyeOff, ChevronRight, Trash2
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

export default function DeveloperDashboard() {
  const { lang, dir, t } = useLanguage(); // تم تصحيح استخراج t هنا
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
  
  const [deletingCompany, setDeletingCompany] = useState<any>(null);
  const [deletingRequest, setDeletingRequest] = useState<any>(null);

  // استقرار الاستعلامات لمنع الانهيار الداخلي (Internal Assertion Failed)
  const companiesQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'companies')) : null, 
  [db, globalUser?.isDeveloper]);

  const requestsQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'company_requests')) : null, 
  [db, globalUser?.isDeveloper]);

  const { data: rawCompanies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: rawRequests, loading: requestsLoading } = useCollection<any>(requestsQuery);

  const companies = useMemo(() => {
    let list = [...(rawCompanies || [])];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => 
        (c.name || "").toLowerCase().includes(q) || 
        (c.id || "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [rawCompanies, searchTerm]);

  const requests = useMemo(() => {
    return [...(rawRequests || [])].sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }, [rawRequests]);

  const handleOpenEdit = async (company: any) => {
    setEditingCompany(company);
    setOwnerData(null);
    setShowPass(false);
    
    if (company.ownerUid && db) {
      setLoadingOwner(true);
      try {
        const ownerSnap = await getDoc(doc(db, 'global_users', company.ownerUid));
        if (ownerSnap.exists()) {
          setOwnerData(ownerSnap.data());
        }
      } catch (e) {
        console.error("Owner fetch failed", e);
      } finally {
        setLoadingOwner(false);
      }
    }
  };

  const handleActivate = async (req: any, days: number = 7, type: string = 'trial') => {
    if (!db) return;
    setProcessingId(req.id);
    try {
      const batch = writeBatch(db);
      const companyRef = doc(db, 'companies', req.companyId);
      const reqRef = doc(db, 'company_requests', req.id);
      const expiry = addDays(new Date(), days).toISOString();

      batch.update(companyRef, {
        status: 'active',
        subscriptionType: type,
        expiryDate: expiry,
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.update(reqRef, { status: 'activated', activatedAt: serverTimestamp() });

      if (req.ownerUid) {
        batch.update(doc(db, 'global_users', req.ownerUid), { isActive: true, isPendingApproval: false });
      }

      await batch.commit();
      toast({ title: isRtl ? "تم التفعيل بنجاح" : "Activated successfully" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteCompany = async () => {
    if (!db || !deletingCompany) return;
    setProcessingId('deleting');
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'companies', deletingCompany.id));
      if (deletingCompany.ownerUid) {
        batch.delete(doc(db, 'global_users', deletingCompany.ownerUid));
      }
      const reqQuery = query(collection(db, 'company_requests'), where('companyId', '==', deletingCompany.id));
      const reqSnap = await getDocs(reqQuery);
      reqSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: isRtl ? "تم حذف المنشأة نهائياً" : "Company deleted permanently" });
      setDeletingCompany(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Deletion Failed", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteRequest = async () => {
    if (!db || !deletingRequest) return;
    setProcessingId('deleting_req');
    try {
      await deleteDoc(doc(db, 'company_requests', deletingRequest.id));
      toast({ title: isRtl ? "تم حذف الطلب" : "Request deleted" });
      setDeletingRequest(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!db || !editingCompany) return;
    setProcessingId('saving');
    try {
      const ref = doc(db, 'companies', editingCompany.id);
      const now = new Date();
      const expiry = parseISO(editingCompany.expiryDate);
      let finalStatus = editingCompany.status;

      if (finalStatus !== 'suspended') {
          finalStatus = isAfter(expiry, now) ? 'active' : 'expired';
      }

      await updateDoc(ref, {
        name: editingCompany.name,
        status: finalStatus,
        subscriptionType: editingCompany.subscriptionType,
        expiryDate: editingCompany.expiryDate,
        maxUsers: Number(editingCompany.maxUsers),
        updatedAt: serverTimestamp()
      });

      if (editingCompany.ownerUid) {
         await updateDoc(doc(db, 'global_users', editingCompany.ownerUid), { 
           isActive: finalStatus === 'active' 
         });
      }

      toast({ title: t('saved') });
      setEditingCompany(null);
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 text-start" dir={dir}>
      <header className="flex justify-between items-end border-b pb-6">
        <div className="text-start">
          <h2 className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'بوابة الرقابة والاشتراكات' : 'Sovereign Control'}</h2>
          <div className="flex items-center gap-3 mt-1">
             <Badge className="bg-primary text-white border-0 text-[8px] uppercase tracking-widest px-3 rounded-full">God Mode Active</Badge>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
           <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
           <Input 
             placeholder={t('search')} 
             className="ps-9 h-10 rounded-xl bg-white border-2" 
             value={searchTerm} 
             onChange={e => setSearchTerm(e.target.value)} 
           />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border h-12 rounded-xl p-1.5 gap-2 mb-6 shadow-sm inline-flex">
           <TabsTrigger value="requests" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">طلبات الانضمام</TabsTrigger>
           <TabsTrigger value="companies" className="rounded-lg px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">إدارة التراخيص</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2">
           <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 ps-8">المنشأة</TableHead>
                    <TableHead>النشاط</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="pe-8 text-end">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-300 font-bold italic">لا يوجد طلبات انضمام.</TableCell></TableRow>
                  ) : requests.map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-primary/[0.01]">
                      <TableCell className="ps-8 py-4">
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm">{req.companyName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{req.email}</p>
                         </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{req.activity}</Badge></TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "text-[8px] font-black uppercase px-2 py-1 rounded-md", 
                           req.status === 'activated' ? "bg-emerald-50 text-emerald-600" : "bg-amber-500 text-white"
                         )}>
                           {req.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                         <div className="flex justify-end gap-2">
                           {req.status === 'pending' && (
                             <Button onClick={() => handleActivate(req)} disabled={!!processingId} size="sm" className="h-8 gap-2">
                                <Power className="h-3 w-3" /> تفعيل تجريبي
                             </Button>
                           )}
                           <Button variant="ghost" size="icon" onClick={() => setDeletingRequest(req)} className="h-8 w-8 text-rose-300 hover:text-rose-600">
                             <Trash2 className="h-4 w-4" />
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
                    <TableHead>الحالة / الخطة</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead className="pe-8 text-end">التحكم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : companies.map((comp: any) => (
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
                           comp.status === 'active' ? (
                             comp.subscriptionType === 'trial' ? "bg-indigo-500 text-white" :
                             comp.subscriptionType === 'monthly' ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"
                           ) : "bg-rose-500 text-white"
                         )}>
                            {comp.status === 'active' ? comp.subscriptionType : comp.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-slate-600 text-start">{comp.expiryDate?.split('T')[0] || '---'}</TableCell>
                      <TableCell className="pe-8 text-end">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(comp)} className="h-8 gap-2 border-2 hover:bg-slate-50">
                             <Settings2 className="h-3 w-3" /> إدارة
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingCompany(comp)} className="h-8 w-8 text-rose-300 hover:text-rose-600">
                             <Trash2 className="h-4 w-4" />
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

      <Dialog open={!!editingCompany} onOpenChange={v => !v && setEditingCompany(null)}>
         <DialogContent className="rounded-3xl max-w-xl p-0 overflow-hidden border-0 shadow-3xl bg-white flex flex-col h-fit max-h-[90vh]">
            <div className="bg-slate-50 p-8 border-b shrink-0 text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
                  <Settings2 className="h-7 w-7 text-primary" /> إدارة تراخيص {editingCompany?.name}
               </DialogTitle>
            </div>
            <div className="p-8 space-y-8 text-start overflow-y-auto scrollbar-hide">
               <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/10 space-y-4">
                  <div className="flex items-center justify-between">
                     <h5 className="font-black text-[10px] uppercase tracking-widest text-primary flex items-center gap-2"><Key className="h-4 w-4" /> بيانات دخول المالك</h5>
                     {loadingOwner && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Email</Label>
                        <div className="relative group">
                           <Input readOnly value={ownerData?.email || '...'} className="h-10 rounded-xl bg-white border-2 font-mono text-[10px] pr-10" />
                           <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(ownerData?.email || ''); toast({title: "Copied"}); }} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-300 hover:text-primary"><Copy className="h-3.5 w-3.5" /></Button>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Password</Label>
                        <div className="relative">
                           <Input type={showPass ? "text" : "password"} readOnly value={ownerData?.initialPassword || '••••••••'} className="h-10 rounded-xl bg-white border-2 font-mono text-[10px] pr-10" />
                           <Button variant="ghost" size="icon" onClick={() => setShowPass(!showPass)} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-300 hover:text-primary">{showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">نوع الاشتراك</Label>
                     <Select value={editingCompany?.subscriptionType} onValueChange={v => setEditingCompany({...editingCompany, subscriptionType: v})}>
                        <SelectTrigger className="h-12 border-2 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl">
                           <SelectItem value="trial" className="font-bold">Trial (7 Days)</SelectItem>
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
                  <div className="space-y-1"><Label className="font-black text-base text-slate-800">الحالة التشغيلية</Label><p className="text-[10px] text-slate-400 font-bold">تغيير حالة وصول المنشأة للنظام</p></div>
                  <div className="flex gap-2">
                     <Button onClick={() => setEditingCompany({...editingCompany, status: 'active'})} variant={editingCompany?.status === 'active' ? 'default' : 'outline'} size="sm" className="h-10 rounded-xl font-black text-[10px]">ACTIVE</Button>
                     <Button onClick={() => setEditingCompany({...editingCompany, status: 'suspended'})} variant={editingCompany?.status === 'suspended' ? 'destructive' : 'outline'} size="sm" className="h-10 rounded-xl font-black text-[10px]">SUSPENDED</Button>
                  </div>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t shrink-0">
               <Button onClick={handleUpdateSubscription} disabled={processingId === 'saving'} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl gap-3 border-b-8 border-orange-700 hover:scale-[1.02] transition-all">
                  {processingId === 'saving' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} حفظ وتطبيق التعديلات السيادية
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCompany} onOpenChange={v => !v && setDeletingCompany(null)}>
         <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[200]">
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50"><Trash2 className="h-10 w-10" /></div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">حذف المنشأة نهائياً</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">هل أنت متأكد؟ سيتم حذف منشأة <strong>{deletingCompany?.name}</strong> وكافة سجلات المالك العالمي نهائياً. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white">إلغاء</AlertDialogCancel>
               <AlertDialogAction onClick={handleDeleteCompany} disabled={processingId === 'deleting'} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl">{processingId === 'deleting' ? <Loader2 className="animate-spin h-5 w-5" /> : 'نعم، احذف المنشأة'}</AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingRequest} onOpenChange={v => !v && setDeletingRequest(null)}>
         <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[200]">
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50"><X className="h-10 w-10" /></div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">حذف طلب الانضمام</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">هل تريد حذف طلب انضمام <strong>{deletingRequest?.companyName}</strong> من القائمة؟</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white">إلغاء</AlertDialogCancel>
               <AlertDialogAction onClick={handleDeleteRequest} disabled={processingId === 'deleting_req'} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl">{processingId === 'deleting_req' ? <Loader2 className="animate-spin h-5 w-5" /> : 'نعم، احذف الطلب'}</AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
