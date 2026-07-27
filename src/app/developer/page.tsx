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
  CalendarDays, Play, Pause, Power, Info
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, parseISO, isAfter } from 'date-fns';

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

  const handleActivate = async (req: any, days: number = 7, type: string = 'trial') => {
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

  const handleSubscriptionTypeChange = (type: string) => {
    if (!editingCompany) return;
    
    let days = 0;
    if (type === 'trial') days = 7;
    else if (type === 'monthly') days = 30;
    else if (type === 'annual') days = 365;

    const newExpiry = addDays(new Date(), days).toISOString();
    
    setEditingCompany({
      ...editingCompany,
      subscriptionType: type,
      expiryDate: newExpiry,
      // فك التجميد تلقائياً عند التجديد المالي
      status: editingCompany.status === 'suspended' ? 'active' : editingCompany.status
    });
  };

  const handleUpdateSubscription = async () => {
    if (!db || !editingCompany) return;
    setProcessingId('saving');
    try {
      const ref = doc(db, 'companies', editingCompany.id);
      
      const now = new Date();
      const expiry = parseISO(editingCompany.expiryDate);
      
      let finalStatus = editingCompany.status;

      // أتمتة الحالة بناءً على التاريخ ما لم تكن مجمدة يدوياً
      if (finalStatus !== 'suspended') {
          finalStatus = isAfter(expiry, now) ? 'active' : 'expired';
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
        title: isRtl ? "تم تحديث بيانات الاشتراك" : "Subscription Updated",
        description: isRtl 
          ? `الحالة الحالية: ${finalStatus.toUpperCase()}` 
          : `Current Status: ${finalStatus.toUpperCase()}`
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
        <Card className="bg-slate-950 text-white rounded-[2rem] p-8 shadow-2xl border-0">
           <div className="text-start">
            <h4 className="text-slate-500 text-[10px] font-black uppercase mb-1 tracking-widest">طلبات جديدة</h4>
            <p className="text-5xl font-black font-headline text-primary">{requests?.filter(r => r.status === 'pending').length || 0}</p>
          </div>
        </Card>
        <Card className="bg-white rounded-[2rem] p-8 shadow-xl border-0 ring-1 ring-black/5">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 text-start tracking-widest">نشط</h4>
           <p className="text-5xl font-black font-headline text-emerald-600 text-start">{companies?.filter(c => c.status === 'active').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-8 shadow-xl border-0 ring-1 ring-black/5 text-start">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 tracking-widest">متوقف / منتهي</h4>
           <p className="text-5xl font-black font-headline text-rose-500">{companies?.filter(c => c.status !== 'active').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-8 shadow-xl border-0 ring-1 ring-black/5 text-start">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 tracking-widest">إجمالي العملاء</h4>
           <p className="text-5xl font-black font-headline text-slate-900">{companies?.length || 0}</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border-2 border-slate-100 h-16 rounded-2xl p-1.5 shadow-sm mb-8 gap-2">
           <TabsTrigger value="requests" className="rounded-xl px-10 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white transition-all">طلبات الانضمام</TabsTrigger>
           <TabsTrigger value="companies" className="rounded-xl px-10 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white transition-all">إدارة التراخيص</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2 duration-500">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50 border-b-2">
                  <TableRow>
                    <TableHead className="ps-10 py-6 font-black uppercase text-[10px] text-slate-500">المنشأة</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">النشاط</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">الحالة</TableHead>
                    <TableHead className="pe-10 text-end font-black uppercase text-[10px] text-slate-500">الإجراء</TableHead>
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
                           req.status === 'activated' ? "bg-emerald-50 text-white" : "bg-amber-100 text-amber-700"
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
                                 className="h-11 px-6 bg-primary text-white font-black text-xs rounded-xl shadow-lg"
                               >
                                  {processingId === req.id ? <Loader2 className="animate-spin" /> : <Power className="me-2 h-4 w-4" />}
                                  تفعيل تجريبي (7 أيام)
                               </Button>
                             </>
                           ) : (
                             <Badge variant="outline" className="border-emerald-200 text-emerald-600 font-black">طلب مكتمل</Badge>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="companies" className="animate-in fade-in duration-500">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50 border-b-2">
                  <TableRow>
                    <TableHead className="ps-10 py-6 font-black uppercase text-[10px] text-slate-500">المنشأة</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">الاشتراك</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">تاريخ الانتهاء</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">الحالة</TableHead>
                    <TableHead className="pe-10 text-end font-black uppercase text-[10px] text-slate-500">التحكم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : companies?.map((comp: any) => (
                    <TableRow key={comp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="ps-10 py-6">
                         <div className="text-start">
                            <p className="font-black text-slate-900 text-lg">{comp.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mt-1 uppercase">ID: {comp.id.slice(-6)}</p>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className="bg-blue-50 text-blue-600 border-0 text-[9px] font-black uppercase px-3 py-1">
                            {comp.subscriptionType}
                         </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-slate-600">
                         {comp.expiryDate ? comp.expiryDate.split('T')[0] : '---'}
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black px-4 py-1.5 text-[9px] uppercase border-0 shadow-sm",
                           comp.status === 'active' ? "bg-emerald-50 text-white" : 
                           comp.status === 'suspended' ? "bg-amber-50 text-white" : "bg-rose-50 text-white"
                         )}>{comp.status}</Badge>
                      </TableCell>
                      <TableCell className="pe-10 text-end">
                        <Button 
                          variant="outline" 
                          onClick={() => setEditingCompany({...comp})} 
                          className="h-10 px-5 rounded-xl border-2 font-black text-xs gap-2 hover:bg-primary hover:text-white transition-all"
                        >
                           <Settings2 className="h-4 w-4" /> إدارة الاشتراك
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Management Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={(v) => { if(!v) setEditingCompany(null); }}>
         <DialogContent className="rounded-[3rem] max-w-2xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-900 p-10 text-white text-start shrink-0">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                  <Building2 className="h-10 w-10 text-primary" /> 
                  إدارة المنشأة والاشتراك
               </DialogTitle>
               <p className="text-slate-400 font-bold mt-2 text-lg">{editingCompany?.name}</p>
            </div>

            <div className="p-10 space-y-10 text-start bg-white">
               
               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner">
                  <div className="text-start">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">حالة التشغيل الحالية</p>
                     <Badge className={cn(
                        "text-lg font-black uppercase px-6 py-2 border-0 shadow-xl",
                        editingCompany?.status === 'active' ? "bg-emerald-50 text-white" : 
                        editingCompany?.status === 'suspended' ? "bg-amber-50 text-white" : "bg-rose-50 text-white"
                     )}>
                        {editingCompany?.status}
                     </Badge>
                  </div>
                  <div className="flex gap-3">
                     {editingCompany?.status === 'suspended' ? (
                        <Button 
                          onClick={() => setEditingCompany({...editingCompany, status: 'active'})}
                          className="bg-emerald-600 text-white font-black rounded-xl h-14 px-8 shadow-lg gap-2"
                        >
                           <Play className="h-5 w-5" /> فك التجميد
                        </Button>
                     ) : (
                        <Button 
                          onClick={() => setEditingCompany({...editingCompany, status: 'suspended'})}
                          variant="destructive"
                          className="font-black rounded-xl h-14 px-8 shadow-lg gap-2"
                        >
                           <Pause className="h-5 w-5" /> تجميد مؤقت
                        </Button>
                     )}
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-3 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">نوع الباقة / الاشتراك</Label>
                     <Select value={editingCompany?.subscriptionType} onValueChange={handleSubscriptionTypeChange}>
                        <SelectTrigger className="h-14 border-2 rounded-2xl font-black text-lg">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                           <SelectItem value="trial" className="font-bold py-3">Trial (7 أيام)</SelectItem>
                           <SelectItem value="monthly" className="font-bold py-3">Monthly (30 يوماً)</SelectItem>
                           <SelectItem value="annual" className="font-bold py-3 text-primary">Annual (سنة كاملة)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-3 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">تاريخ الانتهاء (قابل للتعديل)</Label>
                     <Input 
                       type="date" 
                       value={editingCompany?.expiryDate ? editingCompany.expiryDate.split('T')[0] : ''} 
                       onChange={e => setEditingCompany({...editingCompany, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} 
                       className="h-14 border-2 rounded-2xl font-black text-lg shadow-inner bg-slate-50 focus:bg-white transition-all" 
                     />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                  <div className="space-y-3 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">سعة المستخدمين</Label>
                     <Input 
                       type="number" 
                       value={editingCompany?.maxUsers || 0} 
                       onChange={e => setEditingCompany({...editingCompany, maxUsers: Number(e.target.value)})} 
                       className="h-14 border-2 rounded-2xl font-black text-2xl text-center bg-slate-50 focus:bg-white" 
                     />
                  </div>
                  <div className="bg-blue-50 p-6 rounded-[2rem] border-2 border-white shadow-inner flex items-start gap-4">
                     <Info className="h-5 w-5 text-blue-500 shrink-0 mt-1" />
                     <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                        تنبيه: تحديث نوع الاشتراك يقوم بتعيين تاريخ انتهاء جديد تلقائياً من اليوم. يمكنك تعديل التاريخ يدوياً بعد الاختيار.
                     </p>
                  </div>
               </div>
            </div>
            
            <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4 shrink-0 shadow-2xl">
               <Button variant="outline" onClick={() => setEditingCompany(null)} className="flex-1 h-16 rounded-2xl border-2 font-black text-lg bg-white">إلغاء</Button>
               <Button onClick={handleUpdateSubscription} disabled={processingId === 'saving'} className="flex-[2] h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all border-b-8 border-orange-700">
                  {processingId === 'saving' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="me-2 h-6 w-6" />}
                  حفظ وتطبيق التغييرات السيادية
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}

