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
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CRMPage() {
  const { globalUser } = useAuthContext();
  const { t, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', status: 'new', value: '', email: '' });

  // فحص الصلاحية: هل يحق له الإنشاء؟
  const canCreate = check('crm', 'create').can;
  // فحص الصلاحية: هل يرى بياناته فقط أم الجميع؟
  const viewScope = check('crm', 'view').scope;

  const companyId = globalUser?.companyId;
  const leadsRef = useMemo(() => companyId && db ? collection(db, paths.leads(companyId)) : null, [db, companyId]);
  const leadsQuery = useMemo(() => leadsRef ? query(leadsRef, orderBy('createdAt', 'desc')) : null, [leadsRef]);

  const { data: rawLeads, loading } = useCollection(leadsQuery);

  // تطبيق النطاق (Scope Filtering) برمجياً
  const leads = useMemo(() => {
    if (viewScope === 'all') return rawLeads;
    if (viewScope === 'own') return rawLeads.filter(l => l.createdBy === globalUser?.uid);
    // نطاق القسم (Dept) يتطلب وجود معرف القسم في السجل والمستخدم
    if (viewScope === 'dept') return rawLeads.filter(l => (l as any).departmentId === (globalUser as any)?.departmentId);
    return [];
  }, [rawLeads, viewScope, globalUser]);

  const handleAddLead = async () => {
    if (!leadsRef || !newLead.name || !canCreate) return;
    setIsAdding(true);
    try {
      await addDoc(leadsRef, {
        ...newLead,
        value: Number(newLead.value) || 0,
        createdAt: serverTimestamp(),
        createdBy: globalUser?.uid,
        departmentId: (globalUser as any)?.departmentId || 'general'
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
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Users className="h-10 w-10 text-primary" />
            {t('crm')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {viewScope === 'all' ? (dir === 'rtl' ? 'عرض شامل للمنشأة' : 'Full Enterprise View') : (dir === 'rtl' ? 'عرض السجلات الخاصة بك' : 'Personal Records View')}
          </p>
        </div>
        
        {/* إخفاء زر الإضافة تماماً إذا لم يملك الموظف صلاحية create */}
        {canCreate && (
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
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                <div className="space-y-2"><Label>{t('name')}</Label><Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="h-14 rounded-2xl" /></div>
                <div className="space-y-2"><Label>{t('company')}</Label><Input value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} className="h-14 rounded-2xl" /></div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddLead} disabled={isAdding} className="w-full h-14 rounded-2xl font-black text-lg bg-primary">
                  {isAdding ? <Loader2 className="animate-spin" /> : <Plus className="me-2 h-5 w-5" />}
                  {t('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50 border-b p-6">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('search')} className="ps-10 rounded-xl h-12 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-start font-black">{t('name')}</TableHead>
                <TableHead className="text-start font-black">{t('company')}</TableHead>
                <TableHead className="text-start font-black">{t('status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto" /></TableCell></TableRow>
              ) : filteredLeads.map((lead: any) => (
                <TableRow key={lead.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="text-start font-black text-slate-800">{lead.name}</TableCell>
                  <TableCell className="text-start text-muted-foreground font-bold">{lead.company}</TableCell>
                  <TableCell className="text-start">
                    <Badge className="bg-blue-500/10 text-blue-600 font-black">{t(lead.status)}</Badge>
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
