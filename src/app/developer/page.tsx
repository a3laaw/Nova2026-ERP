
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { 
  Loader2, CheckCircle, ShieldAlert, Ban, RefreshCcw, 
  Edit3, Save, Users, Zap, HardHat, Building2, 
  CalendarClock, Timer, ShieldCheck, AlertTriangle, X
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

export default function DeveloperDashboard() {
  const { lang, dir } = useLanguage();
  const { user, globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [activeTab, setActiveTab] = useState("requests");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);

  // تثبيت الاستعلامات ومنع التنفيذ إذا لم يتم التأكد من هوية المطور بعد
  const companiesQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'companies'), orderBy('createdAt', 'desc')) : null, 
  [db, globalUser?.isDeveloper]);

  const requestsQuery = useMemo(() => 
    (db && globalUser?.isDeveloper) ? query(collection(db, 'company_requests'), orderBy('createdAt', 'desc')) : null, 
  [db, globalUser?.isDeveloper]);

  const { data: companies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: requests, loading: requestsLoading } = useCollection<any>(requestsQuery);

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

      // تفعيل حساب الأدمن المالك
      const globalUserRef = doc(db, 'global_users', req.ownerUid || '');
      batch.update(globalUserRef, { isActive: true, isPendingApproval: false });

      await batch.commit();
      toast({ title: isRtl ? `تم التفعيل لـ ${days} يوم` : `Activated for ${days} days` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!db || !editingCompany) return;
    try {
      const ref = doc(db, 'companies', editingCompany.id);
      await updateDoc(ref, {
        name: editingCompany.name || '',
        status: editingCompany.status || 'active',
        subscriptionType: editingCompany.subscriptionType || 'trial',
        expiryDate: editingCompany.expiryDate || new Date().toISOString(),
        maxUsers: Number(editingCompany.maxUsers) || 5,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Updated" });
      setEditingCompany(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  if (!globalUser?.isDeveloper) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Verifying Dev Identity...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-start" dir={dir}>
      <div className="text-start">
          <h2 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'بوابة الرقابة والاشتراكات' : 'Subscription Control'}</h2>
          <Badge className="bg-slate-900 text-primary mt-2">NovaFlow Sovereign Engine</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border-0">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="h-20 w-20" /></div>
           <div className="text-start relative z-10">
            <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1">طلبات معلقة</h4>
            <p className="text-4xl font-black font-headline">{requests?.filter(r => r.status === 'pending').length || 0}</p>
          </div>
        </Card>
        <Card className="bg-white rounded-3xl p-6 shadow-lg border-0">
           <h4 className="text-slate-400 text-[10px] font-black uppercase mb-1 text-start">المنشآت النشطة</h4>
           <p className="text-4xl font-black font-headline text-emerald-600 text-start">{companies?.filter(c => c.status === 'active').length || 0}</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border h-14 rounded-2xl p-1 shadow-sm mb-6 gap-2">
           <TabsTrigger value="requests" className="rounded-xl px-8 font-black text-xs">طلبات الانضمام</TabsTrigger>
           <TabsTrigger value="companies" className="rounded-xl px-8 font-black text-xs">إدارة المنشآت</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in slide-in-from-bottom-2">
           <Card className="border-0 shadow-2xl rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="ps-8">الشركة</TableHead>
                    <TableHead>النشاط</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="pe-8 text-end">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : requests?.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell className="ps-8 py-5">
                         <div className="flex flex-col text-start">
                            <span className="font-black text-slate-800">{req.companyName}</span>
                            <span className="text-[10px] text-slate-400">{req.email}</span>
                         </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{req.activity}</Badge></TableCell>
                      <TableCell><Badge className="bg-amber-100 text-amber-700 border-0">{req.status}</Badge></TableCell>
                      <TableCell className="pe-8 text-end">
                        <div className="flex justify-end gap-2">
                           <Button onClick={() => handleActivate(req, 7, 'trial')} disabled={processingId === req.id} className="h-9 px-4 bg-primary text-white text-[10px]">
                              {isRtl ? 'تفعيل 7 أيام تجربة' : 'Start 7D Trial'}
                           </Button>
                           <Button onClick={() => handleActivate(req, 365, 'annual')} variant="secondary" className="h-9 px-4 text-[10px]">
                              {isRtl ? 'تفعيل سنة كاملة' : 'Activate Annual'}
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="companies" className="animate-in fade-in">
           <Card className="border-0 shadow-2xl rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="ps-8">المنشأة</TableHead>
                    <TableHead>الاشتراك</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="pe-8 text-end">تحكم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : companies?.map((comp: any) => (
                    <TableRow key={comp.id}>
                      <TableCell className="ps-8 py-5">
                         <div className="text-start">
                            <p className="font-black text-slate-800">{comp.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{comp.id}</p>
                         </div>
                      </TableCell>
                      <TableCell><Badge className="bg-blue-50 text-blue-600 border-0 text-[10px] font-black">{comp.subscriptionType}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">{comp.expiryDate?.split('T')[0] || '---'}</TableCell>
                      <TableCell>
                         <Badge className={cn(
                           "font-black px-3 py-1 text-[9px]",
                           comp.status === 'active' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                         )}>{comp.status}</Badge>
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                        <Button variant="outline" size="icon" onClick={() => setEditingCompany({...comp})} className="h-8 w-8 rounded-lg border-2"><Edit3 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
         <DialogContent className="rounded-xl max-w-md p-0 overflow-hidden" dir={dir}>
            <div className="bg-slate-900 p-8 text-white text-start">
               <DialogTitle className="text-xl font-black flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-primary" /> تعديل الاشتراك</DialogTitle>
            </div>
            <div className="p-8 space-y-6 text-start bg-white">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">اسم المنشأة</Label>
                  <Input 
                    value={editingCompany?.name || ''} 
                    onChange={e => setEditingCompany({...editingCompany, name: e.target.value})} 
                    className="h-12 border-2 rounded-xl font-black" 
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">حالة المنشأة</Label>
                  <Select value={editingCompany?.status || 'active'} onValueChange={v => setEditingCompany({...editingCompany, status: v})}>
                     <SelectTrigger className="h-12 border-2 rounded-xl"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ الانتهاء</Label>
                  <Input 
                    type="date" 
                    value={editingCompany?.expiryDate?.split('T')[0] || ''} 
                    onChange={e => setEditingCompany({...editingCompany, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} 
                    className="h-12 border-2 rounded-xl font-black" 
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">سعة المستخدمين</Label>
                  <Input 
                    type="number" 
                    value={editingCompany?.maxUsers || 0} 
                    onChange={e => setEditingCompany({...editingCompany, maxUsers: Number(e.target.value)})} 
                    className="h-12 border-2 rounded-xl font-black" 
                  />
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleUpdateSubscription} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">حفظ وتمديد الاشتراك</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
