'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, CheckCircle2, ShieldCheck, 
  ArrowRight, Loader2, DollarSign, Printer,
  FileText, History, TrendingDown, TrendingUp,
  CreditCard, User, MoreHorizontal, Ban
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { PayrollBatch, PayrollRecord } from '@/types/payroll';
import { PayrollService } from '@/services/payroll-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function PayrollDetailsPage() {
  const params = useParams();
  const batchId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [processing, setProcessing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);

  const batchRef = useMemo(() => companyId && db ? doc(db, paths.payroll(companyId), batchId) : null, [db, companyId, batchId]);
  const recordsQuery = useMemo(() => companyId && db ? collection(db, `${paths.payroll(companyId)}/${batchId}/records`) : null, [db, companyId, batchId]);

  const { data: batch, loading: batchLoading } = useDoc<PayrollBatch>(batchRef);
  const { data: records, loading: recordsLoading } = useCollection<PayrollRecord>(recordsQuery);

  const handleAction = async (status: PayrollBatch['status']) => {
    if (!db || !companyId || !user) return;
    setProcessing(true);
    try {
      const service = new PayrollService(db, companyId);
      await service.updateBatchStatus(batchId, status, user.uid);
      toast({ title: t('saved') });
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessing(false);
    }
  };

  if (batchLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!batch) return <div className="p-20 text-center">{isRtl ? 'الكشف غير موجود' : 'Batch not found'}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.push('/dashboard/hr/payroll')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تفاصيل كشف الرواتب' : 'Payroll Batch Details'}</h1>
                <Badge className={cn(
                  "font-black px-4 py-1 rounded-xl shadow-sm uppercase",
                  batch.status === 'paid' ? 'bg-emerald-500 text-white' : 
                  batch.status === 'approved' ? 'bg-blue-500 text-white' : 
                  batch.status === 'reviewed' ? 'bg-amber-500 text-white' :
                  'bg-slate-200 text-slate-600'
                )}>
                   {batch.status}
                </Badge>
             </div>
             <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-primary" /> {isRtl ? 'دورة الرواتب لـ:' : 'Cycle:'} <span className="font-mono text-slate-800">{batch.month} / {batch.year}</span>
             </p>
           </div>
        </div>

        <div className="flex gap-3">
           <Button variant="outline" className="rounded-xl font-bold h-12 gap-2 border-2"><Printer className="h-4 w-4" /> {isRtl ? 'طباعة الكشف' : 'Print List'}</Button>
           
           {batch.status === 'draft' && (
             <Button onClick={() => handleAction('reviewed')} disabled={processing} className="bg-amber-500 text-white font-black rounded-xl h-12 px-6">
                {processing ? <Loader2 className="animate-spin" /> : (isRtl ? 'إرسال للمراجعة' : 'Mark Reviewed')}
             </Button>
           )}
           {batch.status === 'reviewed' && (
             <Button onClick={() => handleAction('approved')} disabled={processing} className="bg-blue-600 text-white font-black rounded-xl h-12 px-6">
                {processing ? <Loader2 className="animate-spin" /> : (isRtl ? 'اعتماد الدفعة' : 'Approve Batch')}
             </Button>
           )}
           {batch.status === 'approved' && (
             <Button onClick={() => handleAction('paid')} disabled={processing} className="bg-emerald-600 text-white font-black rounded-xl h-12 px-6">
                {processing ? <Loader2 className="animate-spin" /> : (isRtl ? 'تسجيل كمدفوع' : 'Mark as Paid')}
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'صافي الرواتب' : 'Net Salary'}</p>
            <h3 className="text-3xl font-black text-emerald-600">{batch.totalNetSalary.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-rose-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'الخصومات والجزاءات' : 'Deductions'}</p>
            <h3 className="text-3xl font-black text-rose-600">{batch.totalDeductions.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي المستحقات' : 'Gross'}</p>
            <h3 className="text-3xl font-black text-blue-600">{(batch.totalBasicSalary + batch.totalAllowances).toLocaleString()}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-primary">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'القوى العاملة' : 'Employees'}</p>
            <h3 className="text-3xl font-black text-primary">{batch.totalEmployees}</h3>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                 <CardTitle className="text-xl font-black">{isRtl ? 'كشف الموظفين التفصيلي' : 'Employee Records'}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                    <TableHeader className="bg-muted/30">
                       <TableRow>
                          <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                          <TableHead className="text-end">{isRtl ? 'الأساسي' : 'Basic'}</TableHead>
                          <TableHead className="text-end">{isRtl ? 'الخصومات' : 'Deductions'}</TableHead>
                          <TableHead className="text-end">{isRtl ? 'الصافي' : 'Net'}</TableHead>
                          <TableHead className="pe-8"></TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {recordsLoading ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                       ) : (
                         records?.map((rec) => (
                           <TableRow key={rec.id} className="hover:bg-slate-50 transition-colors group">
                              <TableCell className="py-4 ps-8 text-start">
                                 <div className="flex flex-col">
                                    <span className="font-black text-slate-800 text-sm">{rec.employeeName}</span>
                                    <span className="text-[10px] font-mono text-slate-400">#{rec.employeeNumber}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-end font-mono text-xs font-bold text-slate-500">{rec.basicSalary?.toLocaleString()}</TableCell>
                              <TableCell className="text-end">
                                 <span className={cn("font-black text-xs", (rec.deductions || 0) > 0 ? "text-rose-600" : "text-slate-400")}>
                                    {rec.deductions?.toLocaleString()}
                                 </span>
                              </TableCell>
                              <TableCell className="text-end">
                                 <span className="font-black text-emerald-600 text-sm">{rec.netSalary?.toLocaleString()}</span>
                              </TableCell>
                              <TableCell className="pe-8 text-center">
                                 <Dialog>
                                    <DialogTrigger asChild>
                                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white">
                                          <FileText className="h-4 w-4" />
                                       </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl rounded-[3rem] p-0 overflow-hidden" dir={dir}>
                                       <div className="bg-primary/5 p-10 border-b text-start">
                                          <div className="flex justify-between items-start">
                                             <div className="space-y-1">
                                                <h2 className="text-2xl font-black font-headline">{isRtl ? 'قسيمة راتب' : 'Payslip'}</h2>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{rec.employeeName} | {batch.month}-{batch.year}</p>
                                             </div>
                                             <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-primary">
                                                <DollarSign className="h-8 w-8" />
                                             </div>
                                          </div>
                                       </div>
                                       <div className="p-10 space-y-8 text-start">
                                          <div className="grid grid-cols-2 gap-10">
                                             <div className="space-y-6">
                                                <h4 className="font-black text-sm text-emerald-600 uppercase border-b pb-2">{isRtl ? 'المستحقات' : 'Earnings'}</h4>
                                                <div className="space-y-3">
                                                   <div className="flex justify-between text-xs font-bold"><span>{isRtl ? 'الراتب الأساسي' : 'Basic Salary'}</span><span>{rec.basicSalary.toLocaleString()}</span></div>
                                                   <div className="flex justify-between text-xs font-bold"><span>{isRtl ? 'البدلات' : 'Allowances'}</span><span>{rec.allowances.toLocaleString()}</span></div>
                                                </div>
                                             </div>
                                             <div className="space-y-6">
                                                <h4 className="font-black text-sm text-rose-600 uppercase border-b pb-2">{isRtl ? 'الاستقطاعات' : 'Deductions'}</h4>
                                                <div className="space-y-3">
                                                   <div className="flex justify-between text-xs font-bold"><span>{isRtl ? 'الغياب والتأخير' : 'Absence & Late'}</span><span className="text-rose-600">{rec.deductions.toLocaleString()}</span></div>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 flex justify-between items-center">
                                             <div className="text-start">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'صافي المبلغ المصروف' : 'Total Net Payable'}</p>
                                                <p className="text-3xl font-black text-emerald-600">{rec.netSalary.toLocaleString()} <span className="text-xs">KWD</span></p>
                                             </div>
                                             <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                                                <CheckCircle2 className="h-8 w-8" />
                                             </div>
                                          </div>
                                       </div>
                                    </DialogContent>
                                 </Dialog>
                              </TableCell>
                           </TableRow>
                         ))
                       )}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
              <CardHeader className="bg-slate-50 border-b p-6">
                <CardTitle className="text-sm font-black flex items-center gap-2"><History className="h-4 w-4 text-primary" /> {isRtl ? 'سجل العمليات' : 'Batch Logs'}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                 <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px]">
                       <span className="font-bold text-slate-400 uppercase">{isRtl ? 'تاريخ التوليد' : 'Generated'}</span>
                       <span className="font-black text-slate-700">{batch.createdAt?.toDate().toLocaleDateString()}</span>
                    </div>
                    {batch.reviewedAt && (
                      <div className="flex justify-between items-center text-[10px]">
                         <span className="font-bold text-amber-600 uppercase">{isRtl ? 'تمت المراجعة' : 'Reviewed'}</span>
                         <span className="font-black text-slate-700">{batch.reviewedAt?.toDate().toLocaleDateString()}</span>
                      </div>
                    )}
                    {batch.approvedAt && (
                      <div className="flex justify-between items-center text-[10px]">
                         <span className="font-bold text-blue-600 uppercase">{isRtl ? 'الاعتماد النهائي' : 'Approved'}</span>
                         <span className="font-black text-slate-700">{batch.approvedAt?.toDate().toLocaleDateString()}</span>
                      </div>
                    )}
                 </div>
              </CardContent>
           </Card>

           <Card className="border-2 border-dashed border-primary/20 rounded-[2.5rem] bg-primary/5 p-8 text-start space-y-4">
              <div className="flex items-center gap-3 text-primary">
                 <ShieldCheck className="h-6 w-6" />
                 <h4 className="font-black text-sm uppercase tracking-widest">{isRtl ? 'الأثر المحاسبي' : 'Accounting Impact'}</h4>
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed font-bold">
                 {isRtl ? '• عند تغيير الحالة إلى "مدفوع"، سيقوم النظام آلياً بتوليد مسودة قيد يومية تتضمن كافة الرواتب والخصومات والبدلات.' : '• When marked as PAID, a journal entry draft will be auto-generated with all salaries and deductions.'}
              </p>
           </Card>
        </div>
      </div>
    </div>
  );
}
