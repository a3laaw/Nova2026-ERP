'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, Loader2, ArrowRight, 
  Handshake, Trash2, Edit3, ShieldCheck, 
  FileText, History, DollarSign, Building2,
  Workflow, ArrowUpRight, CheckCircle2, Clock,
  Hammer, AlertTriangle
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function SubConContractsListPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    subcontractorId: '',
    transactionId: '',
    templateId: ''
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

  const filtered = (contracts || []).filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.subcontractorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleIssueContract = async () => {
    if (!db || !companyId || !user || !formData.subcontractorId || !formData.transactionId || !formData.templateId) return;
    
    setLoading(true);
    try {
      const sub = subcontractors?.find(s => s.id === formData.subcontractorId);
      const trans = transactions?.find(t => t.id === formData.transactionId);
      const temp = templates?.find(t => t.id === formData.templateId);
      
      const service = new DocumentService(db, companyId, permissions);
      const docId = await service.instantiateSubConContractFromTemplate(formData.templateId, {
        transactionId: formData.transactionId,
        subcontractorId: formData.subcontractorId,
        subcontractorName: sub?.name || '',
        name: `${temp?.name} - ${sub?.name}`,
        projectTitle: trans?.subServiceName || ''
      }, user.uid);

      toast({ title: t('common.saved') });
      router.push(`/dashboard/procurement/subcontractors/contracts/${docId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-6 text-start">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {t('hr.officialAuthorization')}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{t('subcon.contracts.title')}</h1>
           <p className="text-muted-foreground text-xs font-bold opacity-70 italic">
              {isRtl ? 'إدارة عقود تنفيذ الباطن والارتباطات المالية للمشاريع.' : 'Manage subcontractor awards and project financial links.'}
           </p>
        </div>

        <Button 
          onClick={() => setIsIssueOpen(true)}
          className="h-11 px-8 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-4 border-orange-700"
        >
          <Plus className="h-4 w-4" />
          {t('subcon.contracts.issue')}
        </Button>
      </header>

      <Card className="rounded-[2rem] border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5 text-start">
        <CardHeader className="bg-slate-50/50 border-b p-6">
           <div className="relative w-full max-w-md text-start">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={t('subcon.contracts.search')} 
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
                <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase tracking-widest">{t('common.name')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{t('common.vendor')}</TableHead>
                <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{t('common.amount')}</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{t('common.status')}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-black italic">{t('subcon.contracts.empty')}</TableCell></TableRow>
              ) : filtered.map((contract) => (
                <TableRow key={contract.id} className="hover:bg-primary/[0.02] transition-colors group border-b-slate-100 cursor-pointer" onClick={() => router.push(`/dashboard/procurement/subcontractors/contracts/${contract.id}`)}>
                   <TableCell className="py-6 ps-10 text-start">
                      <div className="flex items-center gap-4">
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

      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-xl text-start" dir={dir}>
            <div className="bg-primary p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <Handshake className="h-10 w-10 text-white" />
                  {t('subcon.contracts.new')}
               </DialogTitle>
            </div>

            <div className="p-10 space-y-6 text-start bg-white">
               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{t('common.vendor')}</Label>
                  <Select value={formData.subcontractorId} onValueChange={v => setFormData({...formData, subcontractorId: v})}>
                     <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 shadow-inner">
                        <SelectValue placeholder="..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                        {subcontractors?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold py-4 border-b last:border-0">{s.name}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>

               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{t('common.project')}</Label>
                  <Select value={formData.transactionId} onValueChange={v => setFormData({...formData, transactionId: v})}>
                     <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 shadow-inner">
                        <SelectValue placeholder="..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                        {transactions?.map(t_item => (
                          <SelectItem key={t_item.id} value={t_item.id!} className="font-bold py-4">
                             {t_item.subServiceName} <span className="text-[10px] opacity-40">#{t_item.transactionNumber}</span>
                          </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اختر القالب' : 'Choose Template'}</Label>
                  <Select value={formData.templateId} onValueChange={v => setFormData({...formData, templateId: v})}>
                     <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 shadow-inner">
                        <SelectValue placeholder="..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                        {templates?.map(temp => (
                          <SelectItem key={temp.id} value={temp.id!} className="font-bold py-4">
                             <div className="flex items-center gap-2">
                                <Badge className="bg-amber-100 text-amber-600 border-0 h-4 text-[7px] font-black">{temp.trade}</Badge>
                                {temp.name}
                             </div>
                          </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <Button 
                  onClick={handleIssueContract} 
                  disabled={loading || !formData.subcontractorId || !formData.transactionId || !formData.templateId}
                  className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-4 border-b-8 border-orange-700 mt-6"
               >
                  {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
                  {t('subcon.contracts.issue')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}