'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, Gavel, Plus, Loader2, 
  ShieldCheck, Clock, Wallet, Receipt, 
  Sparkles, CheckCircle2, ExternalLink,
  Info, History, Trash2, AlertTriangle,
  X, Save, UserCircle, ArrowUpRight,
  Workflow
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Props {
  transaction: any;
  clientId: string;
  clientName: string;
  isAdmin: boolean;
  permissions: string[];
}

export function TransactionDocumentsView({ transaction, clientId, clientName, isAdmin, permissions }: Props) {
  const { lang, dir, t } = useLanguage();
  const { db } = { db: useFirestore() };
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = transaction.companyId;

  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [docTypeToCreate, setDocTypeToCreate] = useState<'quotation' | 'contract' | null>(null);
  const [deletingContext, setDeletingContext] = useState<{ id: string, type: 'quotation' | 'contract' } | null>(null);

  // جلب عروض الأسعار المرتبطة بالمعاملة
  const quotesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.quotations(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction.id]);
  const { data: quotes, loading: quotesLoading } = useCollection<any>(quotesQuery);

  // جلب العقود المرتبطة بالمعاملة
  const contractsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction.id]);
  const { data: contracts, loading: contractsLoading } = useCollection<any>(contractsQuery);

  // جلب القوالب المفلترة سيادياً حسب نوع النشاط لضمان عدم التداخل (المقاولات تظهر قوالب المقاولات فقط)
  const templatesQuery = useMemo(() => {
    if (!companyId || !db || !docTypeToCreate || !transaction.activityTypeId) return null;
    const path = docTypeToCreate === 'quotation' ? paths.quotationTemplates(companyId) : paths.contractTemplates(companyId);
    
    // الربط الذكي: البحث عن القوالب التي تنتمي لنفس النشاط (مقاولات/استشارات) ولها حالة نشطة
    return query(
      collection(db, path), 
      where('isActive', '==', true),
      where('activityTypeId', '==', transaction.activityTypeId)
    );
  }, [db, companyId, docTypeToCreate, transaction.activityTypeId]);
  
  const { data: rawTemplates } = useCollection<any>(templatesQuery);

  // فرز القوالب: إعطاء الأولوية للقوالب المرتبطة بنفس المسار الفني المباشر
  const templates = useMemo(() => {
    if (!rawTemplates) return [];
    return [...rawTemplates].sort((a, b) => {
       if (a.subServiceId === transaction.subServiceId) return -1;
       if (b.subServiceId === transaction.subServiceId) return 1;
       return 0;
    });
  }, [rawTemplates, transaction.subServiceId]);

  const handleCreate = async () => {
    if (!db || !companyId || !docTypeToCreate || !selectedTemplateId) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const name = `${docTypeToCreate === 'quotation' ? (isRtl ? 'عرض سعر' : 'Quotation') : (isRtl ? 'عقد' : 'Contract')} - ${transaction.subServiceName}`;
      const payload = { transactionId: transaction.id, clientId, clientName, name };
      
      let docId = "";
      if (docTypeToCreate === 'quotation') {
        docId = await service.instantiateQuotationFromTemplate(selectedTemplateId, payload, 'SYSTEM', 'Admin');
      } else {
        docId = await service.instantiateContractFromTemplate(selectedTemplateId, payload, 'SYSTEM', 'Admin');
      }

      toast({ title: isRtl ? "تم تجهيز المسودة" : "Draft Ready" });
      setDocTypeToCreate(null);
      setSelectedTemplateId("");
      
      router.push(`/dashboard/clients/${clientId}/${docTypeToCreate === 'quotation' ? 'quotations' : 'contracts'}/${docId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !companyId || !deletingContext) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      if (deletingContext.type === 'quotation') await service.deleteQuotation(deletingContext.id);
      else await service.deleteContract(deletingContext.id);
      toast({ title: isRtl ? "تم الحذف بنجاح" : "Deleted" });
      setDeletingContext(null);
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
      await updateDoc(docRef, { status: 'paid', isPaid: true, updatedAt: serverTimestamp() });
      toast({ title: isRtl ? "تم توثيق السداد" : "Payment Confirmed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const DocList = ({ title, data, type, icon: Icon, colorClass, bgClass }: any) => (
    <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
       <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
             <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm border", bgClass, colorClass)}>
                <Icon className="h-6 w-6" />
             </div>
             <div>
                <CardTitle className="text-xl font-black font-headline">{title}</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{data?.length || 0} {isRtl ? 'سجلات' : 'Records'}</p>
             </div>
          </div>
          <Button onClick={() => setDocTypeToCreate(type)} variant="outline" className="h-10 rounded-xl font-black text-xs gap-2 border-2">
             <Plus className="h-4 w-4" /> {isRtl ? 'إصدار جديد' : 'New'}
          </Button>
       </CardHeader>
       <CardContent className="p-0">
          <Table>
             <TableBody>
                {data?.length === 0 ? (
                  <TableRow><TableCell className="py-20 text-center text-slate-300 italic font-bold text-xs">{isRtl ? 'لا يوجد مستندات حالياً.' : 'No documents yet.'}</TableCell></TableRow>
                ) : (
                  data?.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 group">
                       <TableCell className="py-6 ps-10 text-start">
                          <div className="flex items-center gap-4">
                             <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black", (item.status === 'paid' || item.isPaid) ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary")}>
                                {item.code?.charAt(0) || '#'}
                             </div>
                             <div className="text-start">
                                <p className="font-black text-slate-800 text-sm leading-tight">{item.name}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-1">{(item.totalAmount || 0).toLocaleString()} KWD</p>
                             </div>
                          </div>
                       </TableCell>
                       <TableCell className="text-start">
                          <Badge className={cn(
                            "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px] gap-1",
                            (item.status === 'paid' || item.isPaid) ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                          )}>
                             {item.status}
                          </Badge>
                       </TableCell>
                       <TableCell className="pe-10 text-end">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             {type === 'contract' && !item.isPaid && isAdmin && (
                               <Button onClick={() => handleMarkAsPaid(item.id)} disabled={loading} variant="outline" className="h-9 px-4 rounded-xl bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[9px] gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                                  <Wallet className="h-4 w-4" /> {isRtl ? 'توثيق سداد' : 'Mark Paid'}
                               </Button>
                             )}
                             <Button onClick={() => router.push(`/dashboard/clients/${clientId}/${type === 'quotation' ? 'quotations' : 'contracts'}/${item.id}`)} variant="outline" size="icon" className="rounded-xl h-9 w-9 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-sm">
                                <ArrowUpRight className="h-5 w-5" />
                             </Button>
                             {isAdmin && (
                               <Button onClick={() => setDeletingContext({ id: item.id, type })} variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all">
                                  <Trash2 className="h-4 w-4" />
                               </Button>
                             )}
                          </div>
                       </TableCell>
                    </TableRow>
                  ))
                )}
             </TableBody>
          </Table>
       </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
         <DocList 
           title={isRtl ? 'عروض الأسعار والمناقصات' : 'Quotations'} 
           data={quotes} 
           type="quotation" 
           icon={FileText} 
           colorClass="text-blue-600" 
           bgClass="bg-blue-50" 
         />
         <DocList 
           title={isRtl ? 'العقود الرسمية والملاحق' : 'Formal Contracts'} 
           data={contracts} 
           type="contract" 
           icon={Gavel} 
           colorClass="text-indigo-600" 
           bgClass="bg-indigo-50" 
         />
      </div>

      <Dialog open={!!docTypeToCreate} onOpenChange={(v) => !v && setDocTypeToCreate(null)}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-[#1e1b4b] p-10 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                  {docTypeToCreate === 'quotation' ? (isRtl ? 'إصدار عرض سعر' : 'Issue Quote') : (isRtl ? 'إصدار عقد جديد' : 'Issue Contract')}
               </DialogTitle>
            </div>
            <div className="p-10 space-y-8 text-start bg-white">
               <div className="space-y-3">
                  <Label className="font-black text-xs uppercase text-slate-400 tracking-widest">
                     {isRtl ? `اختر القالب المرجعي (${transaction.activityTypeName})` : `Choose Template (${transaction.activityTypeName})`}
                  </Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                     <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg">
                        <SelectValue placeholder="..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        {templates?.map(t => (
                          <SelectItem key={t.id} value={t.id!} className="font-bold py-4">
                            <div className="flex flex-col text-start">
                               <span>{t.name}</span>
                               {t.subServiceId === transaction.subServiceId && (
                                  <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[7px] font-black h-4 w-fit mt-1">DIRECT MATCH</Badge>
                               )}
                            </div>
                          </SelectItem>
                        ))}
                        {templates.length === 0 && (
                           <div className="p-8 text-center opacity-40">
                              <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                              <p className="text-[10px] font-black uppercase">No Templates found for this Activity</p>
                           </div>
                        )}
                     </SelectContent>
                  </Select>
               </div>
               <Button onClick={handleCreate} disabled={loading || !selectedTemplateId} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 gap-3">
                  {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                  {isRtl ? 'تجهيز المسودة الآن' : 'Create Draft'}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingContext} onOpenChange={(v) => !v && setDeletingContext(null)}>
         <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <AlertTriangle className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{isRtl ? 'تأكيد حذف المستند' : 'Confirm Delete'}</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {isRtl ? 'هل أنت متأكد؟ سيتم حذف المستند نهائياً من الأرشيف ولا يمكن التراجع.' : 'Are you sure? This document will be permanently removed from the archive.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2">إلغاء</AlertDialogCancel>
               <AlertDialogAction onClick={handleDelete} disabled={loading} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف نهائياً' : 'Delete Now')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
