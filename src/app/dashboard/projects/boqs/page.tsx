
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileSpreadsheet, Search, Loader2, ArrowRight, 
  Filter, TrendingUp, DollarSign, Calculator,
  LayoutGrid, UserCircle, Activity, Trash2, AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ } from '@/types/documents';
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

export default function BOQExplorerPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: boqs, loading } = useCollection<BOQ>(boqsQuery);

  const filtered = useMemo(() => {
    return (boqs || []).filter(boq => 
      (boq.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (boq.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (boq.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boqs, searchTerm]);

  const totals = useMemo(() => {
    return {
      planned: filtered.reduce((acc, b) => acc + (b.totalAmount || 0), 0),
      count: filtered.length,
      active: filtered.filter(b => b.status === 'active' || b.status === 'draft').length
    };
  }, [filtered]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-xl rounded-[2rem] p-8 text-start bg-white group hover:scale-[1.02] transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><DollarSign className="h-24 w-24" /></div>
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 w-fit mb-4">
               <TrendingUp className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الميزانيات المخططة' : 'Total Planned Budget'}</p>
            <h3 className="text-3xl font-black font-headline text-[#1e1b4b]">
              {totals.planned.toLocaleString()} <span className="text-xs text-slate-400 font-bold">KWD</span>
            </h3>
         </Card>
         
         <Card className="border-0 shadow-xl rounded-[2rem] p-8 text-start bg-white group hover:scale-[1.02] transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><FileSpreadsheet className="h-24 w-24" /></div>
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 w-fit mb-4">
               <Calculator className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'عدد المقايسات النشطة' : 'Active BOQs'}</p>
            <h3 className="text-3xl font-black font-headline text-[#1e1b4b]">{totals.active}</h3>
         </Card>

         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-gradient-to-br from-[#1e1b4b] to-[#312e81] text-white p-8 group hover:shadow-2xl transition-all">
            <div className="flex items-center gap-4 mb-6">
               <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-primary shadow-lg">
                  <Activity className="h-6 w-6" />
               </div>
               <div className="text-start">
                  <h4 className="text-sm font-black">{isRtl ? 'تحليل الإنجاز' : 'Execution Health'}</h4>
                  <p className="text-[9px] font-bold text-white/40 uppercase">Cross-Project Status</p>
               </div>
            </div>
            <div className="space-y-2">
               <div className="flex justify-between text-[10px] font-black uppercase">
                  <span>{isRtl ? 'معدل التغطية' : 'Coverage'}</span>
                  <span>78%</span>
               </div>
               <Progress value={78} className="h-1.5 bg-white/10" />
            </div>
         </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={isRtl ? 'بحث برقم المقايسة، اسم العميل، أو المشروع...' : 'Search by number, client, or project...'} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 font-bold text-lg" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" className="h-14 px-8 rounded-2xl font-black border-2 gap-2 bg-white hover:bg-slate-50">
              <Filter className="h-5 w-5 text-primary" /> {isRtl ? 'فلترة متقدمة' : 'Advanced Filters'}
           </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-8 ps-10 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المقايسة / العميل' : 'BOQ / Client'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المسار الفني' : 'Technical Path'}</TableHead>
                <TableHead className="text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'القيمة الإجمالية' : 'Planned Value'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-10 text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-bold italic">{isRtl ? 'لا توجد مقايسات مسجلة.' : 'No BOQs found.'}</TableCell></TableRow>
              ) : (
                filtered.map((boq) => (
                  <TableRow 
                    key={boq.id} 
                    className="hover:bg-slate-50/50 transition-colors group border-b-slate-50 cursor-pointer" 
                  >
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
                       <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="bg-primary/5 text-primary border-0 font-black text-[9px] uppercase px-3 w-fit">{boq.subServiceName || 'GENERAL'}</Badge>
                          <span className="text-[10px] font-bold text-slate-400">{boq.templateName || 'Custom Draft'}</span>
                       </div>
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
                               className="h-12 w-12 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 border-2 border-transparent hover:border-rose-100 transition-all"
                             >
                                <Trash2 className="h-6 w-6" />
                             </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}
                            className="rounded-xl h-12 w-12 group-hover:bg-primary group-hover:text-white shadow-sm transition-all"
                          >
                             <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
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

