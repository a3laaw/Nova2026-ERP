
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Search, Loader2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';
import { canPerformOnRecord } from '@/lib/permissions/engine';
import { cn } from '@/lib/utils';

export default function CRMPage() {
  const { globalUser } = useAuthContext();
  const { t, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', status: 'new', value: '', email: '' });

  const viewAccess = check('crm', 'view');
  const createAccess = check('crm', 'create');

  const companyId = globalUser?.companyId;
  const leadsRef = useMemo(() => companyId && db ? collection(db, paths.leads(companyId)) : null, [db, companyId]);
  const leadsQuery = useMemo(() => leadsRef ? query(leadsRef, orderBy('createdAt', 'desc')) : null, [leadsRef]);

  const { data: rawLeads, loading } = useCollection<any>(leadsQuery);

  const leads = useMemo(() => {
    if (!viewAccess.can) return [];
    if (viewAccess.scope === 'all') return rawLeads;
    return rawLeads.filter(lead => canPerformOnRecord(
      viewAccess, 
      { uid: globalUser?.uid || '', departmentId: globalUser?.departmentId },
      lead as any
    ));
  }, [rawLeads, viewAccess, globalUser]);

  const handleAddLead = async () => {
    if (!leadsRef || !newLead.name || !createAccess.can) return;
    setIsAdding(true);
    try {
      await addDoc(leadsRef, {
        ...newLead,
        value: Number(newLead.value) || 0,
        createdAt: serverTimestamp(),
        createdBy: globalUser?.uid,
        departmentId: globalUser?.departmentId || 'general'
      });
      toast({ title: t('common.saved') });
      setNewLead({ name: '', company: '', status: 'new', value: '', email: '' });
    } catch (error) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredLeads = leads?.filter(lead => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4 animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            {t('crm')}
          </h1>
          <p className="text-slate-600 text-sm font-bold opacity-80 italic text-start">
            {t('crm.description')}
          </p>
        </div>
        
        {createAccess.can && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" className="h-11 px-8 shadow-lg">
                <UserPlus className="h-5 w-5 me-2" />
                {t('crm.newLead')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-0 shadow-2xl max-w-lg p-0 overflow-hidden bg-white" dir={dir}>
              <DialogHeader className="bg-slate-50 p-8 border-b">
                <DialogTitle className="text-start font-black text-2xl">{t('crm.newLead')}</DialogTitle>
              </DialogHeader>
              <div className="p-8 space-y-6 text-start">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{t('common.name')}</Label>
                      <Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="h-11 border-2 rounded-xl" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{t('common.company')}</Label>
                      <Input value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} className="h-11 border-2 rounded-xl" />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{t('common.email')}</Label>
                   <Input value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="h-11 border-2 rounded-xl text-start" dir="ltr" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{t('common.amount')}</Label>
                   <Input value={newLead.value} onChange={e => setNewLead({...newLead, value: e.target.value})} className="h-11 border-2 rounded-xl" type="number" />
                </div>
              </div>
              <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleAddLead} disabled={isAdding} className="w-full h-14 rounded-xl font-black text-lg">
                  {isAdding ? <Loader2 className="animate-spin" /> : t('common.save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <Card className="bg-white mb-4 shadow-sm border border-slate-100 rounded-xl overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
            <Input 
              placeholder={t('common.search')} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-bold" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-2">
            <Filter className="h-4 w-4 me-2" /> 
            {t('common.filter')}
          </Button>
        </div>
      </Card>

      <Card className="bg-white shadow-xl border border-slate-100 rounded-xl overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow>
                <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase tracking-widest text-slate-500">{t('common.name')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase tracking-widest text-slate-500">{t('common.company')}</TableHead>
                <TableHead className="pe-8 text-start text-[10px] font-black uppercase tracking-widest text-slate-500">{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 italic text-slate-400 font-bold">{t('common.noResults')}</TableCell></TableRow>
              ) : filteredLeads.map((lead: any) => (
                <TableRow key={lead.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-100 group">
                  <TableCell className="py-5 ps-8 font-black text-slate-800 text-start">{lead.name}</TableCell>
                  <TableCell className="text-slate-500 font-bold text-sm text-start">{lead.company}</TableCell>
                  <TableCell className="pe-8 text-start">
                    <Badge variant="outline" className={cn(
                      "font-black text-[9px] uppercase px-3 py-1 border-0 shadow-sm",
                      lead.status === 'new' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {lead.status}
                    </Badge>
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
