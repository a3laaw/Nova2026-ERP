'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, UserPlus, Search, Loader2, ArrowRight, 
  Filter, Briefcase, Trash2, AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { HRService } from '@/services/hr-service';
import { cn } from '@/lib/utils';
import { Employee } from '@/types/hr';
import { toast } from '@/hooks/use-toast';

export default function EmployeesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const viewAccess = check('hr', 'view');
  const createAccess = check('hr', 'create');
  const canSeeSalaries = check('hr', 'approve').can;

  const employeesQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('employeeNumber')) : null, [db, companyId]);
  const { data: employees, loading } = useCollection<Employee>(employeesQuery);

  const filteredEmployees = useMemo(() => {
    if (!viewAccess.can || !employees) return [];
    return employees.filter(emp => {
      const matchSearch = emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employeeNumber?.includes(searchTerm);
      if (!matchSearch) return false;
      if (viewAccess.scope === 'all') return true;
      if (viewAccess.scope === 'dept') return emp.departmentId === globalUser?.departmentId;
      if (viewAccess.scope === 'own') return emp.id === globalUser?.employeeId;
      return false;
    });
  }, [employees, viewAccess, globalUser, searchTerm]);

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> {t('staffRecords')}
          </h1>
        </div>
        {createAccess.can && (
          <Button onClick={() => router.push('/dashboard/hr/employees/new')} size="sm" className="h-10 font-black px-8 rounded-xl shadow-lg shadow-primary/20">
            <UserPlus className="me-2 h-4 w-4" /> {isRtl ? 'توظيف جديد' : 'New Hire'}
          </Button>
        )}
      </div>

      <Card className="rounded-2xl shadow-sm border border-slate-100 overflow-hidden bg-white">
        <div className="p-4 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder={t('common.search')} className="ps-11 h-11 border-slate-200 bg-white font-bold text-sm rounded-xl shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Button variant="outline" className="h-11 px-4 border-2 rounded-xl font-black text-xs"><Filter className="h-4 w-4 me-2" /> {t('common.filter')}</Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                {canSeeSalaries && <TableHead className="text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الراتب الأساسي' : 'Basic Salary'}</TableHead>}
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-bold italic">No matching records.</TableCell></TableRow>
              ) : filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="cursor-pointer border-b-slate-100 group hover:bg-primary/[0.01]" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                  <TableCell className="ps-8 py-5 text-start">
                     <div className="flex flex-col text-start">
                        <span className="font-black text-slate-800 text-sm leading-none">{emp.fullName}</span>
                        <span className="text-[9px] font-mono text-slate-400 mt-1.5 uppercase tracking-tighter">Emp #{emp.employeeNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <div className="flex items-center gap-2">
                        <Briefcase className="h-3 w-3 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">{emp.jobTitle}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <Badge className={cn(
                       "font-black px-3 py-1 rounded-lg border-0 shadow-sm text-[8px] uppercase",
                       emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                     )}>
                        {emp.status}
                     </Badge>
                  </TableCell>
                  {canSeeSalaries && (
                    <TableCell className="text-end font-mono font-black text-emerald-600 text-sm">
                       {emp.basicSalary?.toLocaleString()}
                    </TableCell>
                  )}
                  <TableCell className="pe-8 text-end">
                     <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-300 group-hover:text-primary transition-all">
                        <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                     </Button>
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
