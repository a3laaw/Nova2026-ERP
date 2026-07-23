
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  AlertTriangle
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

  // Sovereign Thaw: Force cleanup pointer-events to prevent screen freeze
  useEffect(() => {
    const thaw = () => {
      if (typeof document !== 'undefined') {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
        document.body.removeAttribute('data-scroll-locked');
      }
    };

    if (!isOpen) {
      const timer = setTimeout(thaw, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

      toast({ title: isRtl ? "تم تجهيز المسودة - جاري الانتقال للتعديل" : "Draft Ready - Redirecting to Edit" });
      
      onClose();
      // التوجيه الفوري للتعديل قبل الحفظ الرسمي
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
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
      if (typeof document !== 'undefined') {
        document.body.style.pointerEvents = 'auto';
      }
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
      toast({ title: isRtl ? "تم توثيق السداد وتفعيل المشروع" : "Payment Confirmed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const viewDoc = (id: string) => {
    onClose();
    if (type === 'quotation') {
      router.push(`/dashboard/clients/${clientId}/quotations/${id}`);
    } else {
      router.push(`/dashboard/clients/${clientId}/contracts/${id}`);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
          <div className="bg-[#1e1b4b] p-8 text-white text-start flex justify-between items-center shrink-0">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl border-2 border-primary/20">
                   {type === 'quotation' ? <FileText className="h-6 w-6" /> : <Gavel className="h-6 w-6" />}
                </div>
                <div>
                   <DialogTitle className="text-xl font-black font-headline">
                      {type === 'quotation' ? (isRtl ? 'عروض الأسعار والمناقصات' : 'Quotations & Tenders') : (isRtl ? 'العقود الرسمية والمالية' : 'Formal Contracts')}
                   </DialogTitle>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Transaction: {transaction.transactionNumber}</p>
                </div>
             </div>
             <Badge variant="secondary" className="bg-white/10 text-white border-0 font-black h-8 px-4 rounded-xl">{clientName}</Badge>
          </div>

          <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10 max-h-[70vh] overflow-y-auto scrollbar-hide text-start">
             
             <div className="space-y-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-3 flex items-center gap-2">
                   <Plus className="h-4 w-4 text-primary" /> {isRtl ? 'إصدار مستند جديد من القالب' : 'Issue New Document'}
                </h3>
                
                <div className="p-8 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 space-y-6 shadow-inner">
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اختر القالب المعتمد' : 'Select Template'}</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                         <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-bold text-sm">
                            <SelectValue placeholder="..." />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-0 shadow-2xl">
                            {templates?.map(temp => (
                              <SelectItem key={temp.id} value={temp.id!} className="font-bold py-3">{temp.name}</SelectItem>
                            ))}
                         </SelectContent>
                      </Select>
                   </div>
                   
                   <Button 
                     onClick={handleCreate} 
                     disabled={loading || !selectedTemplateId}
                     className="w-full h-12 rounded-xl bg-[#1e1b4b] text-white font-black shadow-xl hover:scale-105 transition-all gap-2"
                   >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5 text-primary" />}
                      {isRtl ? 'توليد ومراجعة المسودة' : 'Generate & Review'}
                   </Button>
                </div>
             </div>

             <div className="space-y-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-3 flex items-center gap-2">
                   <History className="h-4 w-4 text-primary" /> {isRtl ? 'الأرشيف المستندي للمعاملة' : 'Transaction Doc Archive'}
                </h3>

                <div className="space-y-3">
                   {docsLoading ? (
                     <div className="py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/30" /></div>
                   ) : documents?.length === 0 ? (
                     <div className="py-20 text-center border-4 border-dashed rounded-[1.5rem] bg-slate-50/50 text-slate-300 font-bold italic">
                        {isRtl ? 'لا يوجد مستندات حالياً.' : 'No documents archived.'}
                     </div>
                   ) : (
                     documents?.map((doc: any) => (
                       <Card key={doc.id} className="border-0 shadow-md rounded-xl bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/20 transition-all">
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                             <div className="flex items-center gap-3 text-start">
                                <div className={cn(
                                  "h-10 w-10 rounded-lg flex items-center justify-center shadow-inner",
                                  doc.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                                )}>
                                   {type === 'quotation' ? <FileText className="h-5 w-5" /> : <Gavel className="h-5 w-5" />}
                                </div>
                                <div className="text-start">
                                   <h5 className="font-black text-[11px] text-slate-800 leading-tight">{doc.name}</h5>
                                   <p className="text-[8px] font-mono text-slate-400 mt-0.5 uppercase">VAL: {doc.totalAmount?.toLocaleString()} KWD</p>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-1.5">
                                {type === 'contract' && doc.status !== 'paid' && isAdmin && (
                                  <Button 
                                    onClick={() => handleMarkAsPaid(doc.id)}
                                    disabled={loading}
                                    variant="outline" 
                                    className="h-8 px-2 rounded-lg bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[8px] gap-1 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                  >
                                     <Wallet className="h-3 w-3" /> {isRtl ? 'دفع' : 'Paid'}
                                  </Button>
                                )}
                                <Button 
                                  onClick={() => viewDoc(doc.id)}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white transition-all"
                                >
                                   <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                {isAdmin && (
                                  <Button 
                                    onClick={() => setDeletingId(doc.id)}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg bg-slate-50 text-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                  >
                                     <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                             </div>
                          </CardContent>
                       </Card>
                     ))
                   )}
                </div>
             </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
             <Button variant="outline" onClick={onClose} className="rounded-xl font-bold h-11 px-8 bg-white border-2">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-20 h-20 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-8 w-8" />
             </div>
             <AlertDialogTitle className="text-start font-black text-2xl font-headline text-slate-900 leading-tight">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-base leading-relaxed">
                {isRtl 
                  ? 'هل أنت متأكد؟ سيتم حذف هذا المستند نهائياً من أرشيف المعاملة. لا يمكن التراجع عن هذا الإجراء.' 
                  : 'Are you sure? This document will be permanently removed from the transaction archive.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-3 flex flex-row items-center justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-xl font-bold border-2 bg-white text-slate-600" onClick={() => setDeletingId(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="flex-[2] h-12 rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
               {isRtl ? 'نعم، احذف المستند' : 'Confirm Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
