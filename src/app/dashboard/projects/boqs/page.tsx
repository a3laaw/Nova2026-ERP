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
    <div className="w-full space-y-4 text-start animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3 text-slate-900">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            {t('projects.boqExplorer')}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">
            {t('projects.boqExplorer.desc')}
          </p>
        </div>
      </div>

      <Card className="rounded-lg border shadow-sm bg-white overflow-hidden">
         <CardHeader className="bg-slate-50/50 border-b p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
               <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input 
                 placeholder={t('common.search')} 
                 className="ps-10 h-9 rounded-md bg-white border-slate-200 font-bold text-xs" 
                 value={searchTerm} 
                 onChange={e => setSearchTerm(e.target.value)} 
               />
            </div>
            <Badge variant="outline" className="h-7 px-3 font-black border-slate-200 bg-white text-[10px]">
               {filteredBoqs.length} {t('common.records')}
            </Badge>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b">
                     <TableHead className="py-3 ps-6 text-[10px] font-black uppercase text-slate-500">{t('projects.boqNumber')}</TableHead>
                     <TableHead className="py-3 text-[10px] font-black uppercase text-slate-500">{t('projects.clientName')}</TableHead>
                     <TableHead className="py-3 text-end text-[10px] font-black uppercase text-slate-500">{t('projects.budget')}</TableHead>
                     <TableHead className="py-3 text-[10px] font-black uppercase text-slate-500">{t('common.status')}</TableHead>
                     <TableHead className="py-3 pe-6 text-end"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.length === 0 ? (
                     <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 text-xs font-bold italic">{t('projects.noBoqsRegistered')}</TableCell></TableRow>
                  ) : filteredBoqs.map((boq) => (
                    <TableRow key={boq.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors border-b-slate-100 group" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                      <TableCell className="py-2.5 ps-6 text-start font-black text-slate-800 text-xs">
                         {boq.boqNumber}
                      </TableCell>
                      <TableCell className="py-2.5 text-start">
                         <div className="flex flex-col">
                            <span className="font-bold text-xs text-slate-700">{boq.clientName}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[150px]">{boq.name}</span>
                         </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-end font-mono font-black text-slate-900 text-xs">
                         {boq.totalAmount?.toLocaleString()} <span className="text-[8px] opacity-40">{t('dashboard.units.kwd')}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-start">
                         <Badge className={cn(
                           "text-[8px] font-black uppercase px-2 h-5 rounded-md border-0 shadow-sm", 
                           boq.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                         )}>
                            {t('status.' + boq.status)}
                         </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 pe-6 text-end" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-md text-slate-300 group-hover:text-primary"
                              onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}
                            >
                               <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                            </Button>
                            {isAdmin && (
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-8 w-8 rounded-md text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                                 onClick={() => handleDeleteBOQ(boq.id!, boq.transactionId)}
                               >
                                  <Trash2 className="h-3.5 w-3.5" />
                               </Button>
                            )}
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
