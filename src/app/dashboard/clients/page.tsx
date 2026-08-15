'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  UserPlus, Search, Loader2, 
  ArrowRight, Filter, UserCircle,
  Trash2, AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { ClientService } from '@/services/client-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ClientsListPage() {
  const { globalUser } = useAuthContext();
  const { t, isRtl, dir, tSafe } = useLanguage();
  const { isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const companyId = globalUser?.companyId;

  const canRegisterClient = check('crm', 'create').can;
  const canDeleteClient = isAdmin;

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const { data: rawClients, loading } = useCollection<Client>(clientsQuery);

  const filtered = useMemo(() => {
    let list = [...(rawClients || [])].sort((a, b) => {
       const dateA = a.createdAt?.toMillis?.() || 0;
       const dateB = b.createdAt?.toMillis?.() || 0;
       return dateB - dateA;
    });
    
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(c => c.assignedEngineerId === globalUser.employeeId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => 
        c.nameAr?.toLowerCase().includes(term) || 
        c.fileNumber?.toLowerCase().includes(term) ||
        c.assignedEngineerName?.toLowerCase().includes(term)
      );
    }
    
    return list;
  }, [rawClients, searchTerm, isAdmin, globalUser?.employeeId]);

  const handleDeleteClient = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const service = new ClientService(db, companyId);
      await service.deleteClient(deletingId);
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: t('common.error'), 
        description: e.message 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <UserCircle className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('clients')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">
               {isRtl ? 'إدارة قاعدة بيانات العملاء والملفات الرسمية المعتمدة' : 'Manage client database and official files'}
            </p>
          </div>
        </div>
        
        {canRegisterClient && (
          <Button onClick={() => router.push('/dashboard/clients/new')} size="sm" className="h-11 px-6 font-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
            <UserPlus className="h-4 w-4 me-2" /> {t('clients.addnew')}
          </Button>
        )}
      </header>

      <Card className="rounded-2xl shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
           <div className="relative w-full max-w-md text-start">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-11 h-11 rounded-xl border-slate-200 bg-white text-sm font-bold shadow-inner focus-visible:ring-primary/20" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-11 px-4 rounded-xl font-black text-xs border-2">
                 <Filter className="h-4 w-4 me-2" /> {t('common.filter')}
              </Button>
              <Badge variant="secondary" className="bg-slate-900 text-white font-black h-11 px-4 rounded-xl text-xs">
                 {filtered.length}
              </Badge>
           </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b-0">
                <TableHead className="py-5 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clients.table.profile')}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-start">{t('clients.table.staff')}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-start">{t('clients.table.contact')}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-start">{t('common.status')}</TableHead>
                <TableHead className="pe-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-black italic">
                   {t('common.noresults')}
                </TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="cursor-pointer group hover:bg-slate-50 transition-colors border-b-slate-100" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-10 py-5 text-start">
                     <div className="flex flex-col text-start">
                        <span className="font-black text-slate-900 text-sm">{client.nameAr}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold mt-1 uppercase">FILE: {client.fileNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <span className="text-xs font-bold text-slate-600">{client.assignedEngineerName || '---'}</span>
                  </TableCell>
                  <TableCell className="py-5 text-xs font-mono font-bold text-slate-500 text-start">{client.mobile}</TableCell>
                  <TableCell className="text-start">
                     <Badge className={cn(
                       "font-black px-3 py-1 rounded-lg border-0 shadow-sm text-[9px] uppercase", 
                       client.status === 'contracted' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                     )}>
                        {t('status.' + client.status)}
                     </Badge>
                  </TableCell>
                  <TableCell className="pe-10 text-end" onClick={e => e.stopPropagation()}>
                     <div className="flex items-center justify-end gap-2">
                        {canDeleteClient && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            onClick={() => setDeletingId(client.id!)}
                          >
                             <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-slate-300 group-hover:text-primary group-hover:bg-primary/5 rounded-xl transition-all"
                          onClick={() => router.push(`/dashboard/clients/${client.id}`)}
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

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <Trash2 className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">
                 {tSafe('inline.confirm.delete.client', 'تأكيد حذف ملف العميل', 'Confirm Delete Client')}
               </AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {tSafe('inline.delete.client.desc', 'هل أنت متأكد؟ سيتم حذف العميل نهائياً من النظام. هذا الإجراء سيؤدي لفقدان تتبع كافة السجلات المرتبطة بهذا الملف.', 'Are you sure? This will permanently delete the client and all associated tracking data.')}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white" onClick={() => setDeletingId(null)}>{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction 
                 onClick={handleDeleteClient} 
                 disabled={isDeleting}
                 className="flex-[2] h-14 rounded-2xl font-black bg-rose-600 text-white shadow-xl shadow-rose-200"
               >
                  {isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : t('common.delete')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
