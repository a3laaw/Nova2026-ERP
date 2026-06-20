'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, 
  AlertTriangle, ArrowRight, Save, X, Info,
  Users, CalendarDays, Clock, Download
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { AttendanceImportService, ImportPreviewResult, RawAttendanceRow } from '@/services/attendance-import-service';
import { WorkHoursService } from '@/services/work-hours-service';
import { Employee } from '@/types/hr';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AttendanceImportPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees } = useCollection<Employee>(empsQuery);

  // دالة تحميل النموذج التجريبي
  const downloadTemplate = () => {
    const headers = "EmployeeNum,Date,CheckIn,CheckOut";
    const rows = [
      "1001,2026-01-01,08:00,17:00",
      "1002,2026-01-01,08:15,17:05",
      "1001,2026-01-02,07:55,16:50"
    ];
    const csvContent = "\uFEFF" + headers + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "NovaFlow_Attendance_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !companyId || !employees) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        const rows: RawAttendanceRow[] = lines.slice(1).map(line => {
          const [empNum, date, cin, cout] = line.split(',').map(s => s.trim());
          return { employeeNumber: empNum, date, checkIn: cin, checkOut: cout };
        });

        const whService = new WorkHoursService(db, companyId);
        const settings = await whService.getSettings();
        
        if (!settings) throw new Error(isRtl ? 'يرجى ضبط إعدادات ساعات العمل أولاً.' : 'Please set work hours settings first.');

        const importService = new AttendanceImportService(db, companyId);
        const result = await importService.processImport(rows, employees, settings);
        setPreview(result);
        
        toast({ title: isRtl ? 'تم تحليل الملف' : 'File Analyzed' });
      } catch (err: any) {
        toast({ variant: "destructive", title: t('error'), description: err.message });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!preview || !db || !companyId) return;
    setSaving(true);
    try {
      const importService = new AttendanceImportService(db, companyId);
      await importService.saveRecords(preview.records);
      toast({ title: t('saved'), description: isRtl ? 'تم استيراد سجلات الحضور بنجاح.' : 'Attendance records imported successfully.' });
      router.push('/dashboard/hr');
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            {isRtl ? 'استيراد سجلات الحضور' : 'Import Attendance'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'تحويل ملفات البصمة إلى بيانات تشغيلية' : 'Transform biometric files into operational data'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="rounded-xl font-bold border-2 h-12 gap-2 hover:bg-slate-50 transition-all"
        >
          <Download className="h-4 w-4" />
          {isRtl ? 'تحميل نموذج Excel' : 'Download Template'}
        </Button>
      </div>

      {!preview ? (
        <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-2xl">
          <CardContent className="p-20 text-center space-y-8">
            <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mb-6">
              <UploadCloud className="h-12 w-12 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black">{isRtl ? 'ارفع ملف سجلات البصمة (CSV)' : 'Upload Biometric CSV File'}</h2>
              <p className="text-slate-400 font-bold">{isRtl ? 'تنسيق الملف المعتمد: رقم الموظف، التاريخ، الدخول، الخروج' : 'Format: EmpNum, Date, In, Out'}</p>
            </div>
            
            <div className="flex flex-col items-center gap-4">
               <label className="cursor-pointer group">
                  <div className="bg-primary text-white font-black px-12 py-6 rounded-2xl text-xl shadow-xl shadow-primary/20 group-hover:scale-105 transition-all">
                    {importing ? <Loader2 className="animate-spin h-8 w-8" /> : (isRtl ? 'اختر الملف الآن' : 'Select File')}
                  </div>
                  <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={importing} />
               </label>
               <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                 <Info className="h-3 w-3" />
                 {isRtl ? 'سيتم تجاهل العناوين في الصف الأول تلقائياً.' : 'Header row will be ignored automatically.'}
               </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             {[
               { label: isRtl ? 'إجمالي السجلات' : 'Total', val: preview.summary.total, icon: FileSpreadsheet, color: 'text-blue-600', bg: 'bg-blue-50' },
               { label: isRtl ? 'جاهز للاستيراد' : 'Valid', val: preview.summary.valid, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
               { label: isRtl ? 'أخطاء مطابقة' : 'Errors', val: preview.summary.invalid, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
               { label: isRtl ? 'حالات تأخير' : 'Late Cases', val: preview.summary.late, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
             ].map((stat, i) => (
               <Card key={i} className="border-0 shadow-lg rounded-[2rem] p-6 text-start flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
                    <h3 className={cn("text-3xl font-black font-headline", stat.color)}>{stat.val}</h3>
                  </div>
                  <div className={cn("p-4 rounded-2xl", stat.bg, stat.color)}>
                    <stat.icon className="h-6 w-6" />
                  </div>
               </Card>
             ))}
          </div>

          {preview.errors.length > 0 && (
            <Card className="border-2 border-rose-100 bg-rose-50/30 rounded-[2rem] overflow-hidden">
               <CardHeader className="bg-rose-50 p-6 border-b border-rose-100 flex flex-row items-center gap-3">
                  <AlertTriangle className="text-rose-600 h-5 w-5" />
                  <CardTitle className="text-sm font-black text-rose-800">{isRtl ? 'تنبيه: أخطاء في الملف' : 'Validation Errors'}</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <ul className="space-y-1">
                    {preview.errors.map((err, i) => (
                      <li key={i} className="text-xs font-bold text-rose-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        السطر {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
               </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
               <CardTitle className="text-xl font-black">{isRtl ? 'معاينة البيانات قبل الحفظ' : 'Data Preview'}</CardTitle>
               <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setPreview(null)} className="rounded-xl font-bold border-2 h-12">
                     <X className="me-2 h-4 w-4" /> {isRtl ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || preview.summary.valid === 0}
                    className="bg-emerald-600 text-white font-black rounded-xl h-12 px-8 shadow-xl shadow-emerald-100 hover:scale-105 transition-all"
                  >
                     {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="me-2 h-5 w-5" />}
                     {isRtl ? 'اعتماد وحفظ السجلات' : 'Commit Records'}
                  </Button>
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[600px] overflow-y-auto">
               <Table>
                 <TableHeader className="bg-muted/30 sticky top-0 z-10">
                   <TableRow>
                     <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'دخول / خروج' : 'In / Out'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'التأخير' : 'Late (m)'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {preview.records.map((rec, i) => (
                     <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                       <TableCell className="py-4 ps-8 text-start">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-sm">{rec.employeeName}</span>
                            <span className="text-[10px] font-mono text-slate-400">#{rec.employeeNumber}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-start font-mono text-xs font-bold text-slate-500">{rec.date}</TableCell>
                       <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 text-xs font-black text-slate-700">
                             <span className="bg-slate-100 px-2 py-1 rounded-md">{rec.checkIn || '--:--'}</span>
                             <ArrowRight className={cn("h-3 w-3 opacity-20", isRtl && "rotate-180")} />
                             <span className="bg-slate-100 px-2 py-1 rounded-md">{rec.checkOut || '--:--'}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-center">
                          {rec.minutesLate && rec.minutesLate > 0 ? (
                            <Badge variant="destructive" className="bg-rose-50 text-rose-600 font-black border-0">
                               {rec.minutesLate} min
                            </Badge>
                          ) : <span className="text-slate-300">-</span>}
                       </TableCell>
                       <TableCell className="text-start">
                          <Badge className={cn(
                            "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                            rec.status === 'present' ? 'bg-emerald-500 text-white' :
                            rec.status === 'late' ? 'bg-amber-50 text-amber-600' :
                            rec.status === 'holiday' || rec.status === 'weekend' ? 'bg-blue-100 text-blue-600' :
                            'bg-rose-500 text-white'
                          )}>
                             {rec.status}
                          </Badge>
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
