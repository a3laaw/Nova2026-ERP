'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, Calculator, UserPlus, 
  Users, Clock, ShieldCheck, TrendingUp,
  ShieldAlert, Loader2
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthContext } from '@/context/auth-context';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { LeavesManager } from './leaves-manager';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';

export default function HRDashboard() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const { check } = usePermissions();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState("overview");

  const companyId = globalUser?.companyId;
  const hrView = check('hr', 'view');
  const canHire = check('hr', 'create').can && check('hr', 'create').scope !== 'own';
  const canSeePayroll = check('hr', 'approve').can;

  useEffect(() => {
    if (hrView.can && hrView.scope === 'own' && globalUser?.employeeId) {
       router.replace(`/dashboard/hr/reports/dossier/${globalUser.employeeId}`);
    }
  }, [hrView, globalUser, router]);

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

  if (hrView.scope === 'own' || empsLoading) return <div className="h-[60vh] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 w-full animate-in fade-in" dir={dir}>
      {/* Unified Header Design (H-14) */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <UserCircle className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('hr')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">{t('hr.description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
           {canSeePayroll && <Button onClick={() => router.push('/dashboard/hr/payroll')} size="sm" className="h-11 font-black px-6 rounded-xl shadow-lg shadow-primary/20"><Calculator className="me-2 h-4 w-4" /> {t('payroll')}</Button>}
           {canHire && <Button onClick={() => router.push('/dashboard/hr/employees/new')} size="sm" className="h-11 font-black px-6 rounded-xl shadow-lg shadow-primary/20"><UserPlus className="me-2 h-4 w-4" /> {t('hr.hire')}</Button>}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white p-1.5 rounded-xl border shadow-sm mb-4 inline-flex">
          <TabsList className="bg-transparent h-10 gap-1 p-0">
            <TabsTrigger value="overview" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full">{t('common.overview')}</TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full">{t('leaverequests')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="rounded-[1.5rem] shadow-sm border bg-white p-6 text-start flex items-center justify-between group hover:shadow-lg transition-all">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Employees</p>
                    <h3 className="text-3xl font-black text-slate-900">{employees?.length || 0}</h3>
                 </div>
                 <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6" />
                 </div>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="leaves" className="animate-in fade-in duration-300">
          <LeavesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
