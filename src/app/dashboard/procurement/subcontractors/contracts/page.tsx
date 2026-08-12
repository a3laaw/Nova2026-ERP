'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, Loader2, ArrowRight, 
  Handshake, ShieldCheck, 
  Building2, ArrowUpRight, CheckCircle2, Clock,
  Landmark, Sparkles, ChevronDown, Check, X,
  Workflow, Hash, FileText, HardHat, AlertCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function SubConContractsListPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Search states for pickers
  const [subSearch, setSubSearch] = useState("");
  const [transSearch, setTransSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  
  const [openSubPicker, setOpenSubPicker] = useState(false);
  const [openTransPicker, setOpenTransPicker] = useState(false);
  const [openTempPicker, setOpenTempPicker] = useState(false);

  const [formData, setFormData] = useState({
    subcontractorId: '',
    subcontractorName: '',
    transactionId: '',
    transactionNumber: '',
    transactionName: '',
    templateId: '',
    templateName: ''
  });

  const contractsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subconContracts(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const subsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subcontractors(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const transQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, 
  [db, companyId]);

  const templatesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subconContractTemplates(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const { data: contracts, loading: contractsLoading } = useCollection<any>(contractsQuery);
  const { data: subcontractors } = useCollection<any>(subsQuery);
  const { data: transactions } = useCollection<any>(transQuery);
  const { data: templates } = useCollection<any>(templatesQuery);

  const filteredSubs = useMemo(() => {
    return (subcontractors || []).filter(s => s.name.toLowerCase().includes(subSearch.toLowerCase()) || s.trade.toLowerCase().includes(subSearch.toLowerCase()));
  }, [subcontractors, subSearch]);

  const filteredTrans = useMemo(() => {
    return (transactions || []).filter(t => t.subServiceName.toLowerCase().includes(transSearch.toLowerCase()) || t.transactionNumber.toLowerCase().includes(transSearch.toLowerCase()));
  }, [transactions, transSearch]);

  const filteredTemps = useMemo(() => {
    return (templates || []).filter(t => t.name.toLowerCase().includes(tempSearch.toLowerCase()) || t.trade.toLowerCase().includes(tempSearch.toLowerCase()));
  }, [templates, tempSearch]);

  const filtered = (contracts || []).filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.subcontractorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleIssueContract = async () => {
    if (!db || !companyId || !user || !formData.subcontractorId || !formData.transactionId || !formData.templateId) return;
    
    setLoading(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const docId = await service.instantiateSubConContractFromTemplate(formData.templateId, {
        transactionId: formData.transactionId,
        subcontractorId: formData.subcontractorId,
        subcontractorName: formData.subcontractorName,
        name: `${formData.templateName} - ${formData.subcontractorName}`,
        projectTitle: formData.transactionName
      }, user.uid);

      toast({ title: tSafe('common.saved', 'تم الحفظ بنجاح', 'Saved Successfully') });
      setIsIssueOpen(false);
      router.push(`/dashboard/procurement/subcontractors/contracts/${docId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {tSafe('subcon.authorizedPortal', 'بوابة العقود المعتمدة', 'Authorized Contracts Portal')}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{tSafe('subcon.contracts.title', 'عقود مقاولي الباطن', 'SubCon Contracts')}</h1>
           <p className="text-muted-foreground text-xs font-bold opacity-70 italic text-start">
              {tSafe('subcon.contracts.desc', 'إدارة عقود تنفيذ الباطن والارتباطات المالية للمشاريع.', 'Manage subcontractor awards and project financial links.')}
           </p>
        </div>

        <Button 
          onClick={() => setIsIssueOpen(true)}
          className="h-11 px-8 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-4 border-orange-700"
        >
          <Plus className="h-4 w-4" />
          {tSafe('subcon.contracts.issue', 'إصدار اتفاقية باطن', 'Issue SubCon Award')}
        </Button>
      </header>

      <Card className="rounded-[2rem] border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6">
           <div className="relative w-full max-w-md text-start">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={tSafe('subcon.contracts.search', 'بحث في العقود المبرمة...', 'Search executed contracts...')} 
                className="ps-12 rounded-2xl h-11 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase tracking-widest">{tSafe('name', 'الاسم', 'Name')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{tSafe('vendor', 'المقاول / المورد', 'Vendor')}</TableHead>
                <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{tSafe('amount', 'المبلغ', 'Amount')}</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('status', 'الحالة', 'Status')}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-black italic">{tSafe('subcon.contracts.empty', 'لا توجد عقود باطن مسجلة حالياً.', 'No SubCon contracts found.')}</TableCell></TableRow>
              ) : filtered.map((contract) => (
                <TableRow key={contract.id} className="hover:bg-primary/[0.02] transition-colors group border-b-slate-100 cursor-pointer" onClick={() => router.push(`/dashboard/procurement/subcontractors/contracts/${contract.id}`)}>
                   <TableCell className="py-6 ps-10 text-start">
                      <div className="flex items-center gap-4 text-start">
                         <div className="h-11 w-11 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary border-2 border-primary/5">
                            <Handshake className="h-6 w-6" />
                         </div>
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm leading-tight">{contract.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{contract.projectTitle}</p>
                         </div>
                      </div>
                   </TableCell>
                   <TableCell className="text-start">
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-600">
                         <Building2 className="h-3 w-3 opacity-30" /> {contract.subcontractorName}
                      </div>
                   </TableCell>
                   <TableCell className="text-end">
                      <span className="font-mono font-black text-emerald-600">
                         {contract.totalAmount?.toLocaleString()} <span className="text-[10px] opacity-40">KWD</span>
                      </span>
                   </TableCell>
                   <TableCell className="text-center">
                      <Badge className={cn(
                        "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[8px]",
                        contract.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                      )}>
                         {contract.status}
                      </Badge>
                   </TableCell>
                   <TableCell className="pe-10 text-end">
                      <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-300 group-hover:text-primary transition-all">
                         <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                      </Button>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isIssueOpen} onOpenChange={(v) => { if(!v) setIsIssueOpen(false); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-xl text-start" dir={dir}>
            <div className="bg-primary p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <Handshake className="h-10 w-10 text-white" />
                  {tSafe('subcon.contracts.new', 'تعاقد جديد مع مقاول باطن', 'New SubCon Award')}
               </DialogTitle>
            </div>

            <div className="p-10 space-y-6 text-start bg-white">
               
               {/* 1. Subcontractor Custom Dropdown */}
               <div className="space-y-2 text-start relative">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{tSafe('subcon.form.vendor', 'المقاول / المورد', 'Subcontractor Vendor')}</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 shadow-inner justify-between px-6 hover:bg-slate-100 transition-colors"
                    onClick={() => setOpenSubPicker(!openSubPicker)}
                  >
                     <span className="truncate flex items-center gap-2">
                        {formData.subcontractorName ? <HardHat className="h-5 w-5 text-primary" /> : null}
                        {formData.subcontractorName || tSafe('subcon.selectSub', 'اختيار المقاول...', 'Choose staff...')}
                     </span>
                     <ChevronDown className="h-5 w-5 opacity-40" />
                  </Button>
                  
                  {openSubPicker && (
                     <div className="absolute z-[9999] mt-2 w-full bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                           <div className="relative">
                              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input 
                                placeholder={tSafe('common.search', 'بحث...', 'Search...')}
                                value={subSearch}
                                onChange={e => setSubSearch(e.target.value)}
                                autoFocus
                                className="h-10 ps-10 rounded-xl border-2 font-bold focus:border-primary"
                              />
                           </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                           {filteredSubs.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                                 <AlertCircle className="h-5 w-5" />
                                 {tSafe('common.noresults', 'لا توجد نتائج', 'No results found')}
                              </div>
                           ) : filteredSubs.map(s => (
                             <div 
                               key={s.id} 
                               onClick={() => { setFormData({...formData, subcontractorId: s.id, subcontractorName: s.name}); setOpenSubPicker(false); setSubSearch(""); }}
                               className={cn(
                                 "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                 formData.subcontractorId === s.id ? "bg-primary/5 text-primary border-primary/20" : "hover:bg-slate-50"
                               )}
                             >
                                <div className="flex items-center gap-3 text-start">
                                   <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <HardHat className="h-4 w-4 text-primary" />
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="font-black text-sm">{s.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{s.trade}</span>
                                   </div>
                                </div>
                                {formData.subcontractorId === s.id && <Check className="h-4 w-4" />}
                             </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               {/* 2. Target Project Custom Dropdown */}
               <div className="space-y-2 text-start relative">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{tSafe('subcon.form.project', 'المشروع المستهدف', 'Target Project')}</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 shadow-inner justify-between px-6 hover:bg-slate-100 transition-colors"
                    onClick={() => setOpenTransPicker(!openTransPicker)}
                  >
                     <span className="truncate flex items-center gap-2">
                        {formData.transactionName ? <Building2 className="h-5 w-5 text-primary" /> : null}
                        {formData.transactionName || tSafe('subcon.selectProject', 'اختيار المشروع...', 'Choose Project...')}
                     </span>
                     <ChevronDown className="h-5 w-5 opacity-40" />
                  </Button>
                  
                  {openTransPicker && (
                     <div className="absolute z-[9999] mt-2 w-full bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                           <div className="relative">
                              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input 
                                placeholder={tSafe('common.search', 'بحث...', 'Search...')}
                                value={transSearch}
                                onChange={e => setTransSearch(e.target.value)}
                                autoFocus
                                className="h-10 ps-10 rounded-xl border-2 font-bold focus:border-primary"
                              />
                           </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                           {filteredTrans.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                                 <AlertCircle className="h-5 w-5" />
                                 {tSafe('common.noresults', 'لا توجد نتائج', 'No results found')}
                              </div>
                           ) : filteredTrans.map(t_item => (
                             <div 
                               key={t_item.id} 
                               onClick={() => { setFormData({...formData, transactionId: t_item.id, transactionNumber: t_item.transactionNumber, transactionName: t_item.subServiceName}); setOpenTransPicker(false); setTransSearch(""); }}
                               className={cn(
                                 "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                 formData.transactionId === t_item.id ? "bg-primary/5 text-primary border-primary/20" : "hover:bg-slate-50"
                               )}
                             >
                                <div className="flex items-center gap-3 text-start min-w-0">
                                   <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <Building2 className="h-4 w-4 text-primary" />
                                   </div>
                                   <div className="flex flex-col min-w-0">
                                      <span className="font-black text-sm text-slate-800 truncate">{t_item.subServiceName}</span>
                                      <div className="flex items-center gap-2 mt-1">
                                         <Badge variant="outline" className="h-4 px-2 bg-white text-[8px] font-mono font-black uppercase" dir="ltr">#{t_item.transactionNumber}</Badge>
                                         <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{t_item.clientName}</span>
                                      </div>
                                   </div>
                                </div>
                                {formData.transactionId === t_item.id && <Check className="h-4 w-4" />}
                             </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               {/* 3. Legal Template Custom Dropdown */}
               <div className="space-y-2 text-start relative">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{tSafe('subcon.form.template', 'القالب المرجعي', 'Legal Template')}</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 shadow-inner justify-between px-6 hover:bg-slate-100 transition-colors"
                    onClick={() => setOpenTempPicker(!openTempPicker)}
                  >
                     <span className="truncate flex items-center gap-2">
                        {formData.templateName ? <FileText className="h-5 w-5 text-primary" /> : null}
                        {formData.templateName || tSafe('subcon.selectTemplate', 'اختيار القالب المرجعي...', 'Choose Template...')}
                     </span>
                     <ChevronDown className="h-5 w-5 opacity-40" />
                  </Button>
                  
                  {openTempPicker && (
                     <div className="absolute z-[9999] mt-2 w-full bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                           <div className="relative">
                              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input 
                                placeholder={tSafe('common.search', 'بحث...', 'Search...')}
                                value={tempSearch}
                                onChange={e => setTempSearch(e.target.value)}
                                autoFocus
                                className="h-10 ps-10 rounded-xl border-2 font-bold focus:border-primary"
                              />
                           </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                           {filteredTemps.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                                 <AlertCircle className="h-5 w-5" />
                                 {tSafe('common.noresults', 'لا توجد نتائج', 'No results found')}
                              </div>
                           ) : filteredTemps.map(temp => (
                             <div 
                               key={temp.id} 
                               onClick={() => { setFormData({...formData, templateId: temp.id, templateName: temp.name}); setOpenTempPicker(false); setTempSearch(""); }}
                               className={cn(
                                 "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                 formData.templateId === temp.id ? "bg-primary/5 text-primary border-primary/20" : "hover:bg-slate-50"
                               )}
                             >
                                <div className="flex items-center gap-3 text-start">
                                   <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <FileText className="h-4 w-4 text-primary" />
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="font-black text-sm">{temp.name}</span>
                                      <div className="flex items-center gap-2 mt-1">
                                         <Badge className="bg-amber-100 text-amber-600 border-0 h-4 text-[7px] font-black uppercase tracking-tighter">{temp.trade}</Badge>
                                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">REF: {temp.code}</span>
                                      </div>
                                   </div>
                                </div>
                                {formData.templateId === temp.id && <Check className="h-4 w-4" />}
                             </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               <Button 
                  onClick={handleIssueContract} 
                  disabled={loading || !formData.subcontractorId || !formData.transactionId || !formData.templateId}
                  className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700 mt-6"
               >
                  {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
                  {tSafe('subcon.contracts.issueNow', 'إصدار الاتفاقية الآن', 'Issue Award Now')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}