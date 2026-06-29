
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  HardHat, Plus, Search, Loader2, ArrowRight,
  Filter, LayoutGrid, UserCircle, DollarSign,
  Workflow, Building2, Activity, PlayCircle, CheckCircle2
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';

/**
 * صفحة المشاريع المطورة (The Eagle Eye View)
 * تقوم بجلب الخدمات (Transactions) من كافة العملاء وعرضها كمشاريع هندسية.
 */
export default function ProjectsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'contracting'>('all');

  // استعلام ديناميكي من مجموعة المعاملات الموحدة (Transactions)
  // أي تحديث في "خدمات العميل" يظهر هنا لحظياً لأنها نفس الداتا
  const transactionsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    
    // جلب كافة المعاملات مرتبة حسب الأحدث
    let q = query(
      collection(db, paths.transactions(companyId)),
      orderBy('createdAt', 'desc')
    );

    return q;
  }, [db, companyId]);

  const { data: allTransactions, loading } = useCollection<Transaction>(transactionsQuery);

  // فلترة المشاريع: جلب ما يخص المقاولات أو ما تم البحث عنه
  const filteredProjects = useMemo(() => {
    if (!allTransactions) return [];
    
    return allTransactions.filter(p => {
      const matchSearch = 
        p.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.subServiceName?.toLowerCase().includes(searchTerm.toLowerCase());

      // إذا اختار المستخدم فلتر "شغل المقاولات" فقط
      const isContracting = p.activityTypeName?.includes('مقاولات') || p.activityTypeName?.includes('Construction');
      const matchType = activeFilter === 'all' || isContracting;

      return matchSearch && matchType;
    });
  }, [allTransactions, searchTerm, activeFilter]);

  const stats = useMemo(() => {
    return {
      total: filteredProjects.length,
      active: filteredProjects.filter(p => p.status !== 'completed').length,
      completed: filteredProjects.filter(p => p.status === 'completed').length
    };
  }, [filteredProjects]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <HardHat className="h-10 w-10 text-primary" />
            {isRtl ? 'رادار المشاريع الهندسية' : 'Engineering Projects Radar'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'عرض حي وشامل لكافة الخدمات المتعاقد عليها مع العملاء' : 'Live consolidated view of all contracted services'}
          </p>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setActiveFilter(activeFilter === 'all' ? 'contracting' : 'all')}
            className={cn(
              "h-12 px-6 rounded-xl font-black transition-all gap-2 border-2",
              activeFilter === 'contracting' ? "bg-primary/10 border-primary text-primary" : "bg-white"
            )}
          >
            <Workflow className="h-4 w-4" />
            {isRtl ? 'شغل المقاولات فقط' : 'Contracting Only'}
          </Button>
          
          <Button onClick={() => router.push('/dashboard/clients')} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2">
            <Plus className="h-5 w-5" />
            {isRtl ? 'بدء مشروع لعميل' : 'New Project'}
          </Button>
        </div>
      </div>

      {/* شريط الإحصائيات الحي */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 bg-white flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي العقود' : 'Total Contracts'}</p>
               <h3 className="text-3xl font-black text-slate-900">{stats.total}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center"><Activity className="h-6 w-6" /></div>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 bg-white flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'قيد التنفيذ ميدانياً' : 'In Progress'}</p>
               <h3 className="text-3xl font-black text-blue-600">{stats.active}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><PlayCircle className="h-6 w-6" /></div>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 bg-white flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'تم التسليم' : 'Handed Over'}</p>
               <h3 className="text-3xl font-black text-emerald-600">{stats.completed}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="h-6 w-6" /></div>
         </Card>
      </div>

      {/* البحث الذكي */}
      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث برقم المعاملة، العميل، أو نوع العمل...' : 'Search contracts...'} 
              className="ps-12 h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* جدول المشاريع (المسحوب من معاملات العملاء) */}
      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#F4F6F9] border-b">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'المشروع / المسار الفني' : 'Project / Technical Path'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'العميل المالك' : 'Client'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'نوع النشاط' : 'Activity'}</TableHead>
                <TableHead className="text-start">{t('status')}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد مشاريع مطابقة للبحث.' : 'No projects found.'}</TableCell></TableRow>
              ) : (
                filteredProjects.map((proj) => (
                  <TableRow 
                    key={proj.id} 
                    className="hover:bg-primary/[0.02] transition-colors group cursor-pointer border-b-slate-100" 
                    onClick={() => router.push(`/dashboard/clients/${proj.clientId}/transactions/${proj.id}`)}
                  >
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-5">
                          <div className={cn(
                            "h-12 w-12 rounded-2xl shadow-sm flex items-center justify-center font-black",
                            proj.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                          )}>
                             <Building2 className="h-6 w-6" />
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-lg block leading-none">{proj.subServiceName}</span>
                             <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-2 block">{proj.transactionNumber}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                          <UserCircle className="h-4 w-4 text-slate-400" />
                          {proj.clientName}
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase px-3">
                          {proj.activityTypeName}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1 rounded-xl border-0 shadow-sm uppercase text-[9px]",
                         proj.status === 'completed' ? 'bg-emerald-50 text-white' : 'bg-blue-50 text-white'
                       )}>
                          {proj.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                      <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-10 w-10">
                        <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
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
