
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSpreadsheet, Search, Loader2, ArrowRight, 
  Trash2, AlertTriangle, Sparkles, Clock,
  CheckCircle2, FileSearch, UserCircle, Settings2,
  XCircle, RefreshCw, Layers
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc, orderBy } from 'firebase/firestore';
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

  if (loading) return <div className="h-3 w-10 bg-slate-100 animate-pulse rounded-md" />;
  if (!variations || variations.length === 0) return <span className="text-[10px] text-slate-300 italic">{isRtl ? 'لا يوجد' : 'None'}</span>;

  const stats = {
    total: variations.length,
    draft: variations.filter(v => v.status === 'draft').length,
    approved: variations.filter(v => v.status === 'approved').length
  };

  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold border-slate-200 text-slate-500 bg-white">
        VO: {stats.total}
      </Badge>
      {stats.draft > 0 && <Badge className="h-5 px-1.5 text-[9px] font-bold bg-blue-50 text-blue-600 border-0">D: {stats.draft}</Badge>}
      {stats.approved > 0 && <Badge className="h-5 px-1.5 text-[9px] font-bold bg-emerald-50 text-emerald-600 border-0">A: {stats.approved}</Badge>}
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
  
  const [reviewVO, setReviewVO] = useState<BOQVariation | null>(null);
  const [reviewItems, setReviewItems] = useState<BOQVariationItem[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  const [allVOs, setAllVOs] = useState<BOQVariation[]>([]);
  const [voLoading, setVoLoading] = useState(false);

  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqsQuery);

  useEffect(() => {
    async function fetchAllVariations() {
      if (!boqs || boqs.length === 0 || !db || !companyId) {
        setAllVOs([]);
        return;
      }
      
      if (allVOs.length > 0 && !voLoading) return;

      setVoLoading(true);
      try {
        const results: BOQVariation[] = [];
        const promises = boqs.map(async (boq) => {
           const voPath = paths.boqVariations(companyId, boq.id!);
           const snap = await getDocs(collection(db, voPath));
           return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariation));
        });

        const voArrays = await Promise.all(promises);
        voArrays.forEach(arr => results.push(...arr));
        
        const sorted = results.sort((a, b) => {
           const dateA = a.createdAt?.toMillis?.() || 0;
           const dateB = b.createdAt?.toMillis?.() || 0;
           return dateB - dateA;
        });

        setAllVOs(sorted);
      } catch (e) {
        console.error("Manual variation merge failed:", e);
      } finally {
        setVoLoading(false);
      }
    }

    if (boqs && boqs.length > 0) {
       fetchAllVariations();
    }
  }, [boqs, db, companyId, allVOs.length, voLoading]);

  const filteredBoqs = useMemo(() => {
    return (boqs || []).filter(boq => 
      (boq.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (boq.clientName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boqs, searchTerm]);

  const filteredVOs = useMemo(() => {
    return allVOs.filter(vo => 
        (vo.title || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (vo.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [allVOs, searchTerm]);

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
      setAllVOs(prev => prev.map(v => v.id === reviewVO.id ? { ...v, status: 'approved' } : v));
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
      setAllVOs(prev => prev.map(v => v.id === reviewVO.id ? { ...v, status: 'cancelled' } : v));
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
    <div className="w-full space-y-4 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t('boqExplorer')}
          </h1>
          <p className="text-xs text-muted-foreground font-medium opacity-80">
            {isRtl ? 'رقابة شاملة على ميزانيات المشاريع وتتبع التعديلات المالية.' : 'Unified oversight of project budgets and financial adjustments.'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
           <TabsList className="bg-white border p-1 rounded-md h-9 gap-1 shadow-sm shrink-0">
             <TabsTrigger value="boqs" className="rounded-sm text-[11px] font-semibold px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">
                {isRtl ? 'المقايسات' : 'BOQs'}
             </TabsTrigger>
             <TabsTrigger value="variations" className="rounded-sm text-[11px] font-semibold px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">
                {isRtl ? 'الأوامر التغييرية' : 'Variations'}
                {allVOs.filter(v => v.status === 'draft').length > 0 && (
                   <Badge className="bg-rose-500 text-white border-0 h-3.5 px-1 min-w-[14px] flex items-center justify-center text-[7px] ms-1">
                      {allVOs.filter(v => v.status === 'draft').length}
                   </Badge>
                )}
             </TabsTrigger>
           </TabsList>
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder={t('search')} className="ps-9 h-9 rounded-md bg-white border-slate-200 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </div>

        <TabsContent value="boqs" className="m-0">
          <Card className="rounded-lg border shadow-sm bg-white overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-b">
                    <TableHead className="py-3 ps-4 text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'رقم المقايسة / العميل' : 'BOQ / Client'}</TableHead>
                    <TableHead className="py-3 text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'ملخص التعديلات' : 'VO Summary'}</TableHead>
                    <TableHead className="py-3 text-end text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'الميزانية' : 'Budget'}</TableHead>
                    <TableHead className="py-3 text-[10px] font-bold uppercase text-slate-500">{t('status')}</TableHead>
                    <TableHead className="py-3 pe-4 text-end"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.length === 0 ? (
                     <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 text-sm font-medium">لا يوجد مقايسات حالياً.</TableCell></TableRow>
                  ) : filteredBoqs.map((boq) => (
                    <TableRow key={boq.id} className="hover:bg-slate-50/70 border-b cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                      <TableCell className="py-2.5 ps-4 text-start">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-md bg-primary/5 text-primary flex items-center justify-center font-bold text-xs border">
                               {boq.boqNumber?.charAt(0) || 'B'}
                            </div>
                            <div className="text-start">
                               <p className="font-semibold text-sm text-slate-900">{boq.boqNumber}</p>
                               <p className="text-[10px] text-slate-400 font-medium">{boq.clientName}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-start"><BOQVariationStats boqId={boq.id!} companyId={companyId!} /></TableCell>
                      <TableCell className="py-2.5 text-end font-mono font-bold text-slate-700">{boq.totalAmount?.toLocaleString()}</TableCell>
                      <TableCell className="py-2.5 text-start">
                         <Badge className={cn("text-[9px] font-bold uppercase px-2 h-5 border-0", boq.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{boq.status}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5 pe-4 text-end" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-1">
                            {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeletingId(boq.id!)} className="h-7 w-7 text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variations" className="m-0">
          <Card className="rounded-lg border shadow-sm bg-white overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-b">
                    <TableHead className="py-3 ps-4 text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'الأمر التغييري' : 'Variation'}</TableHead>
                    <TableHead className="py-3 text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'المقايسة' : 'BOQ'}</TableHead>
                    <TableHead className="py-3 text-end text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'القيمة' : 'Amount'}</TableHead>
                    <TableHead className="py-3 text-[10px] font-bold uppercase text-slate-500">{t('status')}</TableHead>
                    <TableHead className="py-3 pe-4 text-end"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredVOs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 text-sm">
                       {isRtl ? 'لا يوجد أوامر تغييرية مسجلة.' : 'No variations found.'}
                    </TableCell></TableRow>
                  ) : filteredVOs.map((vo) => (
                    <TableRow key={vo.id} className="hover:bg-slate-50/70 border-b">
                      <TableCell className="py-2.5 ps-4 text-start">
                         <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-md flex items-center justify-center border", vo.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100")}><Sparkles className="h-4 w-4" /></div>
                            <div className="text-start"><p className="font-semibold text-sm text-slate-900">{vo.title}</p></div>
                         </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-start font-bold text-slate-500 text-[11px]">{vo.boqNumber}</TableCell>
                      <TableCell className="py-2.5 text-end font-mono font-bold text-sm" style={{ color: (vo.totalAmount || 0) >= 0 ? '#10b981' : '#ef4444' }}>{(vo.totalAmount || 0) >= 0 ? '+' : ''}{(vo.totalAmount || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-2.5 text-start">
                         <Badge className={cn("text-[9px] font-bold uppercase px-2 h-5 border-0", vo.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : vo.status === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600')}>{vo.status}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5 pe-4 text-end">
                         {vo.status === 'draft' ? (
                            <Button onClick={() => handleReviewVO(vo)} className="h-7 px-3 rounded-md text-[10px] font-bold gap-1.5"><FileSearch className="h-3.5 w-3.5" /> {isRtl ? 'مراجعة' : 'Review'}</Button>
                         ) : (
                            <div className="flex items-center justify-end gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
                               {vo.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                               {vo.status}
                            </div>
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

      <Dialog open={!!reviewVO} onOpenChange={(open) => !open && setReviewVO(null)}>
         <DialogContent className="max-w-4xl rounded-lg p-0 overflow-hidden border shadow-2xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start border-b flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm"><FileSearch className="h-5 w-5" /></div>
                  <div><DialogTitle className="text-lg font-bold">{isRtl ? 'مراجعة أمر تغييري' : 'Review Variation'}</DialogTitle><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{reviewVO?.title} | {reviewVO?.boqNumber}</p></div>
               </div>
               <div className="text-end">
                  <p className="text-[8px] font-bold text-primary uppercase mb-1">Financial Impact</p>
                  <h3 className={cn("text-xl font-bold font-mono", (reviewVO?.totalAmount || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{(reviewVO?.totalAmount || 0).toLocaleString()} <span className="text-[10px] opacity-40">KWD</span></h3>
               </div>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-start">
               <div className="p-4 bg-slate-50/50 rounded-lg border text-sm font-medium text-slate-600 leading-relaxed italic">"{reviewVO?.reason || '---'}"</div>
               <div className="border rounded-md overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50">
                        <TableRow>
                           <TableHead className="ps-4 py-2 text-[10px] font-bold uppercase">Action</TableHead>
                           <TableHead className="py-2 text-[10px] font-bold uppercase">Item</TableHead>
                           <TableHead className="py-2 text-center text-[10px] font-bold uppercase">Delta</TableHead>
                           <TableHead className="py-2 text-end text-[10px] font-bold uppercase">Rate</TableHead>
                           <TableHead className="pe-4 py-2 text-end text-[10px] font-bold uppercase">Total</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {loadingReview ? <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin h-5 w-5 mx-auto text-primary" /></TableCell></TableRow> : reviewItems.map((item, idx) => (
                          <TableRow key={idx} className="text-xs">
                             <TableCell className="ps-4 py-2"><Badge variant="outline" className="text-[8px] font-bold uppercase h-4 px-1">{item.type}</Badge></TableCell>
                             <TableCell className="py-2 font-semibold text-slate-700">{item.description}</TableCell>
                             <TableCell className="py-2 text-center font-mono font-bold">{item.quantityDelta}</TableCell>
                             <TableCell className="py-2 text-end font-mono">{item.rate?.toLocaleString()}</TableCell>
                             <TableCell className="pe-4 py-2 text-end font-mono font-bold">{item.total?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row gap-2">
               <Button onClick={() => setReviewVO(null)} variant="outline" className="flex-1 h-9 rounded-md text-xs font-semibold">إلغاء</Button>
               <Button onClick={handleRejectVO} disabled={!!processingId} variant="destructive" className="flex-1 h-9 rounded-md text-xs font-semibold">رفض التعديل</Button>
               <Button onClick={handleApproveVO} disabled={!!processingId} className="flex-[1.5] h-9 rounded-md text-xs font-bold gap-2">
                  {processingId ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isRtl ? 'اعتماد التغيير وحقنه' : 'Approve & Commit'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md border shadow-2xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4"><Trash2 className="h-6 w-6" /></div>
             <AlertDialogTitle className="text-center font-bold text-xl">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-center font-medium text-slate-400 mt-2 text-sm">
                {isRtl ? 'سيتم حذف المقايسة وكافة سجلات التنفيذ الميداني المرتبطة بها نهائياً.' : 'Are you sure? This BOQ and all associated field execution logs will be permanently deleted.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2 flex flex-row">
            <AlertDialogCancel className="flex-1 h-9 rounded-md text-xs font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBOQ} disabled={isDeleting} className="flex-1 h-9 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700">
               {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : (isRtl ? 'نعم، احذف' : 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
