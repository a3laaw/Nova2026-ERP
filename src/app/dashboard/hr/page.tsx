'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { addDays, isBefore, parseISO } from 'date-fns';

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
  const canSeeCompliance = check('hr', 'edit').can && check('hr', 'edit').scope !== 'own';

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
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCircle className="h-6 w-6 text-primary" /> {t('hr.title')}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">{t('hr.description')}</p>
        </div>
        <div className="flex gap-2">
           {canSeePayroll && <Button onClick={() => router.push('/dashboard/hr/payroll')} size="sm" className="h-9 font-bold px-4"><Calculator className="me-2 h-4 w-4" /> {t('payroll')}</Button>}
           {canHire && <Button onClick={() => router.push('/dashboard/hr/employees/new')} size="sm" className="h-9 font-bold px-4"><UserPlus className="me-2 h-4 w-4" /> {t('hr.hire')}</Button>}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white p-1 rounded-lg border shadow-sm mb-4 inline-flex">
          <TabsList className="bg-transparent h-8 gap-1 p-0">
            <TabsTrigger value="overview" className="rounded-md font-bold text-[11px] px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full">{t('common.overview')}</TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-md font-bold text-[11px] px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full">{t('leaveRequests')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="rounded-lg shadow-sm border bg-white p-4 text-start">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Employees</p>
                 <h3 className="text-2xl font-bold text-slate-900">{employees?.length || 0}</h3>
              </Card>
              <Card className="rounded-lg shadow-sm border bg-white border-b-4 border-b-emerald-500 p-4 text-start">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Field</p>
                 <h3 className="text-2xl font-bold text-emerald-600">{employees?.filter(e => e.status === 'active').length || 0}</h3>
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
