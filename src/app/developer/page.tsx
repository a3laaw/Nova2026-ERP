
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Loader2, CheckCircle, ShieldAlert, Ban, RefreshCcw, 
  FileSpreadsheet, Edit3, Save, Users, Zap, HardHat, PencilRuler,
  UserCheck, XCircle, Clock, Building2, ExternalLink, X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DeveloperDashboard() {
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [activeTab, setActiveTab] = useState("requests");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // استقرار الاستعلامات عبر useMemo لمنع حلقة التحديث اللانهائية
  const companiesQuery = useMemo(() => 
    db ? query(collection(db, 'companies'), orderBy('createdAt', 'desc')) : null,
  [db]);

  const requestsQuery = useMemo(() => 
    db ? query(collection(db, 'company_requests'), orderBy('createdAt', 'desc')) : null,
  [db]);

  const { data: companies, loading: companiesLoading } = useCollection<any>(companiesQuery);
  const { data: requests, loading: requestsLoading } = useCollection<any>(requestsQuery);

  const getActivityLabel = (code: string) => {
    const map: Record<string, string> = {
      'construction': isRtl ? 'مقاولات وإنشاءات' : 'Construction',
      'consulting': isRtl ? 'استشارات هندسية' : 'Consulting',
      'design_build': isRtl ? 'تصميم وإنشاء (D&B)' : 'Design & Build',
      'general': isRtl ? 'تجارة عامة' : 'General Trading'
    };
    return map[code] || code;
  };

  const handleApproveRequest = async (req: any) => {
    if (!db) return;
    setProcessingId(req.id);
    try {
      if (req.companyId) {
        const companyRef = doc(db, 'companies', req.companyId);
        await updateDoc(companyRef, {
          status: 'active',
          trialEndsAt: addDaysToISO(new Date(), 14),
          activatedAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'company_requests', req.id), {
          status: 'activated',
          activatedAt: serverTimestamp()
        });

        toast({ title: isRtl ? "تم تفعيل المنشأة" : "Company Activated" });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Activation failed" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateCompany = async () => {
    if (!db || !editingCompany) return;
    setSaving(true);
    try {
      const companyRef = doc(db, 'companies', editingCompany.id);
      await updateDoc(companyRef, {
        name: editingCompany.name,
        activity: editingCompany.activity,
        status: editingCompany.status,
        maxUsers: Number(editingCompany.maxUsers) || 5,
        updatedAt: serverTimestamp()
      });
      toast({ title: isRtl ? "تم تحديث بيانات الشركة" : "Company Updated" });
      setEditingCompany(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Update Failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!db || !confirm(isRtl ? 'هل تريد رفض هذا الطلب؟' : 'Reject this request?')) return;
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'company_requests', id), {
        status: 'rejected',
        rejectedAt: serverTimestamp()
      });
      toast({ title: isRtl ? "تم رفض الطلب" : "Request Rejected" });
    } finally {
      setProcessingId(null);
    }
  };

  const addDaysToISO = (date: Date, days: number) => {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res.toISOString();
  };

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="text-start">
          <h2 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'كونسول التحكم العالمي' : 'Sovereign Dev Console'}</h2>
          <p className="text-slate-50 font-bold bg-slate-900 px-3 py-1 rounded-lg w-fit mt-2 text-[10px] uppercase tracking-widest">NovaFlow Core Management</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold bg-white border-2"><FileSpreadsheet className="me-2 h-4 w-4" /> تصدير السجلات</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-0 rounded-3xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="h-20 w-20" /></div>
           <div className="text-start relative z-10">
            <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">طلبات معلقة</h4>
            <p className="text-4xl font-black font-headline">{requests?.filter(r => r.status === 'pending').length || 0}</p>
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <div className="text-start">
            <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">إجمالي المنشآت</h4>
            <p className="text-4xl font-black font-headline text-slate-900">{companies?.length || 0}</p>
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <div className="text-start">
            <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">المنشآت النشطة</h4>
            <p className="text-4xl font-black font-headline text-emerald-600">{companies?.filter(c => c.status === 'active').length || 0}</p>
          </div>
        </Card>
        <Card className="bg-primary text-white border-0 shadow-xl rounded-3xl p-6">
          <div className="text-start">
            <h4 className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">حالة السحاب</h4>
            <p className="text-lg font-black font-headline">GCP Stable</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold">All services operational</span>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border-2 border-slate-100 h-14 rounded-2xl p-1.5 shadow-sm mb-6 gap-2">
           <TabsTrigger value="requests" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">
              <Clock className="me-2 h-4 w-4" /> {isRtl ? 'طلبات الانضمام' : 'Join Requests'}
           </TabsTrigger>
           <TabsTrigger value="companies" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Building2 className="me-2 h-4 w-4" /> {isRtl ? 'المنشآت المسجلة' : 'Active Tenants'}
           </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="animate-in fade-in slide-in-from-bottom-2">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardContent className="p-0 overflow-x-auto">
                 <Table>
                    <TableHeader className="bg-slate-50 border-b">
                       <TableRow>
                          <TableHead className="py-6 ps-8 text-start">اسم الشركة / المسؤول</TableHead>
                          <TableHead className="text-start">النشاط</TableHead>
                          <TableHead className="text-start">التاريخ</TableHead>
                          <TableHead className="text-start">الحالة</TableHead>
                          <TableHead className="pe-8 text-end">قرار المطور</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {requestsLoading ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                       ) : requests?.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد طلبات معلقة.' : 'No pending requests.'}</TableCell></TableRow>
                       ) : (
                         requests?.map((req: any) => (
                           <TableRow key={req.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100">
                              <TableCell className="py-6 ps-8 text-start">
                                 <div className="flex flex-col">
                                    <span className="font-black text-slate-800 text-sm">{req.companyName}</span>
                                    <span className="text-[10px] text-slate-400 font-bold">{req.contactName} • {req.email}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-start">
                                 <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-black text-[8px] uppercase tracking-tighter">
                                    {getActivityLabel(req.activity)}
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-start font-mono text-[10px] text-slate-400">
                                 {req.createdAt?.toDate().toLocaleString()}
                              </TableCell>
                              <TableCell className="text-start">
                                 <Badge className={cn(
                                   "font-black text-[9px] uppercase border-0 px-3",
                                   req.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                                   req.status === 'activated' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                 )}>
                                    {req.status}
                                 </Badge>
                              </TableCell>
                              <TableCell className="pe-8 text-end">
                                 {req.status === 'pending' ? (
                                   <div className="flex justify-end gap-2">
                                      <Button 
                                        onClick={() => handleApproveRequest(req)} 
                                        disabled={processingId === req.id}
                                        className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-black text-[10px] gap-2 shadow-lg shadow-emerald-100"
                                      >
                                         {processingId === req.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                         {isRtl ? 'اعتماد وتفعيل' : 'Approve'}
                                      </Button>
                                      <Button 
                                        onClick={() => handleRejectRequest(req.id)}
                                        variant="ghost" 
                                        className="h-10 w-10 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                                      >
                                         <XCircle className="h-5 w-5" />
                                      </Button>
                                   </div>
                                 ) : (
                                   <span className="text-[10px] font-black text-slate-300 uppercase italic">Processed</span>
                                 )}
                              </TableCell>
                           </TableRow>
                         ))
                       )}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="companies" className="animate-in fade-in">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardContent className="p-0 overflow-x-auto">
                 <Table>
                    <TableHeader className="bg-slate-50 border-b">
                       <TableRow>
                          <TableHead className="py-6 ps-8 text-start">المنشأة</TableHead>
                          <TableHead className="text-start">النشاط</TableHead>
                          <TableHead className="text-start">نهاية التجربة</TableHead>
                          <TableHead className="text-start">المستخدمين</TableHead>
                          <TableHead className="text-start">الحالة</TableHead>
                          <TableHead className="pe-8 text-end">إجراءات</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {companiesLoading ? (
                         <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                       ) : (
                         companies?.map((comp: any) => (
                           <TableRow key={comp.id} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="py-6 ps-8 text-start font-bold">
                                 <div className="flex flex-col text-start">
                                    <span className="font-black text-slate-800">{comp.name}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">ID: {comp.id}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-start">
                                 <Badge variant="outline" className="text-[10px] font-black uppercase text-primary border-primary/20 bg-primary/5">
                                    {getActivityLabel(comp.activity)}
                                 </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-start text-slate-500">
                                 {comp.trialEndsAt?.split('T')[0] || 'N/A'}
                              </TableCell>
                              <TableCell className="font-black text-xs text-start">{comp.maxUsers || 5}</TableCell>
                              <TableCell className="text-start">
                                 <Badge className={cn("font-black px-3 py-1 border-0 shadow-sm uppercase text-[9px]", comp.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                                    {comp.status}
                                 </Badge>
                              </TableCell>
                              <TableCell className="pe-8 text-end">
                                 <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-2" onClick={() => setEditingCompany({...comp})}>
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-rose-300 hover:text-rose-600">
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                 </div>
                              </TableCell>
                           </TableRow>
                         ))
                       )}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* نموذج تعديل المنشأة المطور */}
      <Dialog open={!!editingCompany} onOpenChange={(v) => !v && setEditingCompany(null)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
          <div className="bg-slate-900 p-10 text-white text-start border-b">
             <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                <Building2 className="h-8 w-8 text-primary" />
                {isRtl ? 'تعديل بيانات المنشأة' : 'Edit Organization'}
             </DialogTitle>
             <p className="text-slate-400 font-bold mt-2 uppercase text-xs tracking-widest">Global Identity & Scale Control</p>
          </div>

          <div className="p-10 space-y-6 text-start bg-white">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الشركة' : 'Company Name'}</Label>
                <Input 
                  value={editingCompany?.name || ''} 
                  onChange={e => setEditingCompany({...editingCompany, name: e.target.value})}
                  className="h-12 rounded-xl border-2 font-black text-lg bg-slate-50/50" 
                />
             </div>

             <div className="grid grid-cols-2 gap-4 text-start">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'نوع النشاط' : 'Activity Type'}</Label>
                   <Select value={editingCompany?.activity} onValueChange={v => setEditingCompany({...editingCompany, activity: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-2xl">
                         <SelectItem value="construction" className="font-bold">{isRtl ? 'مقاولات وإنشاءات' : 'Construction'}</SelectItem>
                         <SelectItem value="consulting" className="font-bold">{isRtl ? 'استشارات هندسية' : 'Consulting'}</SelectItem>
                         <SelectItem value="design_build" className="font-bold">{isRtl ? 'تصميم وإنشاء (D&B)' : 'Design & Build'}</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'حالة المنشأة' : 'System Status'}</Label>
                   <Select value={editingCompany?.status} onValueChange={v => setEditingCompany({...editingCompany, status: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-2xl">
                         <SelectItem value="active" className="font-bold text-emerald-600">{isRtl ? 'نشطة' : 'Active'}</SelectItem>
                         <SelectItem value="inactive" className="font-bold text-slate-400">{isRtl ? 'غير مفعلة' : 'Inactive'}</SelectItem>
                         <SelectItem value="suspended" className="font-bold text-rose-600">{isRtl ? 'موقوفة' : 'Suspended'}</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner space-y-4">
                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest mb-2">
                   <Users className="h-3.5 w-3.5" /> {isRtl ? 'التحكم في النطاق (Scale)' : 'Scaling Controls'}
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold text-slate-500">{isRtl ? 'الحد الأقصى للمستخدمين' : 'Max Licensed Users'}</Label>
                   <Input 
                     type="number" 
                     value={editingCompany?.maxUsers || 5} 
                     onChange={e => setEditingCompany({...editingCompany, maxUsers: e.target.value})}
                     className="h-12 rounded-xl border-2 font-black text-xl text-center bg-white" 
                   />
                </div>
             </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
             <Button variant="outline" onClick={() => setEditingCompany(null)} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">
                {isRtl ? 'إلغاء' : 'Cancel'}
             </Button>
             <Button onClick={handleUpdateCompany} disabled={saving} className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black text-lg shadow-xl gap-3 hover:scale-[1.02] transition-all">
                {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                {isRtl ? 'حفظ التغييرات' : 'Commit Changes'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

