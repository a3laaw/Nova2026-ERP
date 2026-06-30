
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSpreadsheet, Search, Loader2, ArrowRight, 
  Filter, TrendingUp, DollarSign, Calculator,
  LayoutGrid, UserCircle, Activity, Trash2, AlertTriangle,
  History, Settings2, FileText, Sparkles, Clock
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQVariation } from '@/types/documents';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
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

/**
 * مكون فرعي لعرض ملخص أوامر التغيير لكل مقايسة
 */
function BOQVariationStats({ boqId, companyId }: { boqId: string, companyId: string }) {
  const { lang } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';

  const voQuery = useMemo(() =>
    companyId && db ? query(collection(db, paths.boqVariations(companyId, boqId))) : null,
  [db, companyId, boqId]);

  const { data: variations, loading } = useCollection<BOQVariation>(voQuery);

  if (loading) return <div className="h-4 w-12 bg-slate-100 animate-pulse rounded-md" />;
  if (!variations || variations.length === 0) return <span className="text-[9px] text-slate-300 font-bold italic">{isRtl ? 'لا يوجد تعديلات' : 'No VOs'}</span>;

  const stats = {
    total: variations.length,
    draft: variations.filter(v => v.status === 'draft').length,
    approved: variations.filter(v => v.status === 'approved').length,
    cancelled: variations.filter(v => v.status === 'cancelled').length
  };

  return (
    <div className="flex flex-wrap gap-1 justify-start">
      <Badge variant="outline" className="h-5 px-1.5 text-[8px] font-black border-slate-200 text-slate-500 bg-white">
        VO: {stats.total}
      </Badge>
      {stats.draft > 0 && (
        <Badge title={isRtl ? "مسودة" : "Draft"} className="h-5 px-1.5 text-[8px] font-black bg-blue-50 text-blue-600 border-0">
          D: {stats.draft}
        </Badge>
      )}
      {stats.approved > 0 && (
        <Badge title={isRtl ? "معتمد" : "Approved"} className="h-5 px-1.5 text-[8px] font-black bg-emerald-50 text-emerald-600 border-0">
          A: {stats.approved}
        </Badge>
      )}
      {stats.cancelled > 0 && (
        <Badge title={isRtl ? "ملغي" : "Cancelled"} className="h-5 px-1.5 text-[8px] font-black bg-rose-50 text-rose-600 border-0">
          C: {stats.cancelled}
        </Badge>
      )}
    </div>
  );
}

export default function BOQExplorerPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("boqs");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. استعلام المقايسات
  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqsQuery);

  // 2. استعلام كافة الأوامر التغييرية (التبسيط السيادي لتجنب الفهارس المركبة)
  const allVOsQuery = useMemo(() => 
    companyId && db ? query(collectionGroup(db, 'variations'), where('companyId', '==', companyId)) : null, 
  [db, companyId]);
  const { data: rawVOs, loading: voLoading } = useCollection<BOQVariation>(allVOsQuery);

  const filteredBoqs = useMemo(() => {
    return (boqs || []).filter(boq => 
      (boq.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (boq.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (boq.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boqs, searchTerm]);

  const filteredVOs = useMemo(() => {
    // التصفية والفرز في الذاكرة لضمان ظهور البيانات فوراً
    return (rawVOs || [])
      .filter(vo => 
        (vo.title || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (vo.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [rawVOs, searchTerm]);

  const stats = useMemo(() => {
    return {
      totalPlanned: (boqs || []).reduce((acc, b) => acc + (b.totalAmount || 0), 0),
      totalVO: (rawVOs || []).filter(v => v.status === 'approved').reduce((acc, v) => acc + (v.totalAmount || 0), 0),
      boqCount: boqs?.length || 0,
      voCount: rawVOs?.length || 0
    };
  }, [boqs, rawVOs]);

  const handleDelete = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const boq = boqs?.find(b => b.id === deletingId);
      const service = new DocumentService(db, companyId, permissions);
      await service.deleteBOQ(deletingId, boq?.transactionId, user?.uid, user?.displayName || 'User');
      toast({ title: isRtl ? "تم حذف المقايسة بنجاح" : "BOQ Deleted Successfully" });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            {t('boqExplorer')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'رقابة شاملة على ميزانيات المشاريع وتتبع الإنجاز المالي والميداني.' : 'Unified oversight of project budgets and field execution tracking.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white group hover:scale-[1.02] transition-all relative overflow-hidden">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 w-fit mb-3">
               <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الميزانية المخططة' : 'Planned Budget'}</p>
            <h3 className="text-2xl font-black text-[#1e1b4b]">
              {stats.totalPlanned.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">KWD</span>
            </h3>
         </Card>
         
         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white group hover:scale-[1.02] transition-all relative overflow-hidden border-s-4 border-s-orange-400">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600 w-fit mb-3">
               <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي التغيير المعتمد' : 'Total Approved VO'}</p>
            <h3 className="text-2xl font-black text-orange-600">
              {stats.totalVO >= 0 ? '+' : ''}{stats.totalVO.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">KWD</span>
            </h3>
         </Card>

         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white group hover:scale-[1.02] transition-all">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 w-fit mb-3">
               <FileSpreadsheet className="h-5 w-5" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'عدد المقايسات' : 'BOQ Count'}</p>
            <h3 className="text-2xl font-black text-slate-900">{stats.boqCount}</h3>
         </Card>

         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-slate-900 text-white group hover:scale-[1.02] transition-all">
            <div className="p-2 rounded-lg bg-white/10 text-primary w-fit mb-3">
               <Activity className="h-5 w-5" />
            </div>
            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'إجمالي طلبات التغيير' : 'Total VOs'}</p>
            <h3 className="text-2xl font-black">{stats.voCount}</h3>
         </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
           <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-xl h-12 gap-1 shadow-sm shrink-0">
             <TabsTrigger value="boqs" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'المقايسات' : 'BOQs'}
             </TabsTrigger>
             <TabsTrigger value="variations" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <Sparkles className="h-4 w-4" /> {isRtl ? 'الأوامر التغييرية' : 'Variation Orders'}
             </TabsTrigger>
           </TabsList>

           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={activeTab === 'boqs' ? (isRtl ? 'بحث في المقايسات...' : 'Search BOQs...') : (isRtl ? 'بحث في الأوامر التغييرية...' : 'Search Variations...')} 
                className="ps-12 rounded-2xl h-12 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <TabsContent value="boqs" className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-8 ps-10 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المقايسة / العميل' : 'BOQ / Client'}</TableHead>
                    <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'حالة الـ VO' : 'VO Summary'}</TableHead>
                    <TableHead className="text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'الميزانية الأصلية' : 'Orig. Budget'}</TableHead>
                    <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="pe-10 text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد مقايسات مسجلة.' : 'No BOQs found.'}</TableCell></TableRow>
                  ) : (
                    filteredBoqs.map((boq) => (
                      <TableRow key={boq.id} className="hover:bg-slate-50/50 transition-colors group border-b-slate-50 cursor-pointer">
                        <TableCell className="py-8 ps-10 text-start" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                           <div className="flex items-center gap-5">
                              <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary font-black text-xl border-2 border-orange-50 group-hover:scale-110 transition-transform">
                                 <FileSpreadsheet className="h-7 w-7" />
                              </div>
                              <div className="text-start">
                                 <p className="font-black text-xl text-slate-800">{boq.boqNumber}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                                    <UserCircle className="h-3 w-3" /> {boq.clientName}
                                 </p>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="text-start" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                           <BOQVariationStats boqId={boq.id!} companyId={companyId!} />
                        </TableCell>
                        <TableCell className="text-end" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                           <span className="font-mono font-black text-xl text-slate-900 pe-4">
                              {boq.totalAmount?.toLocaleString() || '0'}
                           </span>
                        </TableCell>
                        <TableCell className="text-start" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                           <Badge className={cn(
                             "font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                             boq.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                             boq.status === 'draft' ? 'bg-blue-50 text-blue-600' :
                             'bg-amber-50 text-amber-600'
                           )}>
                              {boq.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="pe-10 text-end">
                           <div className="flex justify-end gap-2">
                              {isAdmin && (
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   onClick={(e) => { e.stopPropagation(); setDeletingId(boq.id!); }}
                                   className="h-12 w-12 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                                 >
                                    <Trash2 className="h-6 w-6" />
                                 </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}
                                className="rounded-xl h-12 px-5 font-black text-[10px] gap-2 hover:bg-primary hover:text-white"
                              >
                                 <Settings2 className="h-4 w-4" />
                                 {isRtl ? 'إدارة VO & المقايسة' : 'Manage VO'}
                                 <ArrowRight className={cn("h-4 w-4 ms-2", isRtl && "rotate-180")} />
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

        <TabsContent value="variations" className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-8 ps-10 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'الأمر التغييري / العنوان' : 'Variation Order / Title'}</TableHead>
                    <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المقايسة المرتبطة' : 'Related BOQ'}</TableHead>
                    <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'التاريخ' : 'Created Date'}</TableHead>
                    <TableHead className="text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'قيمة التغيير (صافي)' : 'Net Amount'}</TableHead>
                    <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="pe-10 text-end"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredVOs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد أوامر تغيير حالياً.' : 'No variation orders found.'}</TableCell></TableRow>
                  ) : (
                    filteredVOs.map((vo) => (
                      <TableRow key={vo.id} className="hover:bg-slate-50/50 transition-colors group border-b-slate-50 cursor-pointer" onClick={() => router.push(`/dashboard/clients/${vo.clientId || 'unknown'}/transactions/${vo.transactionId}/boq`)}>
                        <TableCell className="py-8 ps-10 text-start">
                           <div className="flex items-center gap-5">
                              <div className={cn(
                                "h-14 w-14 rounded-2xl shadow-lg flex items-center justify-center font-black text-xl border-2 transition-transform group-hover:scale-110",
                                vo.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                              )}>
                                 <Sparkles className="h-7 w-7" />
                              </div>
                              <div className="text-start">
                                 <p className="font-black text-xl text-slate-800">{vo.title}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ref ID: {vo.id!.slice(-6).toUpperCase()}</p>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="text-start">
                           <div className="flex flex-col">
                              <span className="font-black text-sm text-slate-700">{vo.boqNumber}</span>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><UserCircle className="h-3 w-3" /> {vo.clientName || '---'}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-start">
                           <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              {vo.createdAt?.toDate().toLocaleDateString() || '---'}
                           </div>
                        </TableCell>
                        <TableCell className="text-end">
                           <span className={cn(
                             "font-mono font-black text-xl pe-4",
                             vo.totalAmount >= 0 ? "text-emerald-600" : "text-rose-600"
                           )}>
                              {vo.totalAmount >= 0 ? '+' : ''}{vo.totalAmount?.toLocaleString() || '0'}
                           </span>
                        </TableCell>
                        <TableCell className="text-start">
                           <Badge className={cn(
                             "font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                             vo.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                             vo.status === 'cancelled' ? 'bg-rose-500 text-white' :
                             'bg-blue-50 text-blue-600'
                           )}>
                              {vo.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="pe-10 text-end">
                           <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-12 w-12">
                              <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-0", isRtl && "rotate-180")} />
                           </Button>
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

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{isRtl ? 'حذف المقايسة نهائياً؟' : 'Permanent BOQ Delete?'}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {isRtl 
                  ? 'هل أنت متأكد؟ سيتم حذف هذه المقايسة وكافة بنود الأعمال وسجلات التنفيذ الميداني المعتمدة عليها نهائياً من قاعدة البيانات. لا يمكن التراجع عن هذا الإجراء.' 
                  : 'Are you sure? This BOQ, all its work items, and associated field execution logs will be permanently removed from the database. This action cannot be undone.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
               {isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف المقايسة' : 'Confirm Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
