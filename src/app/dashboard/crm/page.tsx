'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Search, Loader2, Plus, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
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
  const { t, dir, lang } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', status: 'new', value: '', email: '' });
  const isRtl = lang === 'ar';

  const viewAccess = check('crm', 'view');
  const createAccess = check('crm', 'create');

  const companyId = globalUser?.companyId;
  const leadsRef = useMemo(() => companyId && db ? collection(db, paths.leads(companyId)) : null, [db, companyId]);
  const leadsQuery = useMemo(() => leadsRef ? query(leadsRef, orderBy('createdAt', 'desc')) : null, [leadsRef]);

  const { data: rawLeads, loading } = useCollection(leadsQuery);

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
      toast({ title: t('saved') });
      setNewLead({ name: '', company: '', status: 'new', value: '', email: '' });
    } catch (error) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredLeads = leads?.filter(lead => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-[#039BE5]" />
            {t('crm')}
          </h1>
          <p className="text-slate-600 text-sm font-bold opacity-80 italic">
            {viewAccess.scope === 'all' ? (isRtl ? 'عرض شامل للمنشأة' : 'Enterprise View') : (isRtl ? 'فلترة القسم' : 'Dept Locked')}
          </p>
        </div>
        
        {createAccess.can && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-[#FFA000] text-white font-bold h-11 px-6 shadow-sm">
                <UserPlus className="me-2 h-4 w-4" />
                {t('addLead')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-0 shadow-2xl max-w-lg" dir={dir}>
              <DialogHeader>
                <DialogTitle className="text-start font-bold text-xl">{t('addLead')}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 text-start">
                <div className="space-y-2"><Label className="text-xs font-bold">{t('name')}</Label><Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="h-11 rounded-lg" /></div>
                <div className="space-y-2"><Label className="text-xs font-bold">{t('company')}</Label><Input value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} className="h-11 rounded-lg" /></div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddLead} disabled={isAdding} className="w-full h-12 rounded-lg font-bold bg-[#FFA000]">
                  {isAdding ? <Loader2 className="animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                  {t('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <Card className="border-none shadow-sm card-shadow bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b p-4 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder={t('search')} className="ps-10 rounded-xl h-10 bg-white border-slate-200 text-xs font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" className="font-bold text-slate-500 rounded-lg"><Filter className="h-4 w-4 me-2" /> {isRtl ? 'فلترة' : 'Filter'}</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="py-4 ps-6 text-start font-black">{t('name')}</TableHead>
                <TableHead className="text-start font-black">{t('company')}</TableHead>
                <TableHead className="text-start font-black">{t('status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا توجد بيانات.' : 'No leads found.'}</TableCell></TableRow>
              ) : filteredLeads.map((lead: any) => (
                <TableRow key={lead.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-50">
                  <TableCell className="ps-6 font-bold text-slate-800">{lead.name}</TableCell>
                  <TableCell className="text-slate-600 font-bold">{lead.company}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "font-black text-[9px] uppercase border-none px-3 py-1",
                      lead.status === 'new' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {t(lead.status)}
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