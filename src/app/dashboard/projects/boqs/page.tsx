'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileSpreadsheet, Search, Loader2, ArrowRight, 
  Trash2, Edit3, ShieldCheck
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ } from '@/types/documents';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';

export default function BOQExplorerPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId))) : null, 
  [db, companyId]);

  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqsQuery);

  const filteredBoqs = useMemo(() => {
    return (boqs || []).filter(boq => 
      (boq.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (boq.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (boq.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => {
       const dateA = a.createdAt?.toMillis?.() || 0;
       const dateB = b.createdAt?.toMillis?.() || 0;
       return dateB - dateA;
    });
  }, [boqs, searchTerm]);

  const handleDeleteBOQ = async (id: string, transId?: string) => {
    if (!db || !companyId || !confirm(t('common.confirmDelete'))) return;
    setIsDeleting(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      await service.deleteBOQ(id, transId, user?.uid, globalUser?.fullName || 'Admin');
      toast({ title: t('common.deleted') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-start animate-in fade-in duration-500" dir={dir}>
      {/* Unified Header Design */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('projects.boqExplorer')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">{t('projects.boqExplorer.desc')}</p>
          </div>
        </div>
      </header>

      <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
         <CardHeader className="bg-slate-50/50 border-b p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input 
                 placeholder={t('common.search')} 
                 className="ps-11 h-11 rounded-xl bg-white border-slate-200 font-bold text-sm shadow-inner" 
                 value={searchTerm} 
                 onChange={e => setSearchTerm(e.target.value)} 
               />
            </div>
            <Badge variant="outline" className="h-11 px-6 rounded-xl font-black border-2 bg-white text-xs">
               {filteredBoqs.length} {isRtl ? 'سجلات' : 'Records'}
            </Badge>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b-0">
                     <TableHead className="py-5 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.boqNumber')}</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.clientName')}</TableHead>
                     <TableHead className="text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('projects.budget')}</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                     <TableHead className="pe-10"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.length === 0 ? (
                     <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-black italic">{t('common.noResults')}</TableCell></TableRow>
                  ) : filteredBoqs.map((boq) => (
                    <TableRow key={boq.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors border-b-slate-100 group" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                      <TableCell className="py-5 ps-10 text-start font-black text-slate-800">
                         {boq.boqNumber}
                      </TableCell>
                      <TableCell className="text-start">
                         <div className="flex flex-col text-start">
                            <span className="font-bold text-sm text-slate-700">{boq.clientName}</span>
                            <span className="text-[10px] text-slate-400 font-black uppercase truncate max-w-[200px]">{boq.name}</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-end font-mono font-black text-slate-900">
                         {boq.totalAmount?.toLocaleString()} <span className="text-[10px] opacity-40">{t('dashboard.units.kwd')}</span>
                      </TableCell>
                      <TableCell className="text-start">
                         <Badge className={cn(
                           "font-black px-3 py-1 rounded-lg border-0 shadow-sm text-[9px] uppercase", 
                           boq.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                         )}>
                            {t('status.' + boq.status)}
                         </Badge>
                      </TableCell>
                      <TableCell className="pe-10 text-end" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-primary group-hover:bg-primary/5 transition-all"
                              onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}
                            >
                               <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                            </Button>
                         </div>
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
