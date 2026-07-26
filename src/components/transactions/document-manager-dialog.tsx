'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, Gavel, Plus, Loader2, 
  ShieldCheck, Clock,
  Wallet, Receipt, 
  Sparkles, CheckCircle2,
  ExternalLink,
  Info,
  History,
  Trash2,
  AlertTriangle,
  X,
  Workflow
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { DocumentService } from '@/services/document-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'quotation' | 'contract';
  transaction: any;
  clientId: string;
  clientName: string;
}

export function TransactionDocumentsDialog({ isOpen, onClose, type, transaction, clientId, clientName }: Props) {
  const { lang, dir, t } = useLanguage();
  const { globalUser, user } = useAuthContext();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';
      document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(forceThaw, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, forceThaw]);

  const docsQuery = useMemo(() => {
    if (!companyId || !db || !transaction.id) return null;
    const path = type === 'quotation' ? paths.quotations(companyId) : paths.contracts(companyId);
    return query(collection(db, path), where('transactionId', '==', transaction.id));
  }, [db, companyId, transaction.id, type]);

  const { data: documents, loading: docsLoading } = useCollection<any>(docsQuery);

  const templatesQuery = useMemo(() => {
    if (!companyId || !db) return null;
    const path = type === 'quotation' ? paths.quotationTemplates(companyId) : paths.contractTemplates(companyId);
    return query(collection(db, path), where('isActive', '==', true));
  }, [db, companyId, type]);

  const { data: templates } = useCollection<any>(templatesQuery);

  const handleCreate = async () => {
    if (!db || !companyId || !user || !selectedTemplateId) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const name = `${type === 'quotation' ? (isRtl ? 'عرض سعر' : 'Quotation') : (isRtl ? 'عقد' : 'Contract')} - ${transaction.subServiceName}`;
      const payload = { transactionId: transaction.id, clientId, clientName, name };
      
      let docId = "";
      if (type === 'quotation') {
        docId = await service.instantiateQuotationFromTemplate(selectedTemplateId, payload, user.uid, globalUser?.username || 'User');
      } else {
        docId = await service.instantiateContractFromTemplate(selectedTemplateId, payload, user.uid, globalUser?.username || 'User');
      }

      toast({ title: isRtl ? "تم تجهيز المسودة" : "Draft Ready" });
      
      onClose();
      forceThaw();
      
      if (type === 'quotation') {
        router.push(`/dashboard/clients/${clientId}/quotations/${docId}`);
      } else {
        router.push(`/dashboard/clients/${clientId}/contracts/${docId}`);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !companyId || !deletingId) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      if (type === 'quotation') {
        await service.deleteQuotation(deletingId);
      } else {
        await service.deleteContract(deletingId);
      }
      toast({ title: isRtl ? "تم حذف المستند بنجاح" : "Document deleted" });
      setDeletingId(null);
      forceThaw();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (docId: string) => {
    if (!db || !companyId) return;
    setLoading(true);
    try {
      const docRef = doc(db, paths.contracts(companyId), docId);
      await updateDoc(docRef, { 
        status: 'paid', 
        isPaid: true,
        updatedAt: serverTimestamp() 
      });
      toast({ title: isRtl ? "تم توثيق السداد" : "Payment Confirmed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const viewDoc = (id: string) => {
    onClose();
    forceThaw();
    if (type === 'quotation') {
      router.push(`/dashboard/clients/${clientId}/quotations/${id}`);
    } else {
      router.push(`/dashboard/clients/${clientId}/contracts/${id}`);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(v) => { if(!v) onClose(); }}>
        <DialogContent className="max-w-4xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
          <div className="bg-slate-50 p-6 text-slate-900 text-start border-b flex justify-between items-center shrink-0">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                   {type === 'quotation' ? <FileText className="h-5 w-5" /> : <Gavel className="h-5 w-5" />}
                </div>
                <div>
                   <DialogTitle className="text-lg font-black font-headline text-slate-900">
                      {type === 'quotation' ? (isRtl ? 'عروض الأسعار' : 'Quotations') : (isRtl ? 'العقود الرسمية' : 'Formal Contracts')}
                   </DialogTitle>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{transaction.transactionNumber}</p>
                </div>
             </div>
             <Badge variant="secondary" className="bg-white border text-slate-600 border-slate-200 font-black h-7 px-3 rounded-lg text-[9px]">{clientName}</Badge>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[65vh] overflow-y-auto scrollbar-hide text-start bg-white">
             
             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                   <Plus className="h-3 w-3 text-primary" /> {isRtl ? 'إصدار جديد' : 'New Document'}
                </h3>
                
                <div className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 space-y-4">
                   <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'اختر القالب' : 'Template'}</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                         <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold text-xs">
                            <SelectValue placeholder="..." />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-0 shadow-2xl z-[151]">
                            {templates?.map(temp => (
                              <SelectItem key={temp.id} value={temp.id!} className="font-bold py-2 text-xs">{temp.name}</SelectItem>
                            ))}
                         </SelectContent>
                      </Select>
                   </div>
                   
                   <Button 
                     onClick={handleCreate} 
                     disabled={loading || !selectedTemplateId}
                     className="w-full h-10 rounded-xl bg-primary text-white font-black text-xs gap-2"
                   >
                      {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      {isRtl ? 'تجهيز المسودة' : 'Generate'}
                   </Button>
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                   <History className="h-3 w-3 text-primary" /> {isRtl ? 'الأرشيف المستندي' : 'Doc Archive'}
                </h3>

                <div className="space-y-2">
                   {docsLoading ? (
                     <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/30" /></div>
                   ) : documents?.length === 0 ? (
                     <div className="py-10 text-center border-2 border-dashed rounded-xl bg-slate-50/50 text-slate-300 font-bold italic text-[10px]">
                        {isRtl ? 'لا يوجد مستندات.' : 'Empty archive.'}
                     </div>
                   ) : (
                     documents?.map((doc: any) => (
                       <div key={doc.id} className="p-3 rounded-xl bg-white border border-slate-100 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-center gap-3 text-start truncate">
                             <div className={cn(
                               "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                               (doc.status === 'paid' || doc.isPaid) ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                             )}>
                                {type === 'quotation' ? <FileText className="h-4 w-4" /> : <Gavel className="h-4 w-4" />}
                             </div>
                             <div className="truncate">
                                <h5 className="font-black text-[10px] text-slate-800 truncate">{doc.name}</h5>
                                <p className="text-[8px] font-mono text-slate-400">{(doc.totalAmount || 0).toLocaleString()} KWD</p>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                             {type === 'contract' && !doc.isPaid && doc.status !== 'paid' && isAdmin && (
                               <Button 
                                 onClick={() => handleMarkAsPaid(doc.id)}
                                 disabled={loading}
                                 variant="outline" 
                                 className="h-7 px-2 rounded-lg bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[8px] gap-1 hover:bg-emerald-600 hover:text-white"
                               >
                                  <Wallet className="h-3 w-3" /> {isRtl ? 'دفع' : 'Paid'}
                               </Button>
                             )}
                             <Button 
                               onClick={() => viewDoc(doc.id)}
                               variant="ghost" 
                               size="icon" 
                               className="h-7 w-7 rounded-lg bg-slate-50 text-slate-400 hover:bg-primary hover:text-white transition-all"
                             >
                                <ExternalLink className="h-3.5 w-3.5" />
                             </Button>
                             {isAdmin && (
                                <Button 
                                  onClick={() => setDeletingId(doc.id)}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-lg bg-slate-50 text-rose-300 hover:bg-rose-600 hover:text-white transition-all"
                                >
                                   <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                             )}
                          </div>
                       </div>
                     ))
                   )}
                </div>
             </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
             <Button variant="outline" onClick={onClose} className="rounded-lg font-bold h-9 px-6 bg-white border-2">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if(!v) setDeletingId(null); forceThaw(); }}>
        <AlertDialogContent className="rounded-xl p-8 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4 ring-8 ring-rose-50/50">
                <AlertTriangle className="h-8 w-8" />
             </div>
             <AlertDialogTitle className="text-start font-black text-xl text-slate-900">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-2 text-sm leading-relaxed">
                {isRtl 
                  ? 'سيتم حذف هذا المستند نهائياً من الأرشيف. هل أنت متأكد؟' 
                  : 'Are you sure? This document will be permanently removed from the archive.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 flex flex-row">
            <AlertDialogCancel className="flex-1 h-10 rounded-lg font-bold border-2 bg-white" onClick={() => { setDeletingId(null); forceThaw(); }}>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={loading}
              className="flex-[2] h-10 rounded-lg font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
               {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (isRtl ? 'نعم، احذف المستند' : 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
