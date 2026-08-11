
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
  const [docTypeToCreate, setDocTypeToCreate] = useState<'quotation' | 'contract' | null>(null);
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
    const path = docTypeToCreate === 'quotation' ? paths.quotationTemplates(companyId) : paths.contractTemplates(companyId);
    return query(collection(db, path), where('isActive', '==', true), where('activityTypeId', '==', transaction.activityTypeId));
  }, [db, companyId, docTypeToCreate, transaction?.activityTypeId]);
  const { data: templates } = useCollection<any>(templatesQuery);

  const handleCreate = async () => {
    if (!db || !companyId || !docTypeToCreate || !selectedTemplateId) return;
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const docPrefix = docTypeToCreate === 'quotation' ? tSafe('inline.quotation', 'عرض سعر', 'Quotation') : tSafe('inline.contract', 'عقد', 'Contract');
      const name = `${docPrefix} - ${transaction.subServiceName}`;
      const payload = { transactionId: transaction.id, clientId, clientName, name };
      
      let docId = "";
      if (docTypeToCreate === 'quotation') docId = await service.instantiateQuotationFromTemplate(selectedTemplateId, payload, 'SYSTEM', 'Admin');
      else docId = await service.instantiateContractFromTemplate(selectedTemplateId, payload, 'SYSTEM', 'Admin');

      toast({ title: tSafe('inline.draft.ready', 'تم تجهيز المسودة', 'Draft Ready') });
      setDocTypeToCreate(null);
      router.push(`/dashboard/clients/${clientId}/${docTypeToCreate === 'quotation' ? 'quotations' : 'contracts'}/${docId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally { setLoading(false); }
  };

  const DocList = ({ title, data, type, icon: Icon, colorClass, bgClass, showAdd = false }: any) => (
    <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
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
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 group cursor-pointer" onClick={() => router.push(`/dashboard/clients/${clientId}/${type === 'quotation' ? 'quotations' : 'contracts'}/${item.id}`)}>
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
                          <Button variant="outline" size="icon" className="rounded-xl h-9 w-9 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-sm transition-all opacity-0 group-hover:opacity-100">
                             <ArrowUpRight className="h-5 w-5" />
                          </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
               <DocList title={isRtl ? 'عروض الأسعار' : 'Quotations'} data={quotes} type="quotation" icon={FileText} colorClass="text-blue-600" bgClass="bg-blue-50" showAdd />
               <DocList title={isRtl ? 'العقود الرسمية' : 'Formal Contracts'} data={contracts} type="contract" icon={Gavel} colorClass="text-indigo-600" bgClass="bg-indigo-50" showAdd />
            </div>
            <DocList title={isRtl ? 'مستخلصات المالك (IPCs)' : 'Owner Progress Invoices'} data={ownerIpcs} type="ipc" icon={Receipt} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
         </TabsContent>

         <TabsContent value="subcon" className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="p-10 bg-white border-2 border-primary/10 rounded-[3rem] text-slate-900 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-5"><Handshake className="h-40 w-40 text-primary" /></div>
               <div className="text-start relative z-10 space-y-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{isRtl ? 'إجمالي مستحقات مقاولي الباطن' : 'Total Subcontractor Payables'}</p>
                  <h3 className="text-5xl font-black font-headline text-slate-900">0 <span className="text-sm font-bold opacity-40">KWD</span></h3>
               </div>
               <div className="bg-slate-50 p-6 rounded-3xl border border-primary/10 relative z-10 text-start">
                  <p className="text-[11px] font-bold text-slate-500 max-w-xs leading-relaxed italic">{isRtl ? 'يتم توليد مسودات المستخلصات لمقاولي الباطن آلياً عند تسجيل إنجاز ميداني في البنود المسندة إليهم.' : 'Sub-IPC drafts are auto-generated when field progress is logged for assigned items.'}</p>
               </div>
            </div>
            <DocList title={isRtl ? 'مستخلصات مقاولي الباطن' : 'Sub-Con Progress Payments'} data={subIpcs} type="subipc" icon={Receipt} colorClass="text-amber-600" bgClass="bg-amber-50" />
         </TabsContent>
      </Tabs>
    </div>
  );
}
