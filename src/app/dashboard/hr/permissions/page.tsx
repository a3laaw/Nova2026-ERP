'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Clock, Plus, Loader2, Search, 
  ArrowRight, Timer, Filter
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { PermissionRequest } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { canPerformOnRecord } from '@/lib/permissions/engine';

export default function PermissionRequestsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';

  const viewAccess = check('hr', 'view');
  const companyId = globalUser?.companyId;
  const permsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.permissionRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: rawPermissions, loading } = useCollection<PermissionRequest>(permsQuery);

  const permissions = useMemo(() => {
    if (!viewAccess.can) return [];
    return rawPermissions.filter(req => canPerformOnRecord(
      viewAccess,
      { uid: globalUser?.uid || '', departmentId: globalUser?.departmentId },
      { createdBy: req.userId, departmentId: (req as any).departmentId }
    ));
  }, [rawPermissions, viewAccess, globalUser]);

  const filtered = permissions.filter(p => 
    p.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Clock className="h-10 w-10 text-primary" />
            {isRtl ? 'طلبات الاستئذان' : 'Permission Requests'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {viewAccess.scope === 'own' ? (isRtl ? 'عرض سجلاتك الشخصية فقط' : 'Viewing your own records only') : (isRtl ? 'إدارة التأخيرات والانصراف المبكر' : 'Manage late arrivals and early departures')}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/permissions/new')}
          className="bg-primary text-white font-black rounded-xl px-8 h-12 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-5 w-5" />
          {isRtl ? 'طلب استئذان جديد' : 'New Request'}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFA000]" />
            <Input 
              placeholder={isRtl ? 'بحث...' : 'Search...'} 
              className="ps-12 rounded-xl h-11 bg-white border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="rounded-xl font-bold h-11 px-4 flex items-center gap-2 border-slate-200">
             <Filter className="h-4 w-4 text-[#FFA000]" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow>
                <TableHead className="py-5 ps-8 text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'النوع' : 'Type'}</TableHead>
                <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-center font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'المدة' : 'Duration'}</TableHead>
                <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد طلبات.' : 'No requests found.'}</TableCell></TableRow>
              ) : (
                filtered.map((req) => (
                  <TableRow 
                    key={req.id} 
                    className="hover:bg-primary/[0.02] transition-colors group cursor-pointer border-b-slate-100"
                    onClick={() => router.push(`/dashboard/hr/permissions/${req.id}`)}
                  >
                    <TableCell className="py-5 ps-8 text-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                           <Timer className="h-5 w-5" />
                        </div>
                        <span className="font-black text-slate-800 text-sm">{req.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="font-black border-slate-200 px-3 uppercase text-[9px] bg-white">
                          {isRtl ? (req.type === 'late_arrival' ? 'حضور متأخر' : 'انصراف مبكر') : req.type}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start font-mono text-xs font-bold text-slate-500">{req.date}</TableCell>
                    <TableCell className="text-center">
                       <span className="font-black text-primary bg-primary/5 px-3 py-1 rounded-lg text-xs">{req.durationHours}h</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className={cn(
                         "font-black px-4 py-1 rounded-lg border-0 shadow-sm text-[9px] uppercase",
                         req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                         req.status === 'pending' ? 'bg-[#FFCA28]/10 text-[#FFCA28]' : 
                         'bg-rose-50 text-rose-600'
                       )}>
                          {req.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center pe-8">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-9 w-9">
                          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-0", isRtl && "rotate-180")} />
                       </Button>
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
