
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

  // استعلام بسيط جداً لضمان ظهور البيانات فوراً دون الحاجة لفهارس معقدة
  const boqsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId))) : null, 
  [db, companyId]);

  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqsQuery);

  const filteredBoqs = useMemo(() => {
    return (boqs || []).filter(boq => 
      (boq.boqNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (boq.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (boq.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [boqs, searchTerm]);

  const handleDeleteBOQ = async (id: string, transId?: string) => {
    if (!db || !companyId || !confirm(t('confirmDelete'))) return;
    setIsDeleting(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      await service.deleteBOQ(id, transId, user?.uid, globalUser?.fullName || 'Admin');
      toast({ title: t('deleted') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-start animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-2xl md:text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            {t('boqExplorer')}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {isRtl ? 'إدارة واعتماد جداول الكميات والميزانيات المرجعية' : 'Manage and approve bill of quantities and baseline budgets'}
          </p>
        </div>
      </div>

      <Card className="rounded-xl border-0 shadow-lg bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input 
                 placeholder={t('search')} 
                 className="ps-11 h-11 rounded-xl bg-white border-2 border-slate-100 font-bold" 
                 value={searchTerm} 
                 onChange={e => setSearchTerm(e.target.value)} 
               />
            </div>
            <Badge variant="outline" className="h-9 px-4 font-black border-2 border-slate-100 bg-white">
               {filteredBoqs.length} {isRtl ? 'مقايسة' : 'BOQs'}
            </Badge>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b">
                     <TableHead className="py-4 ps-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('boqNumber')}</TableHead>
                     <TableHead className="py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clientName')}</TableHead>
                     <TableHead className="py-4 text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('budget')}</TableHead>
                     <TableHead className="py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('status')}</TableHead>
                     <TableHead className="py-4 pe-8 text-end"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {boqLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredBoqs.length === 0 ? (
                     <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 text-sm font-black italic">{isRtl ? 'لا يوجد مقايسات مسجلة حالياً.' : 'No BOQs registered yet.'}</TableCell></TableRow>
                  ) : filteredBoqs.map((boq) => (
                    <TableRow key={boq.id} className="hover:bg-primary/[0.01] border-b-slate-50 cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}>
                      <TableCell className="py-5 ps-8 text-start font-black text-slate-800">
                         {boq.boqNumber}
                      </TableCell>
                      <TableCell className="py-5 text-start">
                         <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-700">{boq.clientName}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{boq.name}</span>
                         </div>
                      </TableCell>
                      <TableCell className="py-5 text-end font-mono font-black text-slate-700 text-base">
                         {boq.totalAmount?.toLocaleString()} <span className="text-[9px] opacity-40">KWD</span>
                      </TableCell>
                      <TableCell className="py-5 text-start">
                         <Badge className={cn(
                           "text-[9px] font-black uppercase px-3 py-1 rounded-lg border-0 shadow-sm", 
                           boq.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                         )}>
                            {isRtl ? (boq.status === 'approved' ? 'معتمدة' : 'مسودة') : boq.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="py-5 pe-8 text-end" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl text-primary border-primary/20 hover:bg-primary hover:text-white"
                              onClick={() => router.push(`/dashboard/clients/${boq.clientId}/transactions/${boq.transactionId}/boq`)}
                            >
                               <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                            </Button>
                            {isAdmin && (
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-9 w-9 rounded-xl text-rose-300 hover:text-rose-600"
                                 onClick={() => handleDeleteBOQ(boq.id!, boq.transactionId)}
                               >
                                  <Trash2 className="h-4 w-4" />
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
