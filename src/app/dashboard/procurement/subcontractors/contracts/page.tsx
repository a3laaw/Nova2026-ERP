
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, Loader2, ArrowRight, 
  Handshake, ShieldCheck, 
  Building2, ArrowUpRight, CheckCircle2, Clock,
  Landmark, Sparkles, ChevronDown, Check, X,
  Workflow, Hash, Info, Target, FileText,
  AlertTriangle
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  
  // States for search filters
  const [subSearch, setSubSearch] = useState("");
  const [transSearch, setTransSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");

  const [formData, setFormData] = useState({
    subcontractorId: '',
    subcontractorName: '',
    transactionId: '',
    transactionNumber: '',
    transactionName: '',
    templateId: '',
    templateName: ''
  });

  // Queries
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
    return (subcontractors || []).filter(s => 
      s.name.toLowerCase().includes(subSearch.toLowerCase()) || 
      (s.trade && s.trade.toLowerCase().includes(subSearch.toLowerCase()))
    );
  }, [subcontractors, subSearch]);

  const filteredTrans = useMemo(() => {
    return (transactions || []).filter(t => 
      t.subServiceName.toLowerCase().includes(transSearch.toLowerCase()) || 
      t.transactionNumber.toLowerCase().includes(transSearch.toLowerCase())
    );
  }, [transactions, transSearch]);

  const filteredTemps = useMemo(() => {
    return (templates || []).filter(t => 
      t.name.toLowerCase().includes(tempSearch.toLowerCase()) || 
      (t.trade && t.trade.toLowerCase().includes(tempSearch.toLowerCase()))
    );
  }, [templates, tempSearch]);

  const filteredContracts = (contracts || []).filter(c => 
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

      toast({ title: tSafe('inline.provisioning.success', 'تم التأسيس بنجاح', 'Provisioning Success') });
      setIsAdding(false);
      router.push(`/dashboard/procurement/subcontractors/contracts/${docId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (isAdding) {
    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-start" dir={dir}>
        <header className="flex justify-between items-center gap-4 border-b border-slate-100 pb-6">
           <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setIsAdding(false)} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border-2 text-slate-400 hover:text-primary transition-all">
                <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
              </Button>
              <div className="text-start space-y-1">
                 <h1 className="text-3xl font-black font-headline text-slate-900">{tSafe('subcon.contracts.new', 'تأسيس اتفاقية باطن جديدة', 'New SubCon Award')}</h1>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tSafe('inline.sovereign.provisioning', 'نظام التأسيس السيادي الموحد', 'Sovereign Provisioning System')}</p>
              </div>
           </div>
           <Button 
             onClick={handleIssueContract} 
             disabled={loading || !formData.subcontractorId || !formData.transactionId || !formData.templateId}
             className="h-14 px-12 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700"
           >
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
              {tSafe('subcon.contracts.issueNow', 'إصدار الاتفاقية الآن', 'Issue Award Now')}
           </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Section 1: Subcontractor Selection */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-primary/20 transition-all">
              <CardHeader className="bg-primary/5 p-8 border-b text-start">
                 <CardTitle className="text-base font-black flex items-center gap-3">
                    <Handshake className="h-5 w-5 text-primary" />
                    {tSafe('subcon.form.vendor', 'اختيار المقاول المنفذ', 'Choose Subcontractor')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="p-6 bg-slate-50 border-b">
                    <div className="relative">
                       <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                       <Input 
                         placeholder={tSafe('common.search', 'بحث باسم المقاول...', 'Search contractor...')}
                         className="h-12 ps-12 rounded-xl border-2 font-bold focus:bg-white transition-all shadow-inner"
                         value={subSearch}
                         onChange={e => setSubSearch(e.target.value)}
                       />
                    </div>
                 </div>
                 <ScrollArea className="h-[400px]">
                    <div className="p-3 space-y-1.5">
                       {filteredSubs.map(s => (
                         <div 
                           key={s.id} 
                           onClick={() => setFormData({...formData, subcontractorId: s.id, subcontractorName: s.name})}
                           className={cn(
                             "p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between border-2",
                             formData.subcontractorId === s.id ? "bg-primary border-primary text-white shadow-xl shadow-primary/20" : "bg-white border-transparent hover:border-slate-100 hover:bg-slate-50"
                           )}
                         >
                            <div className="text-start">
                               <p className="font-black text-sm">{s.name}</p>
                               <p className={cn("text-[9px] font-black uppercase tracking-tighter mt-1", formData.subcontractorId === s.id ? "text-white/70" : "text-slate-400")}>{s.trade}</p>
                            </div>
                            {formData.subcontractorId === s.id && <CheckCircle2 className="h-5 w-5 text-white" />}
                         </div>
                       ))}
                    </div>
                 </ScrollArea>
              </CardContent>
           </Card>

           {/* Section 2: Project Selection */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-primary/20 transition-all">
              <CardHeader className="bg-slate-50 p-8 border-b text-start">
                 <CardTitle className="text-base font-black flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    {tSafe('subcon.form.project', 'المشروع المستهدف', 'Target Project')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="p-6 bg-slate-50 border-b">
                    <div className="relative">
                       <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                       <Input 
                         placeholder={tSafe('common.search', 'بحث باسم المشروع...', 'Search project...')}
                         className="h-12 ps-12 rounded-xl border-2 font-bold focus:bg-white transition-all shadow-inner"
                         value={transSearch}
                         onChange={e => setTransSearch(e.target.value)}
                       />
                    </div>
                 </div>
                 <ScrollArea className="h-[400px]">
                    <div className="p-3 space-y-1.5">
                       {filteredTrans.map(t_item => (
                         <div 
                           key={t_item.id} 
                           onClick={() => setFormData({...formData, transactionId: t_item.id, transactionNumber: t_item.transactionNumber, transactionName: t_item.subServiceName})}
                           className={cn(
                             "p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between border-2",
                             formData.transactionId === t_item.id ? "bg-primary border-primary text-white shadow-xl shadow-primary/20" : "bg-white border-transparent hover:border-slate-100 hover:bg-slate-50"
                           )}
                         >
                            <div className="text-start min-w-0">
                               <p className="font-black text-sm truncate">{t_item.subServiceName}</p>
                               <div className="flex items-center gap-2 mt-1">
                                  <Badge className={cn("text-[8px] font-black h-4 px-2", formData.transactionId === t_item.id ? "bg-white text-primary" : "bg-slate-900 text-white")} dir="ltr">#{t_item.transactionNumber}</Badge>
                                  <span className={cn("text-[9px] font-bold truncate", formData.transactionId === t_item.id ? "text-white/70" : "text-slate-400")}>{t_item.clientName}</span>
                               </div>
                            </div>
                            {formData.transactionId === t_item.id && <CheckCircle2 className="h-5 w-5 text-white" />}
                         </div>
                       ))}
                    </div>
                 </ScrollArea>
              </CardContent>
           </Card>

           {/* Section 3: Template Selection */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-primary/20 transition-all">
              <CardHeader className="bg-slate-50 p-8 border-b text-start">
                 <CardTitle className="text-base font-black flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    {tSafe('subcon.form.template', 'القالب القانوني المعتمد', 'Legal Template')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="p-6 bg-slate-50 border-b">
                    <div className="relative">
                       <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                       <Input 
                         placeholder={tSafe('common.search', 'بحث في مكتبة القوالب...', 'Search templates...')}
                         className="h-12 ps-12 rounded-xl border-2 font-bold focus:bg-white transition-all shadow-inner"
                         value={tempSearch}
                         onChange={e => setTempSearch(e.target.value)}
                       />
                    </div>
                 </div>
                 <ScrollArea className="h-[400px]">
                    <div className="p-3 space-y-1.5">
                       {filteredTemps.map(temp => (
                         <div 
                           key={temp.id} 
                           onClick={() => setFormData({...formData, templateId: temp.id, templateName: temp.name})}
                           className={cn(
                             "p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between border-2",
                             formData.templateId === temp.id ? "bg-primary border-primary text-white shadow-xl shadow-primary/20" : "bg-white border-transparent hover:border-slate-100 hover:bg-slate-50"
                           )}
                         >
                            <div className="text-start">
                               <p className="font-black text-sm">{temp.name}</p>
                               <div className="flex items-center gap-2 mt-1">
                                  <Badge className={cn("text-[7px] font-black h-4 px-2 uppercase", formData.templateId === temp.id ? "bg-white text-primary" : "bg-slate-100 text-slate-500")}>{temp.trade}</Badge>
                               </div>
                            </div>
                            {formData.templateId === temp.id && <CheckCircle2 className="h-5 w-5 text-white" />}
                         </div>
                       ))}
                    </div>
                 </ScrollArea>
              </CardContent>
           </Card>
        </div>

        <div className="p-10 bg-white border-2 border-primary/10 rounded-[3rem] shadow-2xl flex items-start gap-8 text-start relative overflow-hidden">
           <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-40 w-40 text-primary" /></div>
           <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <Info className="h-8 w-8" />
           </div>
           <div className="space-y-2 relative z-10">
              <h5 className="font-black text-slate-900 text-lg uppercase tracking-widest">{tSafe('inline.ready.to.award', 'جاهز لإصدار أمر الإسناد', 'Ready to Award')}</h5>
              <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-3xl italic">
                 {tSafe('subcon.provisioning.hint', 'تنبيه: عند الضغط على "إصدار"، سيقوم النظام آلياً بدمج بيانات المقاول مع شروط القالب المختار وفتح مسودة عقد حي مرتبطة بالمشروع. يمكنك بعدها تعديل المبالغ والتوقيتات بحرية.', 'Clicking issue will merge contractor data with template terms and open a live draft linked to the project.')}
              </p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {tSafe('subcon.authorizedPortal', 'بوابة العقود المعتمدة', 'Authorized Contracts Portal')}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{tSafe('subcon.contracts.title', 'عقود مقاولي الباطن', 'SubCon Contracts')}</h1>
           <p className="text-muted-foreground text-xs font-bold opacity-70 italic text-start">
              {tSafe('subcon.contracts.desc', 'إدارة وتتبع كافة الاتفاقيات المبرمة مع القوى العاملة الخارجية والارتباطات المالية للمشاريع.', 'Manage and track all external labor agreements and project financial links.')}
           </p>
        </div>

        <Button 
          onClick={() => setIsAdding(true)}
          className="h-11 px-8 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-4 border-orange-700"
        >
          <Plus className="h-4 w-4" />
          {tSafe('subcon.contracts.issue', 'إصدار اتفاقية باطن', 'Issue SubCon Award')}
        </Button>
      </header>

      <Card className="rounded-[2rem] border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6 text-start">
           <div className="relative w-full max-w-md">
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
                <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase tracking-widest">{tSafe('common.name', 'الاسم', 'Name')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{tSafe('common.vendor', 'المقاول', 'Vendor')}</TableHead>
                <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{tSafe('common.amount', 'المبلغ', 'Amount')}</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('common.status', 'الحالة', 'Status')}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredContracts.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-black italic">{tSafe('subcon.contracts.empty', 'لا توجد عقود باطن مسجلة حالياً.', 'No SubCon contracts found.')}</TableCell></TableRow>
              ) : filteredContracts.map((contract) => (
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
                         <ArrowUpRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                      </Button>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

