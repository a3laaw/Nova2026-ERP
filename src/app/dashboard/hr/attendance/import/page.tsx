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
  Clock, Download, Table as TableIcon, Plus,
  CalendarDays
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
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  // حالات الفترة المستهدفة
  const [month, setMonth] = useState(new Date().getMonth().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2026; 
    const years = [];
    const limitYear = Math.max(startYear, currentYear) + 1;
    for (let y = startYear; y <= limitYear; y++) {
      years.push(y);
    }
    return years; // تمت إزالة الترتيب التنازلي لإظهار الأقدم أولاً
  }, []);

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const downloadTemplate = () => {
    const headers = [
      isRtl ? "رقم_الموظف" : "EmployeeNum",
      isRtl ? "التاريخ" : "Date",
      isRtl ? "دخول_صباحي" : "CheckIn1",
      isRtl ? "خروج_صباحي" : "CheckOut1",
      isRtl ? "دخول_مسائي" : "CheckIn2",
      isRtl ? "خروج_مسائي" : "CheckOut2"
    ];
    
    const data = [
      headers,
      ["1001", "2026-01-01", "08:00", "13:00", "14:00", "17:00"],
      ["1002", "2026-01-02", "08:15", "13:05", "", ""]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, isRtl ? "نموذج_حضور_نوفا.xlsx" : "NovaFlow_Attendance.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !companyId || !employees) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          raw: false, 
          dateNF: 'yyyy-mm-dd',
          defval: '' 
        }) as any[][];
        
        if (jsonData.length < 2) throw new Error(isRtl ? 'الملف فارغ أو غير صالح.' : 'File is empty or invalid.');

        const rows: RawAttendanceRow[] = jsonData.slice(1).map(row => ({
          employeeNumber: String(row[0] || '').trim(),
          date: String(row[1] || '').trim(),
          checkIn: String(row[2] || '').trim(),
          checkOut: String(row[3] || '').trim(),
          checkIn2: String(row[4] || '').trim(),
          checkOut2: String(row[5] || '').trim(),
        })).filter(r => r.employeeNumber && r.date);

        const whService = new WorkHoursService(db, companyId);
        let settings = await whService.getSettings();
        if (!settings) settings = whService.getDefaultSettings() as any;

        const importService = new AttendanceImportService(db, companyId);
        const result = await importService.processImport(
          rows, 
          employees, 
          settings!,
          Number(month) + 1,
          Number(year)
        );
        
        setPreview(result);
        
        if (result.errors.length > 0) {
          toast({ 
            variant: "destructive", 
            title: isRtl ? "تنبيهات في البيانات" : "Import Warnings", 
            description: isRtl ? `تم اكتشاف ${result.errors.length} خطأ أو عدم تطابق.` : `Found ${result.errors.length} errors or mismatches.`
          });
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: t('error'), description: err.message });
      } finally {
        setImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    if (!preview || !db || !companyId) return;
    setSaving(true);
    try {
      const importService = new AttendanceImportService(db, companyId);
      await importService.saveRecords(preview.records.filter(r => r.employeeId));
      toast({ title: t('saved'), description: isRtl ? 'تم الاستيراد بنجاح.' : 'Import successful.' });
      router.push('/dashboard/hr');
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  const monthName = new Date(0, Number(month)).toLocaleString(isRtl ? 'ar-KW' : 'en-US', { month: 'long' });

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            {isRtl ? 'استيراد الحضور الذكي (XLSX)' : 'Smart Attendance Import'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'يرجى تحديد الفترة المستهدفة قبل رفع الملف لضمان دقة البيانات.' : 'Please select target period before upload for data accuracy.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="rounded-xl font-black border-2 h-14 px-8 gap-3 bg-white shadow-sm hover:bg-slate-50 transition-all"
        >
          <Download className="h-5 w-5 text-primary" />
          {isRtl ? 'تحميل نموذج إكسيل' : 'Download Template'}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-8 flex flex-col md:flex-row items-end gap-6 bg-slate-50/50">
           <div className="space-y-2 text-start flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الشهر المستهدف' : 'Target Month'}</label>
              <Select value={month} onValueChange={setMonth} disabled={!!preview}>
                 <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-black text-lg">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                       <SelectItem key={i} value={i.toString()} className="font-bold">
                          {new Date(0, i).toLocaleString(isRtl ? 'ar-KW' : 'en-US', { month: 'long' })}
                       </SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>

           <div className="space-y-2 text-start flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'السنة المالية' : 'Fiscal Year'}</label>
              <Select value={year} onValueChange={setYear} disabled={!!preview}>
                 <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-black text-lg">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                    {yearsList.map(y => (
                       <SelectItem key={y} value={y.toString()} className="font-bold">{y}</SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>

           <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-3 flex-1 h-14">
              <CalendarDays className="h-5 w-5 text-primary" />
              <p className="text-[10px] font-black text-primary uppercase leading-tight">
                 {isRtl ? `سيتم فحص الملف لـ ${monthName} ${year}` : `Validating file for ${monthName} ${year}`}
              </p>
           </div>
        </CardContent>
      </Card>

      {!preview ? (
        <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white shadow-2xl">
           <CardContent className="p-16 text-center space-y-8">
             <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mb-6">
               <UploadCloud className="h-12 w-12" />
             </div>
             <div className="space-y-3">
               <h2 className="text-2xl font-black">{isRtl ? 'رفع ملف البصمة' : 'Upload Spreadsheet'}</h2>
               <p className="text-slate-400 font-bold max-w-md mx-auto">{isRtl ? 'اختر ملف الإكسيل الذي يحتوي على بصمات الموظفين للفترة المحددة.' : 'Select the Excel file containing fingerprints for the selected period.'}</p>
             </div>
             
             <div className="flex flex-col items-center gap-4">
                <label className="cursor-pointer group">
                   <div className="bg-primary text-white font-black px-16 py-6 rounded-2xl text-xl shadow-xl shadow-primary/20 group-hover:scale-105 transition-all flex items-center gap-3">
                     {importing ? <Loader2 className="animate-spin h-8 w-8" /> : <Plus className="h-8 w-8" />}
                     {isRtl ? 'اختيار ومعالجة الملف' : 'Select & Process File'}
                   </div>
                   <input 
                     type="file" 
                     className="hidden" 
                     accept=".xlsx, .xls, .csv" 
                     onChange={handleFileUpload} 
                     disabled={importing} 
                   />
                </label>
             </div>
           </CardContent>
        </Card>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
               <div className="text-start">
                  <CardTitle className="text-xl font-black">{isRtl ? `معاينة استيراد ${monthName} ${year}` : `Import Preview ${monthName} ${year}`}</CardTitle>
                  <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? `إجمالي السجلات الصالحة: ${preview.summary.valid}` : `Total valid records: ${preview.summary.valid}`}</p>
               </div>
               <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setPreview(null)} className="rounded-xl font-black h-12">
                     {isRtl ? 'إلغاء وإعادة اختيار' : 'Cancel & Reset'}
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || preview.summary.valid === 0}
                    className="bg-emerald-600 text-white font-black rounded-xl h-12 px-10 shadow-xl shadow-emerald-100"
                  >
                     {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="me-2 h-5 w-5" />}
                     {isRtl ? 'اعتماد وحفظ السجلات' : 'Confirm & Save'}
                  </Button>
               </div>
            </CardHeader>
            
            {preview.errors.length > 0 && (
              <div className="px-8 py-4 bg-rose-50 border-b border-rose-100 space-y-2 text-start">
                 <h5 className="font-black text-rose-600 text-xs flex items-center gap-2 uppercase tracking-widest">
                    <AlertTriangle className="h-4 w-4" /> {isRtl ? 'أخطاء وتنبيهات في الملف' : 'File Errors & Warnings'}
                 </h5>
                 <div className="max-h-24 overflow-y-auto">
                    {preview.errors.map((err, i) => (
                       <p key={i} className="text-[10px] text-rose-700 font-bold">• سطر {err.row}: {err.message}</p>
                    ))}
                 </div>
              </div>
            )}

            <CardContent className="p-0 overflow-x-auto max-h-[600px] overflow-y-auto text-start">
               <Table>
                 <TableHeader className="bg-muted/30 sticky top-0 z-10">
                   <TableRow>
                     <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'إجمالي التأخير' : 'Total Late'}</TableHead>
                     <TableHead className="text-start pe-8">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {preview.records.map((rec, i) => (
                     <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                       <TableCell className="py-4 ps-8 text-start font-black text-sm">{rec.employeeName}</TableCell>
                       <TableCell className="text-start font-mono text-xs text-slate-500">{rec.date}</TableCell>
                       <TableCell className="text-center">
                          {rec.minutesLate && rec.minutesLate > 0 ? (
                            <Badge variant="destructive" className="bg-rose-50 text-rose-600 font-black border-0">
                               {rec.minutesLate} {isRtl ? 'دقيقة' : 'min'}
                            </Badge>
                          ) : <span className="text-emerald-500 font-black text-xs uppercase tracking-tighter">On Time</span>}
                       </TableCell>
                       <TableCell className="pe-8">
                          <Badge className={cn(
                            "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                            rec.status === 'present' ? 'bg-emerald-500 text-white' :
                            rec.status === 'late' ? 'bg-amber-50 text-amber-600' :
                            rec.status === 'absent' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
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
