'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, Sparkles, Loader2, CheckCircle2, 
  AlertTriangle, ArrowRight, Save, X, Info,
  TrendingDown, TrendingUp, DollarSign, RefreshCw
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { PayrollService } from '@/services/payroll-service';
import { PayrollRecord } from '@/types/payroll';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewPayrollBatchPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [drafts, setDrafts] = useState<Partial<PayrollRecord>[] | null>(null);

  const handleGenerate = async () => {
    if (!db || !companyId) return;
    setLoading(true);
    try {
      const service = new PayrollService(db, companyId);
      const data = await service.calculateDrafts(Number(month) + 1, Number(year));
      setDrafts(data);
      toast({ title: isRtl ? 'تم توليد المسودة' : 'Draft Generated' });
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!drafts || !db || !companyId || !user) return;
    setSaving(true);
    try {
      const service = new PayrollService(db, companyId);
      await service.saveBatch(Number(month) + 1, Number(year), drafts, user.uid);
      toast({ title: t('saved'), description: isRtl ? 'تم حفظ مسودة الرواتب بنجاح.' : 'Payroll draft saved successfully.' });
      router.push('/dashboard/hr/payroll');
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    if (!drafts) return { net: 0, deductions: 0, basic: 0 };
    return {
      net: drafts.reduce((acc, r) => acc + (r.netSalary || 0), 0),
      deductions: drafts.reduce((acc, r) => acc + (r.deductions || 0), 0),
      basic: drafts.reduce((acc, r) => acc + (r.basicSalary || 0), 0),
    };
  }, [drafts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Sparkles className="h-10 w-10 text-primary" />
            {isRtl ? 'توليد الرواتب الذكي' : 'Smart Payroll Generator'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'دمج بيانات الحضور والإجازات في كشوف مالية دقيقة' : 'Merge attendance and leave data into precise financial statements'}
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-10 flex flex-col md:flex-row items-end gap-6 bg-slate-50/50">
           <div className="space-y-2 text-start flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الشهر المستهدف' : 'Target Month'}</label>
              <Select value={month} onValueChange={setMonth}>
                 <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                       <SelectItem key={i} value={i.toString()} className="font-bold">
                          {new Date(0, i).toLocaleString(lang === 'ar' ? 'ar-KW' : 'en-US', { month: 'long' })}
                       </SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>
           <div className="space-y-2 text-start flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'السنة' : 'Year'}</label>
              <Select value={year} onValueChange={setYear}>
                 <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                    {[2024, 2025, 2026].map(y => (
                       <SelectItem key={y} value={y.toString()} className="font-bold">{y}</SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>
           <Button 
             onClick={handleGenerate} 
             disabled={loading}
             className="h-14 rounded-2xl px-10 bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2"
           >
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
              {isRtl ? 'توليد المسودة الآن' : 'Generate Draft'}
           </Button>
        </CardContent>
      </Card>

      {drafts && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-emerald-500">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'صافي الرواتب المتوقع' : 'Expected Net'}</p>
                 <h3 className="text-3xl font-black text-emerald-600">{totals.net.toLocaleString()} <span className="text-xs">KWD</span></h3>
              </Card>
              <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-rose-500">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي الخصومات' : 'Total Deductions'}</p>
                 <h3 className="text-3xl font-black text-rose-600">{totals.deductions.toLocaleString()} <span className="text-xs">KWD</span></h3>
              </Card>
              <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white border-b-4 border-blue-500">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'عدد الموظفين' : 'Employees'}</p>
                 <h3 className="text-3xl font-black text-blue-600">{drafts.length}</h3>
              </Card>
           </div>

           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                 <div>
                    <CardTitle className="text-xl font-black">{isRtl ? 'معاينة مسودة الرواتب' : 'Payroll Draft Preview'}</CardTitle>
                    <CardDescription className="font-bold">{isRtl ? 'مراجعة المبالغ والخصومات المبررة وغير المبررة' : 'Review amounts and justified/unjustified deductions'}</CardDescription>
                 </div>
                 <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setDrafts(null)} className="rounded-xl font-bold border-2 h-12">
                       <X className="me-2 h-4 w-4" /> {isRtl ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={saving}
                      className="bg-emerald-600 text-white font-black rounded-xl h-12 px-8 shadow-xl shadow-emerald-100 hover:scale-105 transition-all"
                    >
                       {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="me-2 h-5 w-5" />}
                       {isRtl ? 'حفظ المسودة' : 'Save Draft Batch'}
                    </Button>
                 </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto max-h-[600px] overflow-y-auto">
                 <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                       <TableRow>
                          <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                          <TableHead className="text-end">{isRtl ? 'الأساسي' : 'Basic'}</TableHead>
                          <TableHead className="text-end">{isRtl ? 'الخصومات' : 'Deductions'}</TableHead>
                          <TableHead className="text-center">{isRtl ? 'غياب غير مبرر' : 'Unjustified'}</TableHead>
                          <TableHead className="text-end">{isRtl ? 'الصافي' : 'Net'}</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {drafts.map((rec, i) => (
                         <TableRow key={i} className="hover:bg-slate-50 transition-colors">
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
                            <TableCell className="text-center">
                               {rec.unjustifiedAbsenceDays && rec.unjustifiedAbsenceDays > 0 ? (
                                 <Badge variant="destructive" className="bg-rose-50 text-rose-600 font-black border-0 text-[10px]">
                                    {rec.unjustifiedAbsenceDays} {isRtl ? 'يوم' : 'Days'}
                                 </Badge>
                               ) : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="text-end">
                               <span className="font-black text-emerald-600 text-sm">{rec.netSalary?.toLocaleString()}</span>
                            </TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </div>
      )}
    </div>
  );
}
