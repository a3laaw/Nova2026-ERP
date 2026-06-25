
'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, ShieldCheck, 
  Loader2, DollarSign, Printer,
  FileText, History, 
  CreditCard
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
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي المستحق' : 'Gross'}</p>
            <h3 className="text-3xl font-black text-blue-600">{(batch.totalBasicSalary + batch.totalAllowances).toLocaleString()}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-primary">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'القوى العاملة' : 'Employees'}</p>
            <h3 className="text-3xl font-black text-primary">{batch.totalEmployees}</h3>
         </Card>
      </div>
    </div>
  );
}
