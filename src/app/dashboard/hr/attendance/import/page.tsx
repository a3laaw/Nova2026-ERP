'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, 
  AlertTriangle, ArrowRight, Save, X, Info,
  Clock, Download, Table as TableIcon, Plus
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
  const { globalUser } = useAuthContext();
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

  const downloadTemplate = () => {
    const headers = isRtl 
      ? "رقم_الموظف,التاريخ,دخول_1,خروج_1,دخول_2,خروج_2" 
      : "EmployeeNum,Date,In1,Out1,In2,Out2";
    
    const rows = [
      "1001,2026-01-01,08:00,13:00,14:00,17:00",
      "1002,2026-01-01,08:15,13:05,14:10,17:15",
      "1001,2026-01-02,07:55,17:00,,"
    ];
    
    const csvContent = "\uFEFF" + headers + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", isRtl ? "نموذج_الحضور_المطور.csv" : "NovaFlow_Attendance_Pro.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: isRtl ? "تم تحميل النموذج المطور" : "Pro Template Downloaded" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !companyId || !employees) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) throw new Error(isRtl ? 'الملف فارغ أو لا يحتوي على بيانات.' : 'File is empty or lacks data.');

        const rows: RawAttendanceRow[] = lines.slice(1).map(line => {
          const parts = line.split(/[;,]/).map(s => s.trim().replace(/^["']|["']$/g, ''));
          return { 
            employeeNumber: parts[0] || '', 
            date: parts[1] || '', 
            checkIn: parts[2] || '', 
            checkOut: parts[3] || '',
            checkIn2: parts[4] || '',
            checkOut2: parts[5] || ''
          };
        });

        const whService = new WorkHoursService(db, companyId);
        let settings = await whService.getSettings();
        if (!settings) settings = whService.getDefaultSettings() as any;

        const importService = new AttendanceImportService(db, companyId);
        const result = await importService.processImport(rows, employees, settings!);
        setPreview(result);
        
        if (result.errors.length > 0) {
          toast({ 
            variant: "destructive", 
            title: isRtl ? "تنبيه: أخطاء في البيانات" : "Data Warnings", 
            description: isRtl ? `تم العثور على ${result.errors.length} سطر غير متوافق.` : `Found ${result.errors.length} invalid rows.`
          });
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: t('error'), description: err.message });
      } finally {
        setImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleSave = async () => {
    if (!preview || !db || !companyId) return;
    setSaving(true);
    try {
      const importService = new AttendanceImportService(db, companyId);
      await importService.saveRecords(preview.records.filter(r => r.employeeId));
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
            {isRtl ? 'استيراد البصمة المطور' : 'Pro Attendance Import'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'دعم تلقائي للفترتين بناءً على إعدادات شركتك.' : 'Auto-supports double shifts based on company rules.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="rounded-xl font-black border-2 h-14 px-8 gap-3 bg-white hover:bg-slate-50 shadow-sm"
        >
          <Download className="h-5 w-5 text-primary" />
          {isRtl ? 'تحميل النموذج (6 أعمدة)' : 'Download 6-Column Template'}
        </Button>
      </div>

      {!preview ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <Card className="lg:col-span-2 border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-2xl">
              <CardContent className="p-16 text-center space-y-8">
                <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mb-6">
                  <UploadCloud className="h-12 w-12 animate-bounce" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black">{isRtl ? 'ارفع ملف الحضور المطور' : 'Upload Pro Attendance File'}</h2>
                  <p className="text-slate-400 font-bold max-w-md mx-auto">{isRtl ? 'النظام سيقوم بدمج تأخير الفترة الصباحية والمسائية تلقائياً.' : 'The system will merge morning and evening lateness automatically.'}</p>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                   <label className="cursor-pointer group">
                      <div className="bg-primary text-white font-black px-16 py-6 rounded-2xl text-xl shadow-xl shadow-primary/20 group-hover:scale-105 transition-all flex items-center gap-3">
                        {importing ? <Loader2 className="animate-spin h-8 w-8" /> : <Plus className="h-8 w-8" />}
                        {isRtl ? 'اختر ملف CSV' : 'Select CSV File'}
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={importing} />
                   </label>
                </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
              <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                 <CardTitle className="text-lg font-black flex items-center gap-3">
                    <TableIcon className="h-5 w-5 text-primary" />
                    {isRtl ? 'مصفوفة الأعمدة' : 'Column Matrix'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4 text-start">
                 {[
                   { label: isRtl ? '1. رقم الموظف' : '1. Emp Num' },
                   { label: isRtl ? '2. التاريخ' : '2. Date' },
                   { label: isRtl ? '3. دخول صباحي' : '3. Morning In' },
                   { label: isRtl ? '4. خروج صباحي' : '4. Morning Out' },
                   { label: isRtl ? '5. دخول مسائي' : '5. Evening In' },
                   { label: isRtl ? '6. خروج مسائي' : '6. Evening Out' }
                 ].map((col, i) => (
                   <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-xs font-bold">{col.label}</span>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 opacity-50" />
                   </div>
                 ))}
                 <p className="text-[9px] text-slate-500 italic mt-4">{isRtl ? '* اترك أعمدة المساء فارغة إذا لم يكن لديك شفت ثانٍ.' : '* Leave evening columns empty if you have a single shift.'}</p>
              </CardContent>
           </Card>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
               <CardTitle className="text-xl font-black">{isRtl ? 'معاينة التحليل الذكي' : 'Analysis Preview'}</CardTitle>
               <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setPreview(null)} className="rounded-xl font-black h-12">
                     <X className="me-2 h-4 w-4" /> {isRtl ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-emerald-600 text-white font-black rounded-xl h-12 px-10 shadow-xl shadow-emerald-100"
                  >
                     {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="me-2 h-5 w-5" />}
                     {isRtl ? 'اعتماد الحفظ' : 'Commit Batch'}
                  </Button>
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[600px] overflow-y-auto text-start">
               <Table>
                 <TableHeader className="bg-muted/30 sticky top-0 z-10">
                   <TableRow>
                     <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'البصمات' : 'Punches'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'إجمالي التأخير' : 'Total Late'}</TableHead>
                     <TableHead className="text-start pe-8">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {preview.records.map((rec, i) => (
                     <TableRow key={i} className="hover:bg-slate-50">
                       <TableCell className="py-4 ps-8 text-start font-black text-sm">{rec.employeeName}</TableCell>
                       <TableCell className="text-start font-mono text-xs text-slate-500">{rec.date}</TableCell>
                       <TableCell className="text-center">
                          <div className="flex flex-col gap-1">
                             <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                                <span className="bg-slate-100 px-2 rounded">AM: {rec.checkIn || '--'}</span>
                                <span className="bg-slate-100 px-2 rounded">PM: {rec.checkIn2 || '--'}</span>
                             </div>
                          </div>
                       </TableCell>
                       <TableCell className="text-center">
                          {rec.minutesLate && rec.minutesLate > 0 ? (
                            <Badge variant="destructive" className="bg-rose-50 text-rose-600 font-black border-0">
                               {rec.minutesLate} min
                            </Badge>
                          ) : <span className="text-emerald-500 font-black text-xs">ON TIME</span>}
                       </TableCell>
                       <TableCell className="pe-8">
                          <Badge className={cn(
                            "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                            rec.status === 'present' ? 'bg-emerald-500 text-white' :
                            rec.status === 'late' ? 'bg-amber-500 text-white' :
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
