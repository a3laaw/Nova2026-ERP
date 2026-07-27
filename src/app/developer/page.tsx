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
  Loader2, CheckCircle2, ShieldAlert, Ban, RefreshCcw, 
  Edit3, Save, Users, Zap, Building2, 
  CalendarClock, Timer, ShieldCheck, AlertTriangle, X,
  ExternalLink, Lock, Unlock, CreditCard, History,
  CalendarDays, Play, Pause, Power, Info, Settings2, Sparkles
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

  const handlePlanChange = (type: string) => {
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
      status: (editingCompany.status === 'suspended' || editingCompany.status === 'expired') ? 'active' : editingCompany.status
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

      toast({ title: isRtl ? "تم تحديث بيانات الاشتراك" : "Subscription Updated" });
      setEditingCompany(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update Failed", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 text-start animate-in fade-in duration-700" dir={dir}>
      <div className="flex justify-between items-end border-b-2 border-primary/10 pb-8">
        <div className="text-start">
            <h2 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'بوابة الرقابة والاشتراكات' : 'Subscription Control'}</h2>
            <div className="flex items-center gap-3 mt-2">
               <Badge className="bg-primary text-white border-0 uppercase tracking-widest text-[9px] px-4 py-1 rounded-full shadow-lg">Sovereign Core</Badge>
               <span className="text-[10px] font-bold text-slate-400">NovaFlow Cloud Enforcement</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white rounded-[2rem] p-6 shadow-xl border-0 ring-1 ring-black/5 border-b-8 border-b-primary text-start group hover:scale-105 transition-all">
           <div className="flex items-center justify-between mb-2">
              <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">طلبات جديدة</h4>
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Users className="h-4 w-4" /></div>
           </div>
           <p className="text-4xl font-black font-headline text-slate-900">{requests?.filter(r => r.status === 'pending').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-6 shadow-xl border-0 ring-1 ring-black/5 border-b-8 border-b-emerald-500 text-start group hover:scale-105 transition-all">
           <div className="flex items-center justify-between mb-2">
              <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">نشط</h4>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500"><ShieldCheck className="h-4 w-4" /></div>
           </div>
           <p className="text-4xl font-black font-headline text-emerald-600">{companies?.filter(c => c.status === 'active').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-6 shadow-xl border-0 ring-1 ring-black/5 border-b-8 border-b-rose-500 text-start group hover:scale-105 transition-all">
           <div className="flex items-center justify-between mb-2">
              <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">متوقف / منتهي</h4>
              <div className="h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500"><Ban className="h-4 w-4" /></div>
           </div>
           <p className="text-4xl font-black font-headline text-rose-500">{companies?.filter(c => c.status !== 'active').length || 0}</p>
        </Card>
        <Card className="bg-white rounded-[2rem] p-6 shadow-xl border-0 ring-1 ring-black/5 border-b-8 border-b-slate-900 text-start group hover:scale-105 transition-all">
           <div className="flex items-center justify-between mb-2">
              <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">إجمالي العملاء</h4>
              <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><Building2 className="h-4 w-4" /></div>
           </div>
           <p className="text-4xl font-black font-headline text-slate-900">{companies?.length || 0}</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border-2 border-slate-100 h-14 rounded-2xl p-1 shadow-sm mb-6 gap-2">
           <TabsTrigger value="requests" className="rounded-xl px-10 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">طلبات الانضمام</TabsTrigger>
           <TabsTrigger value="companies" className="rounded-xl px-10 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">إدارة التراخيص</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2 duration-500">
           <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50/50 border-b">
                  <TableRow>
                    <TableHead className="ps-8 py-6 font-black uppercase text-[10px] text-slate-500">المنشأة</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">النشاط</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">الحالة</TableHead>
                    <TableHead className="pe-8 text-end font-black uppercase text-[10px] text-slate-500">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : requests?.map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-50">
                      <TableCell className="ps-8 py-6 text-start">
                         <div className="flex items-center gap-5">
                            <div className="h-11 w-11 rounded-xl bg-white shadow-lg flex items-center justify-center text-primary font-black border border-primary/10">
                               {req.companyName?.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                               <span className="font-black text-slate-800 text-base">{req.companyName}</span>
                               <span className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">{req.email}</span>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary px-3 h-6 rounded-lg">{req.activity}</Badge>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black text-[9px] uppercase px-4 py-1 border-0 shadow-sm rounded-md",
                           req.status === 'activated' ? "bg-emerald-50 text-emerald-600" : "bg-amber-100 text-amber-700"
                         )}>
                           {req.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                        <div className="flex justify-end gap-3">
                           {req.status === 'pending' ? (
                               <Button 
                                 onClick={() => handleActivate(req, 7, 'trial')} 
                                 disabled={processingId === req.id} 
                                 className="h-10 px-6 bg-primary text-white font-black text-xs rounded-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2"
                               >
                                  {processingId === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Power className="h-3.5 w-3.5" />}
                                  تفعيل (7 أيام)
                               </Button>
                           ) : (
                             <Button variant="outline" size="sm" onClick={() => { setActiveTab('companies'); }} className="rounded-lg h-9 px-4 font-black text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50">
                                <CheckCircle2 className="h-3 w-3 me-1.5" /> إكمال الإدارة
                             </Button>
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
           <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
              <Table>
                <TableHeader className="bg-slate-50/50 border-b">
                  <TableRow>
                    <TableHead className="ps-8 py-6 font-black uppercase text-[10px] text-slate-500">المنشأة</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">الاشتراك</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">تاريخ الانتهاء</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-500">الحالة</TableHead>
                    <TableHead className="pe-8 text-end font-black uppercase text-[10px] text-slate-500">التحكم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : companies?.map((comp: any) => (
                    <TableRow key={comp.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-50">
                      <TableCell className="ps-8 py-6 text-start">
                         <div className="flex items-center gap-5">
                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black border">
                               {comp.name?.charAt(0)}
                            </div>
                            <div className="text-start">
                               <p className="font-black text-slate-900 text-base leading-none">{comp.name}</p>
                               <p className="text-[9px] font-mono text-slate-400 mt-1.5 uppercase tracking-tighter">ID: {comp.id.slice(-6)}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className="bg-blue-50 text-blue-600 border-0 text-[9px] font-black uppercase px-3 py-1 rounded-md">
                            {comp.subscriptionType}
                         </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-slate-600">
                         {comp.expiryDate ? comp.expiryDate.split('T')[0] : '---'}
                      </TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black px-3 py-1 text-[9px] uppercase border-0 shadow-sm rounded-md",
                           comp.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                           comp.status === 'suspended' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                         )}>{comp.status}</Badge>
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingCompany({...comp})} 
                          className="h-9 px-4 rounded-lg border-2 font-black text-[10px] gap-2 hover:bg-primary hover:text-white transition-all shadow-sm"
                        >
                           <Settings2 className="h-3.5 w-3.5" /> إدارة الاشتراك
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingCompany} onOpenChange={(v) => { if(!v) setEditingCompany(null); }}>
         <DialogContent className="rounded-[2rem] max-w-xl p-0 overflow-hidden border-0 shadow-3xl bg-white flex flex-col max-h-[85vh]" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start border-b shrink-0">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg"><Building2 className="h-5 w-5" /></div> 
                  إدارة التراخيص والمدد
               </DialogTitle>
               <p className="text-slate-400 font-bold mt-1 text-sm ps-13">{editingCompany?.name}</p>
            </div>

            <div className="p-6 space-y-6 text-start bg-white flex-1 overflow-y-auto scrollbar-hide">
               
               <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border-2 border-white shadow-inner">
                  <div className="text-start">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">حالة التشغيل الحالية</p>
                     <Badge className={cn(
                        "text-lg font-black uppercase px-6 py-1.5 border-0 shadow-xl rounded-xl",
                        editingCompany?.status === 'active' ? "bg-emerald-500 text-white" : 
                        editingCompany?.status === 'suspended' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                     )}>
                        {editingCompany?.status}
                     </Badge>
                  </div>
                  <div className="flex gap-2">
                     {editingCompany?.status === 'suspended' ? (
                        <Button 
                          onClick={() => setEditingCompany({...editingCompany, status: 'active'})}
                          size="sm"
                          className="bg-emerald-600 text-white font-black rounded-xl h-11 px-6 shadow-lg shadow-emerald-500/20 gap-2 border-b-4 border-emerald-800"
                        >
                           <Play className="h-4 w-4" /> فك التجميد
                        </Button>
                     ) : (
                        <Button 
                          onClick={() => setEditingCompany({...editingCompany, status: 'suspended'})}
                          variant="destructive"
                          size="sm"
                          className="font-black rounded-xl h-11 px-6 shadow-lg shadow-rose-500/20 gap-2 border-b-4 border-rose-800"
                        >
                           <Pause className="h-4 w-4" /> تجميد الوصول
                        </Button>
                     )}
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-primary" /> نوع الاشتراك
                     </Label>
                     <Select value={editingCompany?.subscriptionType} onValueChange={handlePlanChange}>
                        <SelectTrigger className="h-11 border-2 rounded-xl font-bold text-sm bg-white">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-0 shadow-3xl">
                           <SelectItem value="trial" className="font-bold py-2 text-xs">Trial (7 أيام)</SelectItem>
                           <SelectItem value="monthly" className="font-bold py-2 text-xs">Monthly (30 يوماً)</SelectItem>
                           <SelectItem value="annual" className="font-bold py-2 text-xs text-primary">Annual (سنة)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-2 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <CalendarClock className="h-3.5 w-3.5 text-primary" /> تاريخ الانتهاء
                     </Label>
                     <Input 
                       type="date" 
                       value={editingCompany?.expiryDate ? editingCompany.expiryDate.split('T')[0] : ''} 
                       onChange={e => setEditingCompany({...editingCompany, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} 
                       className="h-11 border-2 rounded-xl font-black text-base text-center bg-slate-50 focus:bg-white transition-all text-primary" 
                     />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-2 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">سعة الموظفين</Label>
                     <Input 
                       type="number" 
                       value={editingCompany?.maxUsers || 0} 
                       onChange={e => setEditingCompany({...editingCompany, maxUsers: Number(e.target.value)})} 
                       className="h-11 border-2 rounded-xl font-black text-xl text-center bg-slate-50 focus:bg-white" 
                     />
                  </div>
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                     <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                     <div className="text-start space-y-0.5">
                        <h5 className="font-black text-[9px] text-blue-900 uppercase">قاعدة الأتمتة</h5>
                        <p className="text-[9px] text-blue-700/80 font-bold leading-relaxed">
                           تغيير نوع الاشتراك يضبط تاريخ الانتهاء تلقائياً من تاريخ اليوم.
                        </p>
                     </div>
                  </div>
               </div>
            </div>
            
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-4 shrink-0 shadow-2xl">
               <Button variant="outline" onClick={() => setEditingCompany(null)} className="flex-1 h-12 rounded-xl border-2 font-bold text-sm bg-white hover:bg-slate-100">إلغاء</Button>
               <Button onClick={handleUpdateSubscription} disabled={processingId === 'saving'} className="flex-[2] h-12 rounded-xl bg-primary text-white font-black text-base shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all border-b-4 border-orange-700 gap-3">
                  {processingId === 'saving' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  حفظ وتطبيق التراخيص
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
