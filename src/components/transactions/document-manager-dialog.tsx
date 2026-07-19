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
  ArrowRight, ShieldCheck, Clock,
  Wallet, Landmark, Receipt, 
  ChevronRight, Sparkles, CheckCircle2,
  ExternalLink,
  Info,
  History
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
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

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

      toast({ title: isRtl ? "تم إنشاء المستند بنجاح" : "Document Created" });
      setSelectedTemplateId("");
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
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
      router.push('/dashboard/procurement');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
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
              
              <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-slate-100 space-y-6 shadow-inner">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'اختر القالب المعتمد' : 'Select Template'}</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold">
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
                   className="w-full h-14 rounded-2xl bg-[#1e1b4b] text-white font-black shadow-xl hover:scale-105 transition-all gap-2"
                 >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5 text-primary" />}
                    {isRtl ? 'توليد المستند المربوط' : 'Generate Linked Doc'}
                 </Button>
              </div>

              <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-4">
                 <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-blue-700/70 font-bold leading-relaxed">
                    {isRtl 
                      ? 'بمجرد توليد المستند من القالب، سيتم ربطه تلقائياً بهذه المعاملة وتسجيله في سجل التاريخ للعميل.' 
                      : 'Generated documents are automatically linked to this transaction and logged in client history.'}
                 </p>
              </div>
           </div>

           <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-3 flex items-center gap-2">
                 <History className="h-4 w-4 text-primary" /> {isRtl ? 'الأرشيف المستندي للمعاملة' : 'Transaction Doc Archive'}
              </h3>

              <div className="space-y-4">
                 {docsLoading ? (
                   <div className="py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/30" /></div>
                 ) : documents?.length === 0 ? (
                   <div className="py-20 text-center border-4 border-dashed rounded-[2rem] bg-slate-50/50 text-slate-300 font-bold italic">
                      {isRtl ? 'لا يوجد مستندات حالياً.' : 'No documents archived.'}
                   </div>
                 ) : (
                   documents?.map((doc: any) => (
                     <Card key={doc.id} className="border-0 shadow-lg rounded-2xl bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/20 transition-all">
                        <CardContent className="p-5 flex items-center justify-between gap-4">
                           <div className="flex items-center gap-4 text-start">
                              <div className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center shadow-inner",
                                doc.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                              )}>
                                 {type === 'quotation' ? <FileText className="h-6 w-6" /> : <Gavel className="h-6 w-6" />}
                              </div>
                              <div className="text-start">
                                 <h5 className="font-black text-xs text-slate-800 leading-tight">{doc.name}</h5>
                                 <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase">VAL: {doc.totalAmount?.toLocaleString()} KWD</p>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-2">
                              {type === 'contract' && doc.status !== 'paid' && (
                                <Button 
                                  onClick={() => handleMarkAsPaid(doc.id)}
                                  disabled={loading}
                                  variant="outline" 
                                  className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[8px] gap-1 hover:bg-emerald-600 hover:text-white transition-all"
                                >
                                   <Wallet className="h-3 w-3" /> {isRtl ? 'تم الدفع' : 'Mark Paid'}
                                </Button>
                              )}
                              <Button 
                                onClick={() => viewDoc(doc.id)}
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white transition-all"
                              >
                                 <ExternalLink className="h-4 w-4" />
                              </Button>
                           </div>
                        </CardContent>
                     </Card>
                   ))
                 )}
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0">
           <Button variant="outline" onClick={onClose} className="rounded-xl font-black h-12 px-8">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
