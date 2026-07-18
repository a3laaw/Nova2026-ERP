
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
  TrendingUp, Activity, Trash2, AlertTriangle,
  History, Settings2, FileText, Sparkles, Clock,
  CheckCircle2, XCircle, FileSearch, UserCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, collectionGroup, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQVariation, BOQVariationItem } from '@/types/documents';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { VariationService } from '@/services/variation-service';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
      {stats.draft > 0 && <Badge className="h-5 px-1.5 text-[8px] font-black bg-blue-50 text-blue-600 border-0">D: {stats.draft}</Badge>}
      {stats.approved > 0 && <Badge className="h-5 px-1.5 text-[8px] font-black bg-emerald-50 text-emerald-600 border-0">A: {stats.approved}</Badge>}
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
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // States for VO Review
  const [reviewVO, setReviewVO] = useState<BOQVariation | null>(null);
  const [reviewItems, setReviewItems] = useState<BOQVariationItem[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqsQuery);

  const allVOsQuery = useMemo(() => 
    companyId && db ? query(collectionGroup(db, 'variations'), where('companyId', '==', companyId)) : null, 
  [db, companyId]);
  const { data: rawVOs, loading: voLoading } = useCollection<BOQVariation>(allVOsQuery);

  const filteredBoqs = useMemo(() => {
    return (boqs || []).filter(boq => 
      (boq.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (boq.clientName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boqs, searchTerm]);

  const filteredVOs = useMemo(() => {
    return (rawVOs || [])
      .filter(vo => 
        (vo.title || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (vo.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [rawVOs, searchTerm]);

  const handleReviewVO = async (vo: BOQVariation) => {
    if (!db || !companyId) return;
    setLoadingReview(true);
    setReviewVO(vo);
    try {
      const snap = await getDocs(collection(db, paths.boqVariationItems(companyId, vo.boqId, vo.id)));
      setReviewItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariationItem)));
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingReview(false);
    }
  };

  const handleApproveVO = async () => {
    if (!db || !companyId || !user || !reviewVO) return;
    setProcessingId(reviewVO.id);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.approveVariation(reviewVO.boqId, reviewVO.id!, reviewVO.transactionId, user.uid, user.displayName || 'Admin');
      toast({ title: isRtl ? "تم اعتماد التعديل بنجاح" : "Variation Approved" });
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectVO = async () => {
    if (!db || !companyId || !user || !reviewVO) return;
    setProcessingId(reviewVO.id);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.rejectVariation(reviewVO.boqId, reviewVO.id!, reviewVO.transactionId, user.uid, user.displayName || 'Admin');
      toast({ title: isRtl ? "تم رفض وإلغاء الطلب" : "Variation Rejected" });
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteBOQ = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const boq = boqs?.find(b => b.id === deletingId);
      const service = new DocumentService(db, companyId, permissions);
      await service.deleteBOQ(deletingId, boq?.transactionId, user?.uid, user?.displayName || 'User');
      toast({ title: t('deleted') });
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
            {isRtl ? 'رقابة شاملة على ميزانيات المشاريع وتتبع التعديلات المالية.' : 'Unified oversight of project budgets and financial adjustments.'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
           <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-xl h-12 gap-1 shadow-sm shrink-0">
             <TabsTrigger value="boqs" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'المقايسات' : 'BOQs'}
             </TabsTrigger>
             <TabsTrigger value="variations" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <Sparkles className="h-4 w-4" /> {isRtl ? 'الأوامر التغييرية' : 'Variations'}
             </TabsTrigger>
           </TabsList>
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input placeholder={t('search')} className="ps-12 rounded-2xl h-12 bg-white border-2 border-slate-100 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </div>

        <TabsContent value="boqs" className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-8 ps-10 text-start">{isRtl ? 'رقم المقايسة / العميل' : 'BOQ / Client'}</TableHead>
                    <TableHead className="text-start">{isRtl ? 'ملخص التعديلات' : 'VO Summary'}</TableHead>
                    <TableHead className="text-end">{isRtl ? 'الميزانية المخططة' : 'Planned Budget'}</TableHead>
                    <TableHead className="text-start">{t('status')}</TableHead>
                    <TableHead className="pe-10 text-end"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.map((boq) => (
                    <TableRow key={boq.id} className="hover:bg-slate-50 transition-colors group border-b-slate-50 cursor-pointer" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                      <TableCell className="py-8 ps-10 text-start">
                         <div className="flex items-center gap-5">
                            <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary font-black text-xl border-2 border-orange-50 group-hover:scale-110 transition-transform"><FileSpreadsheet className="h-7 w-7" /></div>
                            <div className="text-start">
                               <p className="font-black text-xl text-slate-800">{boq.boqNumber}</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1"><UserCircle className="h-3 w-3" /> {boq.clientName}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="text-start"><BOQVariationStats boqId={boq.id!} companyId={companyId!} /></TableCell>
                      <TableCell className="text-end font-mono font-black text-xl text-slate-900 pe-4">{boq.totalAmount?.toLocaleString()}</TableCell>
                      <TableCell className="text-start">
                         <Badge className={cn("font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]", boq.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{boq.status}</Badge>
                      </TableCell>
                      <TableCell className="pe-10 text-end" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-2">
                            {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeletingId(boq.id!)} className="h-12 w-12 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-6 w-6" /></Button>}
                            <Button variant="outline" className="rounded-xl h-12 px-5 font-black text-[10px] gap-2 hover:bg-primary hover:text-white" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}><Settings2 className="h-4 w-4" /> {isRtl ? 'إدارة' : 'Manage'}</Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variations" className="animate-in fade-in">
          <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-8 ps-10 text-start">{isRtl ? 'الأمر التغييري / العنوان' : 'Variation / Title'}</TableHead>
                    <TableHead className="text-start">{isRtl ? 'المقايسة' : 'BOQ'}</TableHead>
                    <TableHead className="text-end">{isRtl ? 'القيمة (صافي)' : 'Net Amount'}</TableHead>
                    <TableHead className="text-start">{t('status')}</TableHead>
                    <TableHead className="pe-10 text-end">{isRtl ? 'قرار الإدارة' : 'Decision'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredVOs.map((vo) => (
                    <TableRow key={vo.id} className="hover:bg-slate-50/50 border-b-slate-50">
                      <TableCell className="py-8 ps-10 text-start">
                         <div className="flex items-center gap-5 text-start">
                            <div className={cn("h-14 w-14 rounded-2xl shadow-lg flex items-center justify-center border-2", vo.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100")}><Sparkles className="h-7 w-7" /></div>
                            <div><p className="font-black text-xl text-slate-800">{vo.title}</p><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">ID: {vo.id!.slice(-6)}</p></div>
                         </div>
                      </TableCell>
                      <TableCell className="text-start font-black text-slate-500 text-xs">{vo.boqNumber}</TableCell>
                      <TableCell className="text-end font-mono font-black text-xl pe-4" style={{ color: vo.totalAmount >= 0 ? '#10b981' : '#ef4444' }}>{vo.totalAmount >= 0 ? '+' : ''}{vo.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-start">
                         <Badge className={cn("font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]", vo.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : vo.status === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600')}>{vo.status}</Badge>
                      </TableCell>
                      <TableCell className="pe-10 text-end">
                         {vo.status === 'draft' ? (
                            <Button onClick={() => handleReviewVO(vo)} className="h-10 px-6 rounded-xl btn-gradient text-[10px] gap-2"><FileSearch className="h-4 w-4" /> {isRtl ? 'مراجعة واعتماد' : 'Review & Approve'}</Button>
                         ) : (
                            <div className="flex items-center justify-end gap-2 text-slate-300 font-bold text-[9px] uppercase"><CheckCircle2 className="h-4 w-4" /> {isRtl ? 'تمت المعالجة' : 'Processed'}</div>
                         )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* VO Review Dialog */}
      <Dialog open={!!reviewVO} onOpenChange={(open) => !open && setReviewVO(null)}>
         <DialogContent className="max-w-5xl rounded-none p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-[#1e1b4b] p-8 text-white text-start flex justify-between items-center">
               <div className="flex items-center gap-6">
                  <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-2xl"><FileSearch className="h-7 w-7" /></div>
                  <div><DialogTitle className="text-2xl font-black">{isRtl ? 'مراجعة أمر تغييري' : 'Review Variation'}</DialogTitle><p className="text-[10px] text-slate-400 uppercase tracking-widest">{reviewVO?.title} | {reviewVO?.boqNumber}</p></div>
               </div>
               <div className="text-end">
                  <p className="text-[9px] font-black text-primary uppercase mb-1">Impact</p>
                  <h3 className={cn("text-3xl font-black font-mono", (reviewVO?.totalAmount || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{reviewVO?.totalAmount.toLocaleString()} KWD</h3>
               </div>
            </div>
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide text-start">
               <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner"><h5 className="font-black text-xs text-slate-400 uppercase mb-2">Justification</h5><p className="text-sm font-bold text-slate-700 leading-relaxed">{reviewVO?.reason || '---'}</p></div>
               <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                     <TableHeader className="bg-slate-900"><TableRow><TableHead className="ps-6 text-white">Action</TableHead><TableHead className="text-white">Item</TableHead><TableHead className="text-center text-white">Delta</TableHead><TableHead className="text-end text-white">Rate</TableHead><TableHead className="text-end pe-6 text-white">Total</TableHead></TableRow></TableHeader>
                     <TableBody>
                        {loadingReview ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : reviewItems.map((item, idx) => (
                          <TableRow key={idx}>
                             <TableCell className="ps-6"><Badge variant="outline" className="font-black text-[8px] uppercase">{item.type}</Badge></TableCell>
                             <TableCell className="font-bold text-xs text-slate-700">{item.description}</TableCell>
                             <TableCell className="text-center font-mono font-black text-xs">{item.quantityDelta}</TableCell>
                             <TableCell className="text-end font-mono text-xs">{item.rate?.toLocaleString()}</TableCell>
                             <TableCell className="text-end pe-6 font-mono font-black">{item.total?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
               <Button onClick={handleRejectVO} disabled={!!processingId} variant="outline" className="flex-1 h-16 rounded-2xl border-2 border-rose-100 text-rose-600 font-black">رفض وإلغاء</Button>
               <Button onClick={handleApproveVO} disabled={!!processingId} className="flex-[2] h-16 rounded-2xl btn-gradient text-xl gap-3">{processingId ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}{isRtl ? 'اعتماد التغيير وحقنه' : 'Approve & Commit'}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50"><AlertTriangle className="h-10 w-10" /></div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">{isRtl ? 'هل أنت متأكد؟ سيتم حذف المقايسة وكافة سجلات التنفيذ الميداني المرتبطة بها نهائياً.' : 'Are you sure? This BOQ and all associated field execution logs will be permanently deleted.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBOQ} disabled={isDeleting} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">{isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف المقايسة' : 'Confirm Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
