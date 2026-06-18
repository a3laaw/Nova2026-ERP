'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, MoreHorizontal, Search, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CRMPage() {
  const { globalUser } = useAuthContext();
  const { t, dir } = useLanguage();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', status: 'new', value: '', email: '' });

  const companyId = globalUser?.companyId;
  const leadsRef = useMemo(() => companyId && db ? collection(db, paths.leads(companyId)) : null, [db, companyId]);
  const leadsQuery = useMemo(() => leadsRef ? query(leadsRef, orderBy('createdAt', 'desc')) : null, [leadsRef]);

  const { data: leads, loading } = useCollection(leadsQuery);

  const handleAddLead = async () => {
    if (!leadsRef || !newLead.name) return;
    setIsAdding(true);
    try {
      await addDoc(leadsRef, {
        ...newLead,
        value: Number(newLead.value) || 0,
        createdAt: serverTimestamp(),
      });
      toast({ title: t('saved'), description: t('entryAdded') });
      setNewLead({ name: '', company: '', status: 'new', value: '', email: '' });
    } catch (error) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredLeads = leads?.filter(lead => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalValue = filteredLeads.reduce((acc, lead) => acc + (Number(lead.value) || 0), 0);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Users className="h-10 w-10 text-primary" />
            {t('crm')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {t('expectedValue')}: {totalValue.toLocaleString()} {dir === 'rtl' ? 'د.ك' : 'KWD'}
          </p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <UserPlus className="me-2 h-6 w-6" />
              {t('addLead')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-lg" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{t('addLead')}</DialogTitle>
              <DialogDescription className="text-start">{t('addEntry')}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              <div className="space-y-2 text-start">
                <Label>{t('name')}</Label>
                <Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} placeholder={t('name')} className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2 text-start">
                <Label>{t('company')}</Label>
                <Input value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} placeholder={t('company')} className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2 text-start">
                <Label>{t('email')}</Label>
                <Input value={newLead.email} type="email" onChange={e => setNewLead({...newLead, email: e.target.value})} placeholder="example@nova.com" className="h-14 rounded-2xl border-2 text-start" />
              </div>
              <div className="space-y-2 text-start">
                <Label>{t('value')}</Label>
                <Input value={newLead.value} type="number" onChange={e => setNewLead({...newLead, value: e.target.value})} placeholder="5000" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2 text-start md:col-span-2">
                <Label>{t('status')}</Label>
                <Select value={newLead.status} onValueChange={val => setNewLead({...newLead, status: val})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2"><SelectValue placeholder={t('status')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t('new')}</SelectItem>
                    <SelectItem value="contacted">{t('contacted')}</SelectItem>
                    <SelectItem value="qualified">{t('qualified')}</SelectItem>
                    <SelectItem value="closed">{t('closed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddLead} disabled={isAdding || !newLead.name} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">
                {isAdding ? <Loader2 className="animate-spin" /> : <Plus className="me-2 h-5 w-5" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 text-start">{t('totalLeads')}</p>
          <h3 className="text-4xl font-black font-headline text-start">{leads?.length || 0}</h3>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 text-start">{t('expectedValue')}</p>
          <h3 className="text-2xl font-black font-headline text-emerald-600 text-start">{totalValue.toLocaleString()} {dir === 'rtl' ? 'د.ك' : 'KWD'}</h3>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 text-start">{t('activeNow')}</p>
          <h3 className="text-4xl font-black font-headline text-blue-600 text-start">{filteredLeads.filter(l => l.status !== 'closed').length}</h3>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 text-start">{t('winRate')}</p>
          <h3 className="text-4xl font-black font-headline text-purple-600 text-start">{filteredLeads.length > 0 ? ((filteredLeads.filter(l => l.status === 'qualified').length / filteredLeads.length) * 100).toFixed(0) : 0}%</h3>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('search')} 
              className="ps-10 rounded-xl h-12 bg-white text-start" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-start font-black">{t('name')}</TableHead>
                <TableHead className="text-start font-black">{t('company')}</TableHead>
                <TableHead className="text-start font-black">{t('status')}</TableHead>
                <TableHead className="text-end font-black">{t('value')}</TableHead>
                <TableHead className="text-center font-black">{t('entryAdded')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">{t('search')}</TableCell></TableRow>
              ) : (
                filteredLeads.map((lead: any) => (
                  <TableRow key={lead.id} className="hover:bg-muted/10 transition-colors group">
                    <TableCell className="text-start font-black text-slate-800">{lead.name}</TableCell>
                    <TableCell className="text-start text-muted-foreground font-bold">{lead.company}</TableCell>
                    <TableCell className="text-start">
                      <Badge className={cn(
                        "font-black px-3",
                        lead.status === 'qualified' ? 'bg-emerald-500/10 text-emerald-600' :
                        lead.status === 'new' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-slate-500/10 text-slate-600'
                      )}>
                        {t(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-primary">
                      {lead.value?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="rounded-xl"><MoreHorizontal className="h-5 w-5" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
