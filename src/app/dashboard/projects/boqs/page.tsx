
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
  Trash2, Sparkles, Clock,
  CheckCircle2, FileSearch, RefreshCw, XCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
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
  const { isRtl, t } = useLanguage();
  const db = useFirestore();

  const voQuery = useMemo(() =>
    companyId && db ? query(collection(db, paths.boqVariations(companyId, boqId))) : null,
  [db, companyId, boqId]);

  const { data: variations, loading } = useCollection<BOQVariation>(voQuery);

  if (loading) return <div className="h-3 w-10 bg-slate-100 animate-pulse rounded-md" />;
  if (!variations || variations.length === 0) return <span className="text-[10px] text-slate-300 italic">{t('common.all')}</span>;

  const stats = {
    total: variations.length,
    draft: variations.filter(v => v.status === 'draft').length,
    approved: variations.filter(v => v.status === 'approved').length
  };

  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold border-slate-200 text-slate-500 bg-white uppercase">
        {t('projects.boqExplorer.variation')}: {stats.total}
      </Badge>
      {stats.draft > 0 && <Badge className="h-5 px-1.5 text-[9px] font-bold bg-blue-50 text-blue-600 border-0 uppercase">D: {stats.draft}</Badge>}
      {stats.approved > 0 && <Badge className="h-5 px-1.5 text-[9px] font-bold bg-emerald-50 text-emerald-600 border-0 uppercase">A: {stats.approved}</Badge>}
    </div>
  );
}

export default function BOQExplorerPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
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

  // إزالة orderBy لتجنب أخطاء الفهرس (Index Errors) لضمان ظهور البيانات فوراً
  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId))) : null, 
  [db, companyId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqsQuery);

  useEffect(() => {
    async function fetchAllVariations() {
      if (!boqs || boqs.length === 0 || !db || !companyId) {
        setAllVOs([]);
        return;
      }
      
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
        
        // فرز يدوي في الذاكرة لتجنب الحاجة لفهرس سحابي
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
  }, [boqs, db, companyId]);

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
      toast({ variant: "destructive", title: t('common.error') });
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
      toast({ title: t('common.saved') });
      setAllVOs(prev => prev.map(v => v.id === reviewVO.id ? { ...v, status: 'approved' } : v));
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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
      toast({ title: t('common.saved') });
      setAllVOs(prev => prev.map(v => v.id === reviewVO.id ? { ...v, status: 'cancelled' } : v));
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            {t('projects.boqExplorer.title')}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {t('projects.radar')}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
           <TabsList className="bg-white border-2 border-primary/5 p-1 rounded-xl h-11 gap-1 shadow-sm shrink-0">
             <TabsTrigger value="boqs" className="rounded-lg text-[11px] font-black px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                {t('projects.boqExplorer.boqs')}
             </TabsTrigger>
             <TabsTrigger value="variations" className="rounded-lg text-[11px] font-black px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                {t('projects.boqExplorer.variations')}
                {allVOs.filter(v => v.status === 'draft').length > 0 && (
                   <Badge className="bg-rose-500 text-white border-0 h-4 px-1.5 min-w-[18px] flex items-center justify-center text-[8px] ms-2 rounded-full">
                      {allVOs.filter(v => v.status === 'draft').length}
                   </Badge>
                )}
             </TabsTrigger>
           </TabsList>
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder={t('common.search')} className="ps-11 h-11 rounded-xl bg-white border-2 border-slate-100 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </div>

        <TabsContent value="boqs" className="m-0 animate-in slide-in-from-bottom-2">
          <Card className="rounded-[1.5rem] border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b">
                    <TableHead className="py-4 ps-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqExplorer.boqAndClient')}</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqExplorer.voSummary')}</TableHead>
                    <TableHead className="py-4 text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqExplorer.budget')}</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                    <TableHead className="py-4 pe-6 text-end"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.length === 0 ? (
                     <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 text-sm font-black italic">{t('projects.boqExplorer.noBoqs')}</TableCell></TableRow>
                  ) : filteredBoqs.map((boq) => (
                    <TableRow key={boq.id} className="hover:bg-primary/[0.01] border-b-slate-50 cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                      <TableCell className="py-4 ps-6 text-start">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black text-xs border border-primary/10">
                               {boq.boqNumber?.charAt(0) || 'B'}
                            </div>
                            <div className="text-start">
                               <p className="font-black text-sm text-slate-900">{boq.boqNumber}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{boq.clientName}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="py-4 text-start"><BOQVariationStats boqId={boq.id!} companyId={companyId!} /></TableCell>
                      <TableCell className="py-4 text-end font-mono font-black text-slate-700">{boq.totalAmount?.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                      <TableCell className="py-4 text-start">
                         <Badge className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-lg border-0 shadow-sm", boq.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white')}>{boq.status}</Badge>
                      </TableCell>
                      <TableCell className="py-4 pe-6 text-end" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-2">
                            {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeletingId(boq.id!)} className="h-9 w-9 rounded-xl text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 hover:text-primary" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variations" className="m-0 animate-in slide-in-from-bottom-2">
          <Card className="rounded-[1.5rem] border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b">
                    <TableHead className="py-4 ps-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqExplorer.variation')}</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqExplorer.boqs')}</TableHead>
                    <TableHead className="py-4 text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqExplorer.amount')}</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                    <TableHead className="py-4 pe-6 text-end"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : filteredVOs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 text-sm font-black italic">
                       {t('projects.boqExplorer.noVariations')}
                    </TableCell></TableRow>
                  ) : filteredVOs.map((vo) => (
                    <TableRow key={vo.id} className="hover:bg-primary/[0.01] border-b-slate-50 transition-colors">
                      <TableCell className="py-4 ps-6 text-start">
                         <div className="flex items-center gap-4">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border-2", vo.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100")}><Sparkles className="h-5 w-5" /></div>
                            <div className="text-start">
                               <p className="font-black text-sm text-slate-900">{vo.title}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{vo.boqNumber}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="py-4 text-start font-black text-slate-500 text-[11px]">{vo.boqNumber}</TableCell>
                      <TableCell className="py-4 text-end font-mono font-black text-base" style={{ color: (vo.totalAmount || 0) >= 0 ? '#10b981' : '#ef4444' }}>{(vo.totalAmount || 0) >= 0 ? '+' : ''}{(vo.totalAmount || 0).toLocaleString()} <span className="text-[9px] opacity-40">KWD</span></TableCell>
                      <TableCell className="py-4 text-start">
                         <Badge className={cn("text-[9px] font-black uppercase px-4 py-1 rounded-lg border-0 shadow-sm", vo.status === 'approved' ? 'bg-emerald-500 text-white' : vo.status === 'cancelled' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white')}>{vo.status}</Badge>
                      </TableCell>
                      <TableCell className="py-4 pe-6 text-end">
                         {vo.status === 'draft' ? (
                            <Button onClick={() => handleReviewVO(vo)} className="h-9 px-6 rounded-xl text-xs font-black gap-2 shadow-lg hover:scale-105 transition-all"><FileSearch className="h-4 w-4" /> {t('projects.boqExplorer.review')}</Button>
                         ) : (
                            <div className="flex items-center justify-end gap-2 text-slate-400 font-black text-[10px] uppercase">
                               {vo.status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
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
         <DialogContent className="max-w-5xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-8 text-slate-900 text-start border-b flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm"><FileSearch className="h-6 w-6" /></div>
                  <div><DialogTitle className="text-xl font-black">{t('projects.boqExplorer.review')}</DialogTitle><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{reviewVO?.title} | {reviewVO?.boqNumber}</p></div>
               </div>
               <div className="text-end">
                  <p className="text-[9px] font-black text-primary uppercase mb-1">{t('projects.boqExplorer.financialImpact')}</p>
                  <h3 className={cn("text-2xl font-black font-mono", (reviewVO?.totalAmount || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{(reviewVO?.totalAmount || 0).toLocaleString()} <span className="text-xs opacity-40">KWD</span></h3>
               </div>
            </div>
            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto text-start scrollbar-hide bg-white">
               <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner text-sm font-black text-slate-600 leading-relaxed italic">"{reviewVO?.reason || '---'}"</div>
               <div className="border-2 border-slate-50 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                     <TableHeader className="bg-slate-50">
                        <TableRow>
                           <TableHead className="ps-6 py-4 text-[10px] font-black uppercase tracking-widest">{t('projects.boqExplorer.action')}</TableHead>
                           <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest">{t('projects.boqExplorer.item')}</TableHead>
                           <TableHead className="py-4 text-center text-[10px] font-black uppercase tracking-widest">{t('projects.boqExplorer.delta')}</TableHead>
                           <TableHead className="py-4 text-end text-[10px] font-black uppercase tracking-widest">{t('projects.boqExplorer.rate')}</TableHead>
                           <TableHead className="pe-6 py-4 text-end text-[10px] font-black uppercase tracking-widest">{t('projects.boqExplorer.total')}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {loadingReview ? <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow> : reviewItems.map((item, idx) => (
                          <TableRow key={idx} className="text-xs hover:bg-slate-50/50 border-b-slate-100">
                             <TableCell className="ps-6 py-4"><Badge variant="outline" className="text-[9px] font-black uppercase h-6 px-3 rounded-lg border-2">{item.type}</Badge></TableCell>
                             <TableCell className="py-4 font-black text-slate-700">{item.description}</TableCell>
                             <TableCell className="py-4 text-center font-mono font-black text-sm">{item.quantityDelta}</TableCell>
                             <TableCell className="py-4 text-end font-mono font-bold">{item.rate?.toLocaleString()}</TableCell>
                             <TableCell className="pe-6 py-4 text-end font-mono font-black text-base text-slate-900">{item.total?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
               <Button onClick={() => setReviewVO(null)} variant="outline" className="flex-1 h-14 rounded-2xl text-sm font-black bg-white border-2">إلغاء</Button>
               <Button onClick={handleRejectVO} disabled={!!processingId} variant="destructive" className="flex-1 h-14 rounded-2xl text-sm font-black">رفض التعديل</Button>
               <Button onClick={handleApproveVO} disabled={!!processingId} className="flex-[2] h-14 rounded-2xl text-sm font-black gap-3 shadow-xl border-b-8 border-orange-700">
                  {processingId ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-6 w-6" />}
                  {t('projects.boqExplorer.approveAndCommit')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 max-w-md border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50"><Trash2 className="h-10 w-10" /></div>
             <AlertDialogTitle className="text-center font-black text-3xl font-headline text-slate-900 leading-tight">{t('common.confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-center font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                هل أنت متأكد؟ هذا الإجراء سيمحو سجل المقايسة المعتمد نهائياً ولا يمكن التراجع عنه.
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBOQ} disabled={isDeleting} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-200">
               {isDeleting ? <Loader2 className="animate-spin h-6 w-6" /> : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
