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
  const { lang, dir, t, tSafe } = useLanguage();
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
    if (!companyId || !db || !transaction.activityTypeId) return null;
    const path = type === 'quotation' ? paths.quotationTemplates(companyId) : paths.contractTemplates(companyId);
    
    return query(
      collection(db, path), 
      where('isActive', '==', true),
      where('activityTypeId', '==', transaction.activityTypeId)
    );
  }, [db, companyId, type, transaction.activityTypeId]);

  const { data: rawTemplates } = useCollection<any>(templatesQuery);

  const templates = useMemo(() => {
    if (!rawTemplates) return [];
    return [...rawTemplates].sort((a, b) => {
       if (a.subServiceId === transaction.subServiceId) return -1;
       if (b.subServiceId === transaction.subServiceId) return 1;
       return 0;
    });
  }, [rawTemplates, transaction.subServiceId]);

  const handleCreate = async () => {
    if (!db || !companyId || !user || !selectedTemplateId) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const docPrefix = type === 'quotation' ? tSafe('inline.quotation', 'عرض سعر', 'Quotation') : tSafe('inline.contract', 'عقد', 'Contract');
      const name = `${docPrefix} - ${transaction.subServiceName}`;
      const payload = { transactionId: transaction.id, clientId, clientName, name };
      
      let docId = "";
      if (type === 'quotation') {
        docId = await service.instantiateQuotationFromTemplate(selectedTemplateId, payload, user.uid, globalUser?.username || 'User');
      } else {
        docId = await service.instantiateContractFromTemplate(selectedTemplateId, payload, user.uid, globalUser?.username || 'User');
      }

      toast({ title: tSafe('inline.draft.ready', 'تم تجهيز المسودة', 'Draft Ready') });
      
      onClose();
      forceThaw();
      
      if (type === 'quotation') {
        router.push(`/dashboard/clients/${clientId}/quotations/${docId}`);
      } else {
        router.push(`/dashboard/clients/${clientId}/contracts/${docId}`);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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
      toast({ title: tSafe('inline.document.deleted', 'تم حذف المستند بنجاح', 'Document deleted') });
      setDeletingId(null);
      forceThaw();
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
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
      toast({ title: tSafe('inline.payment.confirmed', 'تم توثيق السداد', 'Payment Confirmed') });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
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
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
          <div className="bg-slate-50 p-8 text-slate-900 text-start border-b flex justify-between items-center shrink-0">
             <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-primary/5">
                   {type === 'quotation' ? <FileText className="h-7 w-7" /> : <Gavel className="h-7 w-7" />}
                </div>
                <div>
                   <DialogTitle className="text-2xl font-black font-headline text-slate-900">
                      {type === 'quotation' ? tSafe('inline.quotations', 'عروض الأسعار', 'Quotations') : tSafe('inline.formal.contracts', 'العقود الرسمية', 'Formal Contracts')}
                   </DialogTitle>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{transaction.transactionNumber}</p>
                </div>
             </div>
             <Badge variant="secondary" className="bg-white border-2 text-primary border-primary/20 font-black h-9 px-6 rounded-xl text-xs shadow-sm">{clientName}</Badge>
          </div>

          <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12 max-h-[65vh] overflow-y-auto scrollbar-hide text-start bg-white">
             
             <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50 pb-3 flex items-center gap-2">
                   <Plus className="h-4 w-4 text-primary" /> {t('common.add')}
                </h3>
                
                <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-slate-100 space-y-6 shadow-inner">
                   <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                         {tSafe('inline.choose.template', 'اختر القالب المرجعي', 'Choose Template')} ({transaction.activityTypeName})
                      </Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                         <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-bold text-sm">
                            <SelectValue placeholder="..." />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                            {templates?.map(temp => (
                              <SelectItem key={temp.id} value={temp.id!} className="font-bold py-3 text-xs border-b last:border-0 border-slate-50">
                                 <div className="flex flex-col text-start">
                                    <span>{temp.name}</span>
                                    {temp.subServiceId === transaction.subServiceId && (
                                       <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[7px] font-black h-4 w-fit mt-1">{tSafe('inline.direct.matching.key', 'مطابقة مباشرة', 'DIRECT MATCH')}</Badge>
                                    )}
                                 </div>
                              </SelectItem>
                            ))}
                            {templates.length === 0 && (
                               <div className="p-6 text-center text-slate-400 text-xs italic">
                                  {t('common.noResults')}
                               </div>
                            )}
                         </SelectContent>
                      </Select>
                   </div>
                   
                   <Button 
                     onClick={handleCreate} 
                     disabled={loading || !selectedTemplateId}
                     className="w-full h-14 rounded-2xl bg-primary text-white font-black text-sm gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all border-b-4 border-orange-700"
                   >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      {tSafe('inline.generate.design', 'تجهيز المسودة للمراجعة', 'Generate & Design')}
                   </Button>
                </div>
             </div>

             <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50 pb-3 flex items-center gap-2">
                   <History className="h-4 w-4 text-primary" /> {t('common.records')}
                </h3>

                <div className="space-y-3">
                   {docsLoading ? (
                     <div className="py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div>
                   ) : documents?.length === 0 ? (
                     <div className="py-20 text-center border-4 border-dashed rounded-3xl bg-slate-50/50 text-slate-300 font-bold italic text-sm">
                        {t('common.noResults')}
                     </div>
                   ) : (
                     documents?.map((doc: any) => (
                       <div key={doc.id} className="p-5 rounded-2xl bg-white border-2 border-slate-50 flex items-center justify-between gap-4 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group">
                          <div className="flex items-center gap-4 text-start truncate">
                             <div className={cn(
                               "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                               (doc.status === 'paid' || doc.isPaid) ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                             )}>
                                {type === 'quotation' ? <FileText className="h-5 w-5" /> : <Gavel className="h-5 w-5" />}
                             </div>
                             <div className="truncate">
                                <h5 className="font-black text-xs text-slate-800 truncate">{doc.name}</h5>
                                <p className="text-[10px] font-mono font-bold text-emerald-600">{(doc.totalAmount || 0).toLocaleString()} KWD</p>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                             {type === 'contract' && !doc.isPaid && doc.status !== 'paid' && isAdmin && (
                               <Button 
                                 onClick={() => handleMarkAsPaid(doc.id)}
                                 disabled={loading}
                                 variant="outline" 
                                 className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[9px] gap-2 hover:bg-emerald-600 hover:text-white"
                               >
                                  <Wallet className="h-3.5 w-3.5" /> {tSafe('inline.mark.paid', 'توثيق سداد', 'Mark Paid')}
                               </Button>
                             )}
                             <Button 
                               onClick={() => viewDoc(doc.id)}
                               variant="outline" 
                               size="icon" 
                               className="h-8 w-8 rounded-lg bg-white text-slate-400 hover:text-primary hover:border-primary/40 shadow-sm"
                             >
                                <ExternalLink className="h-4 w-4" />
                             </Button>
                             {isAdmin && (
                                <Button 
                                  onClick={() => setDeletingId(doc.id)}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                                >
                                   <Trash2 className="h-4 w-4" />
                                </Button>
                             )}
                          </div>
                       </div>
                     ))
                   )}
                </div>
             </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t shrink-0">
             <Button variant="outline" onClick={onClose} className="rounded-xl font-black h-12 px-10 bg-white border-2">{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if(!v) setDeletingId(null); forceThaw(); }}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('common.confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {tSafe('inline.are.you.sure..this.document.will.be.permanently.removed.from.the.archive', 'هل أنت متأكد؟ سيتم حذف المستند نهائياً من الأرشيف ولا يمكن التراجع.', 'Are you sure? This document will be permanently removed from the archive.')}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white" onClick={() => { setDeletingId(null); forceThaw(); }}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={loading}
              className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 text-white shadow-xl shadow-rose-200"
            >
               {loading ? <Loader2 className="animate-spin h-5 w-5" /> : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}