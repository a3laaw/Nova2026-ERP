
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { 
  Loader2, CheckCircle, ShieldAlert, Ban, RefreshCcw, 
  Edit3, Save, Users, Zap, Building2, 
  CalendarClock, Timer, ShieldCheck, AlertTriangle, X,
  ExternalLink, Lock, Unlock, CreditCard, History,
  CalendarDays
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, parseISO } from 'date-fns';

export default function DeveloperDashboard() {
  const { lang, dir } = useLanguage();
  const { globalUser, loading: authLoading } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [activeTab, setActiveTab] = useState("requests");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);

  const companiesQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'companies')) : null, 
  [db, globalUser?.isDeveloper]);

  const requestsQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'company_requests')) : null, 
  [db, globalUser?.isDeveloper]);

  const { data: rawCompanies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: rawRequests, loading: requestsLoading } = useCollection<any>(requestsQuery);

  const companies = useMemo(() => {
    return [...rawCompanies].sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0;
      const dateB = b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });
  }, [rawCompanies]);

  const requests = useMemo(() => {
    return [...rawRequests].sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0;
      const dateB = b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });
  }, [rawRequests]);

  const handleActivate = async (req: any, days: number = 7, type: 'trial' | 'annual' = 'trial') => {
    if (!db) return;
    setProcessingId(req.id);
    try {
      const batch = writeBatch(db);
      const companyRef = doc(db, 'companies', req.companyId);
      const reqRef = doc(db, 'company_requests', req.id);
      
      const expiry = addDays(new Date(), days);
      const expiryStr = expiry.toISOString();

      batch.update(companyRef, {
        status: 'active',
        subscriptionType: type,
        expiryDate: expiryStr,
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.update(reqRef, { status: 'activated', activatedAt: serverTimestamp() });

      if (req.ownerUid) {
        const globalUserRef = doc(db, 'global_users', req.ownerUid);
        batch.update(globalUserRef, { isActive: true, isPendingApproval: false });
      }

      await batch.commit();
      toast({ title: isRtl ? `تم التفعيل لـ ${days} يوم` : `Activated for ${days} days` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Activation Error", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!db || !editingCompany) return;
    setProcessingId('saving');
    try {
      const ref = doc(db, 'companies', editingCompany.id);
      
      const today = new Date();
      const expiry = editingCompany.expiryDate ? new Date(editingCompany.expiryDate) : today;
      
      let finalStatus = editingCompany.status;

      // بروتوكول التنشيط التلقائي: الحالة تتبع التاريخ المختار دائماً ما لم تكن "مجمدة إدارياً"
      if (finalStatus !== 'suspended' && finalStatus !== 'inactive') {
          finalStatus = expiry > today ? 'active' : 'expired';
      }

      const updates = {
        name: editingCompany.name || '',
        status: finalStatus,
        subscriptionType: editingCompany.subscriptionType || 'trial',
        expiryDate: editingCompany.expiryDate || new Date().toISOString(),
        maxUsers: Number(editingCompany.maxUsers) || 5,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(ref, updates);

      if (editingCompany.ownerUid) {
         const globalRef = doc(db, 'global_users', editingCompany.ownerUid);
         await updateDoc(globalRef, { isActive: finalStatus === 'active' });
      }

      toast({ 
        title: isRtl ? "تم تطبيق التغييرات السيادية" : "Changes Applied",
        description: isRtl 
          ? `حالة المنشأة الآن: ${finalStatus.toUpperCase()} (تلقائي)` 
          : `Status is now ${finalStatus.toUpperCase()} (Auto)`
      });
      setEditingCompany(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update Failed", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Verifying Dev Identity...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-start" dir={dir}>
      <div className="flex justify-between items-end">
        <div className="text-start">
            <h2 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'بوابة الرقابة والاشتراكات' : 'Subscription Control'}</h2>
            <Badge className="bg-slate-900 text-primary mt-2 uppercase tracking-widest text-[10px] px-4 py-1">NovaFlow Sovereign Engine</Badge>
        </div>
        <div className="flex gap-4">
           <Card className="bg-white px-6 py-3 rounded-2xl shadow-sm border-2 flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary animate-pulse" />
              <div className="text-start">
                 <p className="text-[8px] font-black text-slate-400 uppercase">System Status</p>
                 <p className="text-xs font-black text-emerald-600 uppercase">All Nodes Online</p>
              </div>
           </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-950 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border-0">
           <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12"><Zap className="h-32 w-32 text-primary" /></div>
           <div className="text-start relative z-10">
            <h4 className="text-slate-500 text-[10px] font-black uppercase mb-1 tracking-widest">طلبات بانتظار المراجعة</h4>
            <p className="text-5xl font-black font-headline text-primary">{requests?.filter(r => r.status === 'pending').length || 0}</p>
          </div>
        </Card>
        <Card className="bg-white rounded-[2rem] p-8 shadow-xl border-0 ring-1 ring-black/5">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 text-start tracking-widest">المنشآت النشطة حالياً</h4>
           <p className="text-5xl font-black font-headline text-emerald-600 text-start">{companies?.filter(c => c.status === 'active').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-8 shadow-xl border-0 ring-1 ring-black/5">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 text-start tracking-widest">اشتراكات منتهية</h4>
           <p className="text-5xl font-black font-headline text-rose-500 text-start">{companies?.filter(c => c.status === 'expired' || c.status === 'suspended').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-8 shadow-xl border-0 ring-1 ring-black/5">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 text-start tracking-widest">إجمالي التراخيص</h4>
           <p className="text-5xl font-black font-headline text-slate-900 text-start">{companies?.length || 0}</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border-2 border-slate-100 h-16 rounded-[1.5rem] p-1.5 shadow-sm mb-8 gap-2">
           <TabsTrigger value="requests" className="rounded-xl px-10 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white">طلبات الانضمام</TabsTrigger>
           <TabsTrigger value="companies" className="rounded-xl px-10 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white">إدارة التراخيص والمنشآت</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2 duration-500">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50 border-b-2">
                  <TableRow>
                    <TableHead className="ps-10 py-6 font-black uppercase text-[10px] text-slate-500 tracking-widest">المنشأة المستهدفة</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">النشاط</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">حالة الطلب</TableHead>
                    <TableHead className="pe-10 text-end font-black uppercase text-[10px] text-slate-500 tracking-widest">القرار الفني</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : requests?.map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="ps-10 py-6">
                         <div className="flex flex-col text-start">
                            <span className="font-black text-slate-800 text-lg">{req.companyName}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{req.email}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary px-3 h-6 rounded-lg">{req.activity}</Badge>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black text-[9px] uppercase px-4 py-1 border-0 shadow-sm",
                           req.status === 'activated' ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                         )}>
                           {req.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="pe-10 text-end">
                        <div className="flex justify-end gap-3">
                           {req.status === 'pending' ? (
                             <>
                               <Button 
                                 onClick={() => handleActivate(req, 7, 'trial')} 
                                 disabled={processingId === req.id} 
                                 className="h-11 px-6 bg-primary text-white font-black text-xs rounded-xl shadow-lg shadow-primary/10 hover:scale-105 transition-all"
                               >
                                  {processingId === req.id ? <Loader2 className="animate-spin" /> : <Zap className="me-2 h-4 w-4" />}
                                  تفعيل 7 أيام تجربة
                               </Button>
                               <Button 
                                 onClick={() => handleActivate(req, 365, 'annual')} 
                                 disabled={processingId === req.id} 
                                 variant="secondary" 
                                 className="h-11 px-6 font-black text-xs rounded-xl shadow-lg"
                               >
                                  تفعيل سنة كاملة
                               </Button>
                             </>
                           ) : (
                             <Button 
                               onClick={() => { setActiveTab('companies'); }} 
                               variant="outline" 
                               className="h-11 px-8 rounded-xl font-black text-xs gap-2 border-2 text-emerald-600 border-emerald-100 bg-emerald-50"
                             >
                                <CheckCircle className="h-4 w-4" /> تم التفعيل (إدارة المنشأة)
                             </Button>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests?.length === 0 && !requestsLoading && (
                    <TableRow><TableCell colSpan={4} className="text-center py-32 italic text-slate-300 font-black">لا يوجد طلبات انضمام حالياً.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="companies" className="animate-in fade-in duration-500">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50 border-b-2">
                  <TableRow>
                    <TableHead className="ps-10 py-6 font-black uppercase text-[10px] text-slate-500 tracking-widest">المنشأة المسجلة</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">الاشتراك</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">تاريخ الانتهاء</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">حالة الترخيص</TableHead>
                    <TableHead className="pe-10 text-end font-black uppercase text-[10px] text-slate-500 tracking-widest">تحكم سيادي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : companies?.map((comp: any) => (
                    <TableRow key={comp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="ps-10 py-6">
                         <div className="text-start">
                            <p className="font-black text-slate-900 text-lg leading-none">{comp.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono font-bold mt-2 uppercase tracking-tighter">TENANT_ID: {comp.id}</p>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "bg-blue-50 text-blue-600 border-0 text-[9px] font-black uppercase px-3 py-1 rounded-lg",
                           comp.subscriptionType === 'annual' && "bg-indigo-50 text-indigo-600"
                         )}>
                            {comp.subscriptionType}
                         </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-slate-600">
                         {comp.expiryDate ? comp.expiryDate.split('T')[0] : '---'}
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black px-4 py-1.5 text-[9px] uppercase border-0 shadow-sm",
                           comp.status === 'active' ? "bg-emerald-500 text-white" : 
                           comp.status === 'suspended' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                         )}>{comp.status}</Badge>
                      </TableCell>
                      <TableCell className="pe-10 text-end">
                        <Button 
                          variant="outline" 
                          onClick={() => setEditingCompany({...comp})} 
                          className="h-11 px-6 rounded-xl border-2 font-black text-xs gap-2 hover:bg-primary hover:text-white transition-all"
                        >
                           <Edit3 className="h-4 w-4" /> إدارة المنشأة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Sovereign Management Console Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={(open) => { if(!open) setEditingCompany(null); }}>
         <DialogContent className="rounded-[3rem] max-w-2xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-950 p-10 text-white text-start relative overflow-hidden shrink-0">
               <div className="absolute top-0 right-0 p-10 opacity-10"><ShieldCheck className="h-40 w-40 text-primary" /></div>
               <div className="relative z-10">
                  <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                     <Building2 className="h-10 w-10 text-primary" /> 
                     {isRtl ? 'لوحة تحكم المنشأة السيادية' : 'Tenant Admin Console'}
                  </DialogTitle>
                  <p className="text-slate-400 font-bold mt-2 text-lg uppercase tracking-widest">{editingCompany?.name}</p>
               </div>
            </div>

            <div className="p-10 space-y-10 text-start bg-white max-h-[60vh] overflow-y-auto scrollbar-hide">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{isRtl ? 'حالة التشغيل والوصول' : 'Operational Status'}</Label>
                     <Select value={editingCompany?.status || 'active'} onValueChange={v => setEditingCompany({...editingCompany, status: v})}>
                        <SelectTrigger className="h-14 border-2 rounded-2xl font-black text-lg">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-0 shadow-2xl">
                           <SelectItem value="active" className="font-bold py-3 text-emerald-600">
                             {isRtl ? 'تنشيط (تلقائي حسب التاريخ)' : 'Normal (Auto-Sync)'}
                           </SelectItem>
                           <SelectItem value="suspended" className="font-bold py-3 text-amber-600">
                             {isRtl ? 'تجميد إداري (يدوي)' : 'Suspended (Administrative)'}
                           </SelectItem>
                           <SelectItem value="inactive" className="font-bold py-3 text-slate-400">
                             {isRtl ? 'غير مفعل' : 'Inactive'}
                           </SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{isRtl ? 'نوع الاشتراك المالي' : 'Subscription Type'}</Label>
                     <Select value={editingCompany?.subscriptionType || 'trial'} onValueChange={v => setEditingCompany({...editingCompany, subscriptionType: v})}>
                        <SelectTrigger className="h-14 border-2 rounded-2xl font-black text-lg">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-0 shadow-2xl">
                           <SelectItem value="trial" className="font-bold py-3">Trial (فترة تجريبية)</SelectItem>
                           <SelectItem value="annual" className="font-bold py-3 text-primary">Annual (اشتراك سنوي معتمد)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'تاريخ تجديد الاشتراك (حر)' : 'Renew Until (Free Date)'}
                     </Label>
                     <Input 
                       type="date" 
                       value={editingCompany?.expiryDate ? editingCompany.expiryDate.split('T')[0] : ''} 
                       onChange={e => setEditingCompany({...editingCompany, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} 
                       className="h-14 border-2 rounded-2xl font-black text-lg bg-slate-50 focus:bg-white transition-all shadow-inner" 
                     />
                  </div>
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" /> {isRtl ? 'سعة المستخدمين (Licensing)' : 'Max User Capacity'}
                     </Label>
                     <Input 
                       type="number" 
                       value={editingCompany?.maxUsers || 0} 
                       onChange={e => setEditingCompany({...editingCompany, maxUsers: Number(e.target.value)})} 
                       className="h-14 border-2 rounded-2xl font-black text-2xl text-center bg-slate-50 focus:bg-white shadow-inner" 
                     />
                  </div>
               </div>

               <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/20 space-y-4">
                  <div className="flex items-center gap-4 text-primary">
                     <CreditCard className="h-6 w-6" />
                     <h5 className="font-black text-sm uppercase tracking-widest">{isRtl ? 'محرك التجديد الآلي' : 'Auto-Renewal Engine'}</h5>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                     {isRtl 
                       ? 'تنبيه: سيقوم النظام تلقائياً بتحديث حالة المنشأة إلى (نشط) فور اختيارك لتاريخ مستقبلي والضغط على حفظ، ما لم تكن المنشأة تحت التجميد الإداري اليدوي.' 
                       : 'Note: Status will automatically flip to ACTIVE if a future date is selected and saved, provided no manual suspension is active.'}
                  </p>
               </div>
            </div>
            
            <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
               <Button variant="outline" onClick={() => setEditingCompany(null)} className="flex-1 h-16 rounded-2xl border-2 font-black text-lg bg-white">إلغاء</Button>
               <Button onClick={handleUpdateSubscription} disabled={processingId === 'saving'} className="flex-[2] h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border-b-8 border-orange-700">
                  {processingId === 'saving' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="me-2 h-6 w-6" />}
                  حفظ وتطبيق التغييرات السيادية
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
