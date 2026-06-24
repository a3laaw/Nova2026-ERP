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
  const { check } = usePermissions();
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
    db && companyId ? new HRService(db, companyId) : null, 
  [db, companyId]);

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
    <div className="space-y-4 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Users className="h-10 w-10 text-primary" />
            {viewAccess.scope === 'own' ? (isRtl ? 'ملفي الوظيفي' : 'My Profile') : (isRtl ? 'سجل الموظفين' : 'Employee Records')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة القوى العاملة والبيانات الوظيفية' : 'Manage workforce and job profiles'}
          </p>
        </div>

        {createAccess.can && createAccess.scope !== 'own' && (
          <Button 
            onClick={() => router.push('/dashboard/hr/employees/new')}
            variant="default"
            className="h-11 px-8 shadow-lg"
          >
            <UserPlus className="me-2 h-5 w-5" />
            {isRtl ? 'توظيف جديد' : 'New Hire'}
          </Button>
        )}
      </div>

      {/* Independent Filter Card */}
      <Card className="border-0 shadow-sm rounded-xl bg-white mb-4 overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث في سجل الموظفين...' : 'Search staff...'} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-primary/20">
             <Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية النتائج' : 'Filter Results'}
          </Button>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-5 ps-8">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead>{isRtl ? 'الوظيفة' : 'Job'}</TableHead>
                <TableHead>{isRtl ? 'الحالة' : 'Status'}</TableHead>
                {canSeeSalaries && <TableHead className="text-end">{isRtl ? 'الراتب' : 'Salary'}</TableHead>}
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد موظفين.' : 'No employees found.'}</TableCell></TableRow>
              ) : filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                  <TableCell className="py-5 ps-8 text-start">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          {emp.employeeNumber}
                       </div>
                       <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-sm">{emp.fullName}</span>
                          <span className="text-[10px] text-muted-foreground font-bold">{emp.mobile}</span>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell>
                     <span className="font-bold text-xs text-slate-700 flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-primary" /> {emp.jobTitle}
                     </span>
                  </TableCell>
                  <TableCell>
                     <Badge variant="outline" className={cn(
                       "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                       emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#FFA000]/10 text-[#FFA000]'
                     )}>
                        {emp.status}
                     </Badge>
                  </TableCell>
                  {canSeeSalaries && (
                    <TableCell className="text-end font-mono font-black text-emerald-600">
                      {emp.basicSalary?.toLocaleString()}
                    </TableCell>
                  )}
                  <TableCell className="pe-8 text-end" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                       {deleteAccess.can && (
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="text-rose-400 hover:text-rose-600 rounded-xl h-9 w-9"
                           onClick={() => setDeletingId(emp.id!)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       )}
                       <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                         <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
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
        <AlertDialogContent className="rounded-xl p-8" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4"><AlertTriangle className="h-8 w-8" /></div>
            <AlertDialogTitle className="text-start font-black text-2xl">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold">
              {isRtl ? 'هل أنت متأكد؟ سيتم حذف ملف الموظف نهائياً.' : 'Are you sure? Employee profile will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="rounded-xl h-11 font-bold border-2">{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white px-8">
              {isRtl ? 'نعم، احذف' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}