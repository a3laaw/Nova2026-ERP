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
  Clock, Download, Table as TableIcon
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

  /**
   * إنشاء وتحميل نموذج CSV متوافق مع إكسيل
   */
  const downloadTemplate = () => {
    const headers = isRtl 
      ? "رقم_الموظف,التاريخ,وقت_الحضور,وقت_الانصراف" 
      : "EmployeeNum,Date,CheckIn,CheckOut";
    
    const rows = [
      "1001,2026-01-01,08:00,17:00",
      "1002,2026-01-01,08:15,17:05",
      "1001,2026-01-02,07:55,16:50"
    ];
    
    // إضافة BOM لدعم اللغة العربية في إكسيل
    const csvContent = "\uFEFF" + headers + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", isRtl ? "نموذج_الحضور_نوفافلو.csv" : "NovaFlow_Attendance_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: isRtl ? "تم تحميل النموذج" : "Template Downloaded" });
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
        
        const rows: RawAttendanceRow[] = lines.slice(1).map(line => {
          // التعامل مع الفواصل سواء كانت فاصلة أو فاصلة منقوطة (CSV)
          const parts = line.split(/[;,]/).map(s => s.trim());
          return { 
            employeeNumber: parts[0], 
            date: parts[1], 
            checkIn: parts[2], 
            checkOut: parts[3] 
          };
        });

        const whService = new WorkHoursService(db, companyId);
        const settings = await whService.getSettings();
        
        if (!settings) throw new Error(isRtl ? 'يرجى ضبط إعدادات ساعات العمل أولاً.' : 'Please set work hours settings first.');

        const importService = new AttendanceImportService(db, companyId);
        const result = await importService.processImport(rows, employees, settings);
        setPreview(result);
        
        toast({ title: isRtl ? 'تم تحليل الملف بنجاح' : 'File Analyzed' });
      } catch (err: any) {
        toast({ variant: "destructive", title: t('error'), description: err.message });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
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
            {isRtl ? 'استيراد سجلات البصمة' : 'Import Attendance'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'ارفع ملفات CSV وحوّلها لبيانات تشغيلية فوراً.' : 'Transform biometric files into operational data.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="rounded-xl font-black border-2 h-14 px-8 gap-3 bg-white hover:bg-slate-50 shadow-sm"
        >
          <Download className="h-5 w-5 text-primary" />
          {isRtl ? 'تحميل نموذج Excel المعتمد' : 'Download Excel Template'}
        </Button>
      </div>

      {!preview ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* منطقة الرفع */}
           <Card className="lg:col-span-2 border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-2xl">
              <CardContent className="p-16 text-center space-y-8">
                <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                  <UploadCloud className="h-12 w-12 animate-bounce" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black">{isRtl ? 'ارفع ملف سجلات البصمة (CSV)' : 'Upload Biometric CSV File'}</h2>
                  <p className="text-slate-400 font-bold max-w-md mx-auto">{isRtl ? 'تأكد من مطابقة الملف للنموذج المعتمد لضمان دقة الحسابات.' : 'Ensure file matches template for accurate calculations.'}</p>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                   <label className="cursor-pointer group">
                      <div className="bg-primary text-white font-black px-16 py-6 rounded-2xl text-xl shadow-xl shadow-primary/20 group-hover:scale-105 transition-all flex items-center gap-3">
                        {importing ? <Loader2 className="animate-spin h-8 w-8" /> : <Plus className="h-8 w-8" />}
                        {isRtl ? 'اختر ملف البيانات الآن' : 'Select Data File'}
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={importing} />
                   </label>
                   <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                     <Info className="h-3 w-3" />
                     {isRtl ? 'يدعم تنسيق CSV فقط بترميز UTF-8' : 'Supports CSV UTF-8 format only'}
                   </div>
                </div>
              </CardContent>
           </Card>

           {/* دليل تعبئة البيانات */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
              <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                 <CardTitle className="text-lg font-black flex items-center gap-3">
                    <TableIcon className="h-5 w-5 text-primary" />
                    {isRtl ? 'كيف ترتب ملف الإكسيل؟' : 'Data Entry Guide'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 <p className="text-xs font-bold text-slate-400 leading-relaxed">
                    {isRtl ? 'يجب أن يحتوي الملف على 4 أعمدة رئيسية بالترتيب التالي:' : 'The file must contain 4 main columns in this order:'}
                 </p>
                 <div className="space-y-4">
                    {[
                      { label: isRtl ? '1. رقم الموظف' : '1. Emp Num', desc: isRtl ? 'كما يظهر في سجل الموظفين' : 'Matching records' },
                      { label: isRtl ? '2. التاريخ' : '2. Date', desc: 'YYYY-MM-DD (2026-01-01)' },
                      { label: isRtl ? '3. وقت الحضور' : '3. Check In', desc: 'HH:mm (08:00)' },
                      { label: isRtl ? '4. وقت الانصراف' : '4. Check Out', desc: 'HH:mm (17:00)' }
                    ].map((step, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-sm font-black text-primary">{step.label}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{step.desc}</p>
                      </div>
                    ))}
                 </div>
                 <div className="pt-4 flex items-center gap-3 text-[10px] text-amber-400 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{isRtl ? 'تجنب ترك خانة رقم الموظف أو التاريخ فارغة.' : 'Avoid empty employee ID or date fields.'}</span>
                 </div>
              </CardContent>
           </Card>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             {[
               { label: isRtl ? 'إجمالي السجلات' : 'Total', val: preview.summary.total, icon: FileSpreadsheet, color: 'text-blue-600', bg: 'bg-blue-50' },
               { label: isRtl ? 'جاهز للاستيراد' : 'Valid', val: preview.summary.valid, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
               { label: isRtl ? 'أخطاء مطابقة' : 'Errors', val: preview.summary.invalid, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
               { label: isRtl ? 'حالات تأخير' : 'Late Cases', val: preview.summary.late, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
             ].map((stat, i) => (
               <Card key={i} className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white flex items-center justify-between">
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

          <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
               <CardTitle className="text-xl font-black">{isRtl ? 'معاينة البيانات قبل الحفظ' : 'Data Preview'}</CardTitle>
               <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setPreview(null)} className="rounded-xl font-black border-2 h-12 px-6">
                     <X className="me-2 h-4 w-4" /> {isRtl ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || preview.summary.valid === 0}
                    className="bg-emerald-600 text-white font-black rounded-xl h-12 px-10 shadow-xl shadow-emerald-100 hover:scale-105 transition-all"
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
                     <TableHead className="text-center">{isRtl ? 'التأخير' : 'Late'}</TableHead>
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
