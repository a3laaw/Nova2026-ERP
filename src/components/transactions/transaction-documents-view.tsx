
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
  Workflow, TrendingUp, Handshake,
  DollarSign
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  transaction: any;
  clientId: string;
  clientName: string;
  isAdmin: boolean;
  permissions: string[];
}

export function TransactionDocumentsView({ transaction, clientId, clientName, isAdmin, permissions }: Props) {
  const { lang, dir, t, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  
  const companyId = transaction?.companyId;
  const [activeSubTab, setActiveSubTab] = useState<'owner' | 'subcon'>('owner');

  const [loading, setLoading] = useState(false);
  const [docTypeToCreate, setDocTypeToCreate] = useState<'quotation' | 'contract' | 'subcon_contract' | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [deletingContext, setDeletingContext] = useState<{ id: string, type: string } | null>(null);

  const quotesQuery = useMemo(() => 
    companyId && db && transaction?.id ? query(collection(db, paths.quotations(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction?.id]);
  const { data: quotes, loading: quotesLoading } = useCollection<any>(quotesQuery);

  const contractsQuery = useMemo(() => 
    companyId && db && transaction?.id ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction?.id]);
  const { data: contracts } = useCollection<any>(contractsQuery);

  const subContractsQuery = useMemo(() => 
    companyId && db && transaction?.id ? query(collection(db, paths.subconContracts(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction?.id]);
  const { data: subContracts } = useCollection<any>(subContractsQuery);

  const ownerIpcsQuery = useMemo(() => 
    companyId && db && transaction?.id ? query(collection(db, paths.ipcs(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction?.id]);
  const { data: ownerIpcs } = useCollection<any>(ownerIpcsQuery);

  const subIpcsQuery = useMemo(() => 
    companyId && db && transaction?.id ? query(collection(db, paths.subIpcs(companyId)), where('transactionId', '==', transaction.id)) : null, 
  [db, companyId, transaction?.id]);
  const { data: subIpcs } = useCollection<any>(subIpcsQuery);

  const templatesQuery = useMemo(() => {
    if (!companyId || !db || !docTypeToCreate || !transaction?.activityTypeId) return null;
    let path = '';
    if (docTypeToCreate === 'quotation') path = paths.quotationTemplates(companyId);
    else if (docTypeToCreate === 'contract') path = paths.contractTemplates(companyId);
    else if (docTypeToCreate === 'subcon_contract') path = paths.subconContractTemplates(companyId);
    
    return query(collection(db, path), where('isActive', '==', true), where('activityTypeId', '==', transaction.activityTypeId));
  }, [db, companyId, docTypeToCreate, transaction?.activityTypeId]);
  const { data: rawTemplates } = useCollection<any>(templatesQuery);

  const templates = useMemo(() => {
    if (!rawTemplates) return [];
    return [...rawTemplates].sort((a, b) => {
       if (a.subServiceId === transaction?.subServiceId) return -1;
       if (b.subServiceId === transaction?.subServiceId) return 1;
       return 0;
    });
  }, [rawTemplates, transaction?.subServiceId]);

  const handleCreate = async () => {
    if (!db || !companyId || !docTypeToCreate || !selectedTemplateId || !transaction) return;
    setLoading(true);
    try {
      if (docTypeToCreate === 'subcon_contract') {
         router.push(`/dashboard/procurement/subcontractors/contracts/new?transactionId=${transaction.id}&templateId=${selectedTemplateId}`);
         setDocTypeToCreate(null);
         return;
      }

      const service = new DocumentService(db, companyId, permissions);
      const docPrefix = docTypeToCreate === 'quotation' ? tSafe('inline.quotation', 'عرض سعر', 'Quotation') : tSafe('inline.contract', 'عقد', 'Contract');
      const name = `${docPrefix} - ${transaction?.subServiceName || ''}`;
      const payload = { transactionId: transaction.id, clientId, clientName, name };
      
      let docId = "";
      if (docTypeToCreate === 'quotation') docId = await service.instantiateQuotationFromTemplate(selectedTemplateId, payload, 'SYSTEM', 'Admin');
      else docId = await service.instantiateContractFromTemplate(selectedTemplateId, payload, 'SYSTEM', 'Admin');

      toast({ title: tSafe('inline.draft.ready', 'تم تجهيز المسودة', 'Draft Ready') });
      setDocTypeToCreate(null);
      setSelectedTemplateId("");
      router.push(`/dashboard/clients/${clientId}/${docTypeToCreate === 'quotation' ? 'quotations' : 'contracts'}/${docId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!db || !companyId || !deletingContext) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      if (deletingContext.type === 'quotation') await service.deleteQuotation(deletingContext.id);
      else if (deletingContext.type === 'contract') await service.deleteContract(deletingContext.id);
      else if (deletingContext.type === 'subcon_contract') {
         await deleteDoc(doc(db, paths.subconContracts(companyId), deletingContext.id));
      }
      toast({ title: tSafe('inline.document.deleted', 'تم حذف المستند بنجاح', 'Document deleted') });
      setDeletingContext(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally { setLoading(false); }
  };

  const DocList = ({ title, data, type, icon: Icon, colorClass, bgClass, showAdd = false }: any) => (
    <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 flex-1">
       <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
          <div className="flex items-center gap-4 text-start">
             <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm border", bgClass, colorClass)}>
                <Icon className="h-6 w-6" />
             </div>
             <div>
                <CardTitle className="text-xl font-black font-headline text-start">{title}</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-start">{data?.length || 0} {tSafe('inline.records', 'سجلات', 'Records')}</p>
             </div>
          </div>
          {showAdd && (
            <Button onClick={() => setDocTypeToCreate(type)} variant="outline" className="h-10 rounded-xl font-black text-xs gap-2 border-2">
               <Plus className="h-4 w-4" /> {tSafe('inline.new', 'إصدار جديد', 'New')}
            </Button>
          )}
       </CardHeader>
       <CardContent className="p-0">
          <Table>
             <TableBody>
                {data?.length === 0 ? (
                  <TableRow><TableCell className="py-20 text-center text-slate-300 italic font-bold text-xs">{tSafe('inline.no.documents.yet', 'لا يوجد مستندات حالياً.', 'No documents yet.')}</TableCell></TableRow>
                ) : (
                  data?.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 group cursor-pointer" onClick={() => {
                       if (type === 'subcon_contract') router.push(`/dashboard/procurement/subcontractors/contracts/${item.id}`);
                       else router.push(`/dashboard/clients/${clientId}/${type === 'quotation' ? 'quotations' : 'contracts'}/${item.id}`);
                    }}>
                       <TableCell className="py-6 ps-10 text-start">
                          <div className="flex items-center gap-4">
                             <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black", (item.status === 'paid' || item.isPaid) ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary")}>
                                {item.ipcNumber ? 'IPC' : (item.code?.charAt(0) || '#')}
                             </div>
                             <div className="text-start">
                                <p className="font-black text-slate-800 text-sm leading-tight">{item.name || item.ipcNumber}</p>
                                <p className="text-[10px] font-mono font-bold text-emerald-600">{(item.totalAmount || item.netPayable || 0).toLocaleString()} KWD</p>
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
                          <div className="flex justify-end gap-2">
                             <Button variant="outline" size="icon" className="rounded-xl h-9 w-9 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-sm transition-all opacity-0 group-hover:opacity-100">
                                <ArrowUpRight className="h-5 w-5" />
                             </Button>
                             {isAdmin && (
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="rounded-xl h-9 w-9 text-rose-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                                 onClick={(e) => { e.stopPropagation(); setDeletingContext({ id: item.id, type }); }}
                               >
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
    <div className="space-y-10 animate-in fade-in duration-500">
      <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full">
         <div className="flex justify-center mb-8">
            <TabsList className="bg-white p-1.5 rounded-[1.5rem] h-16 gap-2 border-2 border-slate-100 shadow-xl">
               <TabsTrigger value="owner" className="rounded-2xl font-black text-xs px-10 h-full data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl gap-2 transition-all">
                  <UserCircle className="h-4 w-4" /> {isRtl ? 'مستخلصات المالك' : 'Owner Billing'}
               </TabsTrigger>
               <TabsTrigger value="subcon" className="rounded-2xl font-black text-xs px-10 h-full data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-xl gap-2 transition-all">
                  <Handshake className="h-4 w-4" /> {isRtl ? 'مستخلصات مقاولي الباطن' : 'Sub-Con Billing'}
               </TabsTrigger>
            </TabsList>
         </div>

         <TabsContent value="owner" className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row gap-8 items-start">
               <DocList title={isRtl ? 'عروض الأسعار' : 'Quotations'} data={quotes} type="quotation" icon={FileText} colorClass="text-blue-600" bgClass="bg-blue-50" showAdd />
               <DocList title={isRtl ? 'العقود الرسمية' : 'Formal Contracts'} data={contracts} type="contract" icon={Gavel} colorClass="text-indigo-600" bgClass="bg-indigo-50" showAdd />
            </div>
            <DocList title={isRtl ? 'مستخلصات المالك (IPCs)' : 'Owner Progress Invoices'} data={ownerIpcs} type="ipc" icon={Receipt} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
         </TabsContent>

         <TabsContent value="subcon" className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row gap-8 items-start">
               <DocList title={isRtl ? 'عقود مقاولي الباطن' : 'SubCon Contracts'} data={subContracts} type="subcon_contract" icon={Handshake} colorClass="text-amber-600" bgClass="bg-amber-50" showAdd />
               <DocList title={isRtl ? 'مستخلصات مقاولي الباطن' : 'Sub-Con Progress Payments'} data={subIpcs} type="subipc" icon={Receipt} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
            </div>
         </TabsContent>
      </Tabs>

      <Dialog open={!!docTypeToCreate} onOpenChange={(v) => !v && setDocTypeToCreate(null)}>
         <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-primary/5 p-10 text-slate-900 text-start border-b">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-4 text-slate-900">
                  {docTypeToCreate === 'quotation' ? <FileText className="h-8 w-8 text-primary" /> : <Gavel className="h-8 w-8 text-primary" />}
                  {docTypeToCreate === 'quotation' ? tSafe('inline.issue.quote', 'إصدار عرض سعر', 'Issue Quote') : (docTypeToCreate === 'contract' ? tSafe('inline.issue.contract', 'إصدار عقد جديد', 'Issue Contract') : tSafe('subcon.contracts.issue', 'إصدار اتفاقية باطن', 'Issue SubCon Award'))}
               </DialogTitle>
               <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-widest">{transaction?.activityTypeName}</p>
            </div>

            <div className="p-10 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                     {tSafe('inline.choose.template', 'اختر القالب المرجعي', 'Choose Template')}
                  </Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                     <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-white shadow-inner">
                        <SelectValue placeholder="..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                        {templates?.map(temp => (
                           <SelectItem key={temp.id} value={temp.id!} className="font-bold py-4 border-b last:border-0 border-slate-50">
                              <div className="flex flex-col text-start">
                                 <span className="text-slate-800">{temp.name}</span>
                                 {temp.subServiceId === transaction?.subServiceId && (
                                    <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[8px] font-black h-4 w-fit mt-1">{tSafe('inline.direct.matching.key', 'مطابقة مباشرة', 'DIRECT MATCH')}</Badge>
                                 )}
                              </div>
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-start gap-3">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-blue-700 leading-relaxed italic">{tSafe('inline.template_hint', 'يتم فلترة القوالب بناءً على نوع نشاط المعاملة لضمان دقة التعاقد.', 'Templates are filtered based on transaction activity type.')}</p>
               </div>

               <Button 
                  onClick={handleCreate} 
                  disabled={loading || !selectedTemplateId}
                  className="w-full h-20 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-4 border-b-8 border-orange-700 mt-4"
               >
                  {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                  {tSafe('inline.create.draft', 'تجهيز المسودة الآن', 'Create Draft Now')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingContext} onOpenChange={(v) => !v && setDeletingContext(null)}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <Trash2 className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('common.confirmDelete')}</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {tSafe('inline.are.you.sure..this.document.will.be.permanently.removed.from.the.archive', 'هل أنت متأكد؟ سيتم حذف المستند نهائياً من الأرشيف ولا يمكن التراجع.', 'Are you sure? This document will be permanently removed from the archive.')}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white" onClick={() => setDeletingContext(null)}>{t('common.cancel')}</AlertDialogCancel>
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
    </div>
  );
}
