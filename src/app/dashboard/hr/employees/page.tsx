
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

export default function EmployeesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const viewAccess = check('hr', 'view');
  const createAccess = check('hr', 'create');
  const deleteAccess = check('hr', 'delete');
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
    <div className="space-y-4 w-full animate-in fade-in" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Users className="h-6 w-6 text-primary" /> {isRtl ? 'سجل الموظفين' : 'Staff Records'}
          </h1>
        </div>
        {createAccess.can && (
          <Button onClick={() => router.push('/dashboard/hr/employees/new')} size="sm" className="h-9 font-bold px-6 shadow-sm">
            <UserPlus className="me-2 h-4 w-4" /> {isRtl ? 'توظيف جديد' : 'New Hire'}
          </Button>
        )}
      </div>

      <Card className="rounded-lg shadow-sm border overflow-hidden bg-white">
        <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder={t('search')} className="ps-9 h-9 border-slate-200 bg-white font-medium text-sm rounded-md" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" className="h-9 px-4 border-slate-200 font-bold text-xs"><Filter className="h-3.5 w-3.5 me-2" /> {isRtl ? 'تصفية' : 'Filter'}</Button>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="py-3 ps-6 text-start text-[10px] font-bold uppercase text-slate-500">Employee</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">Job</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">Status</TableHead>
                {canSeeSalaries && <TableHead className="text-end text-[10px] font-bold uppercase text-slate-500">Salary</TableHead>}
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="cursor-pointer border-b-slate-100 group hover:bg-slate-50/50" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                  <TableCell className="ps-6 py-2.5 text-start font-bold text-sm text-slate-800">{emp.fullName}</TableCell>
                  <TableCell className="text-start text-xs font-medium text-slate-600">{emp.jobTitle}</TableCell>
                  <TableCell className="text-start"><Badge variant="outline" className={cn("text-[9px] font-bold uppercase px-2 h-5", emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>{emp.status}</Badge></TableCell>
                  {canSeeSalaries && <TableCell className="text-end font-mono font-bold text-emerald-600 text-sm">{emp.basicSalary?.toLocaleString()}</TableCell>}
                  <TableCell className="pe-6 text-end"><ArrowRight className={cn("h-4 w-4 text-slate-300 group-hover:text-primary", isRtl && "rotate-180")} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
