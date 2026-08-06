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
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;

  const viewAccess = check('hr', 'view');
  const createAccess = check('hr', 'create');
  const deleteAccess = check('hr', 'delete');
  const canSeeSalaries = check('hr', 'approve').can;

  const employeesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('employeeNumber')) : null, 
  [db, companyId]);

  const { data: employees, loading } = useCollection<Employee>(employeesQuery);

  const hrService = useMemo(() => 
    db && companyId ? new HRService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const filteredEmployees = useMemo(() => {
    if (!viewAccess.can || !employees) return [];
    return employees.filter(emp => {
      const matchSearch = emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employeeNumber?.includes(searchTerm);
      if (!matchSearch) return false;
      if (viewAccess.scope === 'all') return true;
      if (viewAccess.scope === 'dept') return emp.departmentId === globalUser?.departmentId;
      if (viewAccess.scope === 'own') return emp.id === globalUser?.employeeId;
      return false;
    });
  }, [employees, viewAccess, globalUser, searchTerm]);

  const handleDelete = async () => {
    if (!hrService || !deletingId) return;
    setLoadingAction(deletingId);
    try {
      await hrService.deleteEmployee(deletingId);
      toast({ title: t('deleted') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Users className="h-6 w-6 text-primary" />
            {viewAccess.scope === 'own' ? (isRtl ? 'ملفي الوظيفي' : 'My Profile') : (isRtl ? 'سجل الموظفين' : 'Employee Records')}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">
            {isRtl ? 'إدارة القوى العاملة والبيانات الوظيفية' : 'Manage workforce and job profiles'}
          </p>
        </div>

        {createAccess.can && createAccess.scope !== 'own' && (
          <Button onClick={() => router.push('/dashboard/hr/employees/new')} size="sm" className="h-9 font-bold px-6 shadow-sm">
            <UserPlus className="me-2 h-4 w-4" />
            {isRtl ? 'توظيف جديد' : 'New Hire'}
          </Button>
        )}
      </div>

      <Card className="rounded-lg shadow-sm border overflow-hidden bg-white">
        <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={isRtl ? 'بحث...' : 'Search staff...'} 
              className="ps-9 h-9 border-slate-200 bg-white font-medium text-sm" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 px-4 border-slate-200 font-bold text-xs">
             <Filter className="h-3.5 w-3.5 me-2" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="py-3 ps-6 text-start text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'الوظيفة' : 'Job'}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                {canSeeSalaries && <TableHead className="text-end text-[10px] font-bold uppercase text-slate-500">{isRtl ? 'الراتب' : 'Salary'}</TableHead>}
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد موظفين.' : 'No employees found.'}</TableCell></TableRow>
              ) : filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="cursor-pointer border-b-slate-100 group hover:bg-slate-50/50" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                  <TableCell className="py-2.5 ps-6 text-start">
                    <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0">
                          {emp.employeeNumber}
                       </div>
                       <div className="flex flex-col text-start">
                          <span className="font-bold text-slate-800 text-sm">{emp.fullName}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{emp.mobile}</span>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <span className="font-bold text-xs text-slate-600 flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3 text-primary/50" /> {emp.jobTitle}
                     </span>
                  </TableCell>
                  <TableCell className="text-start">
                     <Badge variant="outline" className={cn(
                       "font-bold px-2 py-0.5 rounded-md border-0 text-[9px] uppercase",
                       emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                     )}>
                        {emp.status}
                     </Badge>
                  </TableCell>
                  {canSeeSalaries && (
                    <TableCell className="text-end font-mono font-bold text-emerald-600 text-sm">
                      {emp.basicSalary?.toLocaleString()}
                    </TableCell>
                  )}
                  <TableCell className="pe-6 text-end" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       {deleteAccess.can && (
                         <Button variant="ghost" size="icon" className="text-rose-300 hover:text-rose-600 h-8 w-8" onClick={() => setDeletingId(emp.id!)}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       )}
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 group-hover:text-primary">
                         <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="h-6 w-6" /></div>
            <AlertDialogTitle className="text-center font-bold text-lg">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-center font-medium text-slate-500 mt-2 text-sm leading-relaxed">
              {isRtl ? 'هل أنت متأكد؟ سيتم حذف ملف الموظف نهائياً.' : 'Are you sure? Employee profile will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2 flex flex-row">
            <AlertDialogCancel className="flex-1 h-9 rounded-md text-xs font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-md">
               {isRtl ? 'نعم، احذف' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
