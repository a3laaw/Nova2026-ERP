
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, UserPlus, Search, Loader2, ArrowRight, 
  Filter, Briefcase, Phone, Trash2, AlertTriangle,
  Eye, EyeOff
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
  const { check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showSalaries, setShowSalaries] = useState(false);
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;
  const employeesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('employeeNumber')) : null, 
  [db, companyId]);

  const { data: employees, loading } = useCollection<Employee>(employeesQuery);

  const hrService = useMemo(() => 
    db && companyId ? new HRService(db, companyId) : null, 
  [db, companyId]);

  // فحص صلاحية التوظيف (يجب أن يكون النطاق أكبر من 'own' للتمكن من توظيف آخرين)
  const createAccess = check('hr', 'create');
  const canHireNew = createAccess.can && createAccess.scope !== 'own';

  const filteredEmployees = employees?.filter(emp => 
    emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employeeNumber?.includes(searchTerm) ||
    emp.civilId?.includes(searchTerm)
  ) || [];

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
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Users className="h-10 w-10 text-primary" />
            {isRtl ? 'سجل الموظفين' : 'Employee Records'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة القوى العاملة والبيانات الوظيفية' : 'Manage workforce and job profiles'}
          </p>
        </div>

        {/* زر التوظيف يختفي إذا كان الموظف يملك نطاق 'own' فقط (لأنه لا يوظف نفسه) */}
        {canHireNew && (
          <Button 
            onClick={() => router.push('/dashboard/hr/employees/new')}
            className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
          >
            <UserPlus className="me-2 h-6 w-6" />
            {isRtl ? 'توظيف جديد' : 'New Hire'}
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={isRtl ? 'بحث باسم الموظف، الرقم المدني، أو رقم الملف...' : 'Search by name, civil id, or number...'} 
              className="ps-12 rounded-2xl h-14 bg-white text-start border-2 border-slate-100" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الوظيفة / القسم' : 'Job / Dept'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-end">
                   <div className="flex items-center justify-end gap-2 group">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 text-primary transition-all"
                        onClick={() => setShowSalaries(!showSalaries)}
                      >
                         {showSalaries ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <span className="font-black">{isRtl ? 'الراتب' : 'Salary'}</span>
                   </div>
                </TableHead>
                <TableHead className="text-center pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-muted-foreground font-bold italic">{isRtl ? 'لا توجد نتائج مطابقة.' : 'No results found.'}</TableCell></TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                    <TableCell className="py-6 ps-8 text-start">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors font-black">
                            {emp.employeeNumber}
                         </div>
                         <div className="flex flex-col">
                            <span className="font-black text-slate-800">{emp.fullName}</span>
                            <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                               <Phone className="h-2 w-2" /> {emp.mobile}
                            </span>
                         </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-700 flex items-center gap-1">
                             <Briefcase className="h-3 w-3 text-primary" /> {emp.jobTitle}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-black">{emp.departmentName}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-3 py-1 rounded-lg border-0 shadow-sm",
                         emp.status === 'active' ? 'bg-emerald-500 text-white' : 
                         emp.status === 'on-leave' ? 'bg-amber-50 text-amber-600' : 'bg-rose-500 text-white'
                       )}>
                          {isRtl ? (emp.status === 'active' ? 'نشط' : emp.status === 'on-leave' ? 'في إجازة' : 'منتهي') : emp.status.toUpperCase()}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-emerald-600 text-lg">
                      {showSalaries ? emp.basicSalary?.toLocaleString() : '••••'}
                    </TableCell>
                    <TableCell className="text-center pe-8" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                         {check('hr', 'delete').can && (
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="text-destructive hover:bg-destructive/5 rounded-xl"
                             disabled={loadingAction === emp.id}
                             onClick={() => setDeletingId(emp.id!)}
                           >
                             {loadingAction === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                           </Button>
                         )}
                         <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                           <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
                         </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-8" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
               <AlertTriangle className="h-8 w-8" />
            </div>
            <AlertDialogTitle className="text-start font-black text-2xl">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold">
              {isRtl ? 'هل أنت متأكد؟ سيتم حذف ملف الموظف وسجلاته المالية فوراً ولا يمكن التراجع.' : 'Are you sure? Employee profile and financial records will be deleted immediately.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="rounded-xl h-12 font-bold border-2">{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl h-12 font-black bg-rose-600 hover:bg-rose-700 text-white px-8">
              {isRtl ? 'نعم، احذف السجل' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
