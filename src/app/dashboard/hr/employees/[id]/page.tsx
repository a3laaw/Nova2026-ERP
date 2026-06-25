
'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, AlertCircle, 
  History, ShieldCheck, FileText, Ban,
  AlertTriangle, Lock
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { HRService } from '@/services/hr-service';
import { Employee, EmployeeAuditLog } from '@/types/hr';
import { EmployeeForm } from '@/components/hr/employee-form';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SmartDateInput } from '@/components/ui/smart-date-input';

export default function EmployeeDetailsPage() {
  const params = useParams();
  const empId = params.id as string;
  const { user, globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [saving, setSaving] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [termForm, setTermForm] = useState({ reason: '', date: new Date().toISOString().split('T')[0] });
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);

  const canEdit = check('hr', 'edit').can;
  const isViewingSelf = globalUser?.employeeId === empId;
  const isReadOnly = !canEdit || (isViewingSelf && !isAdmin);

  const companyId = globalUser?.companyId;
  const hrService = useMemo(() => 
    db && companyId ? new HRService(db, companyId) : null, 
  [db, companyId]);

  const empRef = useMemo(() => companyId && db ? doc(db, paths.employees(companyId), empId) : null, [db, companyId, empId]);
  const logsQuery = useMemo(() => companyId && db ? query(collection(db, `${paths.employees(companyId)}/${empId}/auditLogs`), orderBy('createdAt', 'desc')) : null, [db, companyId, empId]);

  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);
  const { data: logs, loading: logsLoading } = useCollection<EmployeeAuditLog>(logsQuery);

  const handleUpdate = async (data: any) => {
    if (!hrService || !user || isReadOnly) return;
    setSaving(true);
    try {
      await hrService.updateEmployee(empId, data, { uid: user.uid, name: user.displayName || 'Admin' });
      toast({ title: t('saved') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleTerminate = async () => {
    if (!hrService || !user || !termForm.reason || isReadOnly) return;
    setTerminating(true);
    try {
      await hrService.terminateEmployee(empId, termForm.reason, termForm.date, { uid: user.uid, name: user.displayName || 'Admin' });
      toast({ title: isRtl ? 'تم إنهاء الخدمة' : 'Service Terminated' });
      setIsTerminateOpen(false);
      router.push('/dashboard/hr/employees');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setTerminating(false);
    }
  };

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!employee) return <div className="p-20 text-center"><AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" /><h2 className="text-2xl font-black">{isRtl ? 'الموظف غير موجود' : 'Employee Not Found'}</h2></div>;

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="text-start">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black font-headline">{employee.fullName}</h1>
              <Badge className={cn(
                "font-black px-3 py-1 rounded-lg border-0 shadow-sm",
                employee.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              )}>
                 {isRtl ? (employee.status === 'active' ? 'نشط' : 'منتهي الخدمة') : employee.status.toUpperCase()}
              </Badge>
            </div>
            <div className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
               <ShieldCheck className="h-3 w-3 text-primary" /> 
               {isRtl ? 'رقم الموظف:' : 'Emp #:'} <span className="font-mono text-slate-800">{employee.employeeNumber}</span>
               <div className="h-1 w-1 rounded-full bg-slate-300" />
               <span className="uppercase text-[9px] font-black">{employee.jobTitle}</span>
            </div>
          </div>
        </div>

        {!isReadOnly && employee.status === 'active' && (
          <Dialog open={isTerminateOpen} onOpenChange={setIsTerminateOpen}>
             <DialogTrigger asChild>
                <Button variant="destructive" className="rounded-xl font-bold h-12 gap-2 shadow-lg shadow-rose-200">
                   <Ban className="h-4 w-4" /> {isRtl ? 'إنهاء الخدمة' : 'Terminate'}
                </Button>
             </DialogTrigger>
             <DialogContent className="rounded-[2rem] max-w-lg p-0 overflow-hidden" dir={dir}>
                <div className="bg-rose-50 p-8 border-b text-start">
                   <DialogTitle className="font-black text-rose-800 flex items-center gap-2">
                      <AlertTriangle className="h-6 w-6" /> {isRtl ? 'تأكيد إنهاء الخدمة' : 'Confirm Termination'}
                   </DialogTitle>
                   <DialogDescription className="mt-1 font-bold text-rose-600/70">
                      {isRtl ? 'تنبيه: سيتم إيقاف صرف الرواتب وتعطيل وصول الموظف للنظام فوراً.' : 'Warning: Payroll and system access will be disabled immediately.'}
                   </DialogDescription>
                </div>
                <div className="p-8 space-y-6 text-start">
                   <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ الإنهاء' : 'Effective Date'}</Label>
                      <SmartDateInput value={termForm.date} onChange={v => setTermForm({...termForm, date: v})} />
                   </div>
                   <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{isRtl ? 'سبب إنهاء الخدمة' : 'Reason'}</Label>
                      <Textarea value={termForm.reason} onChange={e => setTermForm({...termForm, reason: e.target.value})} className="rounded-xl border-2 min-h-[100px]" placeholder="..." />
                   </div>
                </div>
                <DialogFooter className="p-8 bg-slate-50 border-t">
                   <Button onClick={handleTerminate} disabled={terminating || !termForm.reason} className="w-full h-14 rounded-xl font-black text-lg bg-rose-600 text-white shadow-xl shadow-rose-200">
                      {terminating ? <Loader2 className="animate-spin" /> : (isRtl ? 'تأكيد الإنهاء النهائي' : 'Confirm Termination')}
                   </Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <EmployeeForm 
            initialData={employee} 
            onSubmit={handleUpdate} 
            loading={saving} 
            readOnly={isReadOnly}
          />
        </div>

        <div className="space-y-6">
           {canEdit && (
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                <CardHeader className="bg-slate-50 border-b p-8 text-start">
                   <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-900">
                      <History className="h-5 w-5 text-primary" />
                      {isRtl ? 'سجل التدقيق (Audit)' : 'Audit History'}
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="max-h-[600px] overflow-y-auto">
                      {logsLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                        <div className="divide-y divide-slate-100">
                           {logs?.length === 0 ? (
                             <div className="p-10 text-center text-slate-500 italic text-xs">{isRtl ? 'لا يوجد تغييرات مسجلة.' : 'No audit logs found.'}</div>
                           ) : (
                             logs?.map((log) => (
                               <div key={log.id} className="p-6 space-y-3 hover:bg-slate-50 transition-colors text-start">
                                  <div className="flex justify-between items-start">
                                     <Badge variant="outline" className={cn(
                                       "text-[9px] font-black uppercase",
                                       log.action === 'terminate' ? "border-rose-500 text-rose-500" : "border-primary/50 text-primary"
                                     )}>
                                        {log.action}
                                     </Badge>
                                     <span className="text-[10px] font-mono text-slate-400">{log.createdAt?.toDate().toLocaleDateString()}</span>
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold text-slate-600">
                                        {isRtl ? 'تغيير في' : 'Changed'} <span className="text-slate-900 font-black">{log.field}</span>
                                     </p>
                                  </div>
                               </div>
                             ))
                           )}
                        </div>
                      )}
                   </div>
                </CardContent>
              </Card>
           )}
        </div>
      </div>
    </div>
  );
}
