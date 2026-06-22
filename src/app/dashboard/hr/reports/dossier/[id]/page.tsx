'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, ShieldCheck, Printer,
  User, Calendar, Clock, Calculator, History,
  HardHat, MapPin, Phone, Mail,
  Package, Truck, RotateCcw, PackageCheck,
  TrendingUp, TrendingDown, Info, Scale,
  FileText, ExternalLink, Plane, BarChart3,
  DollarSign, Receipt, ClipboardCheck
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord, LeaveRequest } from '@/types/hr';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function EmployeeDossierPage() {
  const empId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // 1. جلب البيانات الأساسية
  const empRef = useMemo(() => 
    companyId && db ? doc(db, paths.employees(companyId), empId) : null, 
  [db, companyId, empId]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  // 2. جلب سجلات الحركات (مختصرة للعرض السريع)
  const attendanceQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.attendance(companyId)), where('employeeId', '==', empId), orderBy('date', 'desc'), where('date', '>=', '2024-01-01')) : null, 
  [db, companyId, empId]);
  
  const { data: attendance } = useCollection<AttendanceRecord>(attendanceQuery);

  const assetsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.assetAssignments(companyId)), where('employeeId', '==', empId), where('status', '==', 'in-use')) : null, 
  [db, companyId, empId]);
  const { data: assets } = useCollection<any>(assetsQuery);

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!employee) return <div className="p-20 text-center font-bold">{isRtl ? 'الموظف غير موجود' : 'Employee not found'}</div>;

  const ReportActionCard = ({ title, desc, icon: Icon, path, color }: any) => (
    <Card 
      onClick={() => router.push(path)}
      className="border-0 shadow-lg hover:shadow-2xl transition-all cursor-pointer rounded-[2rem] bg-white group overflow-hidden border-b-4"
      style={{ borderBottomColor: color }}
    >
      <CardContent className="p-6 text-start">
        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", `bg-slate-50`)} style={{ color }}>
          <Icon className="h-6 w-6" />
        </div>
        <h4 className="font-black text-slate-800 text-sm mb-1">{title}</h4>
        <p className="text-[10px] text-slate-400 font-bold leading-tight line-clamp-2">{desc}</p>
        <div className="mt-4 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest" style={{ color }}>
           {isRtl ? 'فتح التقرير' : 'Open Report'}
           <ArrowRight className={cn("h-3 w-3", !isRtl && "rotate-0", isRtl && "rotate-180")} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline">{isRtl ? 'مركز تقارير الموظف' : 'Employee Analytics Center'}</h1>
             <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> {employee.fullName} | {employee.employeeNumber}
             </p>
           </div>
        </div>
        <Button onClick={() => window.print()} className="rounded-2xl h-14 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all">
           <Printer className="h-5 w-5" /> {isRtl ? 'طباعة الملف كاملاً' : 'Print Full Dossier'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar: Quick Reports Hub (The Enterprise Links) */}
        <div className="lg:col-span-1 space-y-6">
           <h3 className="font-black text-xs text-slate-400 uppercase tracking-[0.2em] px-2">{isRtl ? 'التقارير الذاتية (ERP)' : 'Self-Service Reports'}</h3>
           <div className="grid grid-cols-1 gap-4">
              <ReportActionCard 
                title={isRtl ? "كشف حركة الرصيد" : "Leave Ledger"} 
                desc={isRtl ? "تحليل مالي مفصل لاستحقاق وخصم الإجازات." : "Detailed financial analysis of leave accruals."}
                icon={Scale}
                color="#e87c24"
                path={`/dashboard/hr/reports/leaves/statement/${empId}`}
              />
              <ReportActionCard 
                title={isRtl ? "تحليل الانضباط" : "Discipline Analysis"} 
                desc={isRtl ? "سجل التأخير والغياب ونسبة الالتزام الشهرية." : "Lateness logs, absences, and consistency rate."}
                icon={BarChart3}
                color="#2563eb"
                path={`/dashboard/hr/reports/attendance/individual/${empId}`}
              />
              <ReportActionCard 
                title={isRtl ? "سجل الرواتب" : "Payroll Ledger"} 
                desc={isRtl ? "أرشيف تاريخي لكافة الدفعات المالية والخصومات." : "Historical archive of all payments and deductions."}
                icon={Receipt}
                color="#059669"
                path={`/dashboard/hr/reports/payroll/individual/${empId}`}
              />
              <ReportActionCard 
                title={isRtl ? "بيان العهد" : "Asset Statement"} 
                desc={isRtl ? "قائمة المعدات والأدوات المسجلة بعهدة الموظف." : "List of tools and equipment currently in possession."}
                icon={Package}
                color="#7c3aed"
                path={`/dashboard/hr/reports/dossier/${empId}`}
              />
           </div>
        </div>

        {/* Main Content: Overview Wrapper */}
        <div className="lg:col-span-3 space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-10">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6 text-start">
                       <div className="h-20 w-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/10">
                          {employee.employeeNumber}
                       </div>
                       <div>
                          <h2 className="text-3xl font-black text-slate-900">{employee.fullName}</h2>
                          <p className="text-lg font-bold text-primary flex items-center gap-2">
                             <HardHat className="h-5 w-5" /> {employee.jobTitle}
                          </p>
                          <div className="flex gap-4 mt-2">
                             <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase">{employee.departmentName}</Badge>
                             <Badge variant="outline" className="border-emerald-200 text-emerald-600 font-black text-[9px] uppercase">{employee.status}</Badge>
                          </div>
                       </div>
                    </div>
                    <div className="bg-slate-900 text-white p-6 rounded-3xl text-center min-w-[180px] shadow-2xl">
                       <p className="text-[9px] font-black text-primary uppercase mb-1">{isRtl ? 'رصيد الإجازات الحالي' : 'Current Balance'}</p>
                       <p className="text-4xl font-black font-mono">{employee.annualLeaveBalance || 0}</p>
                       <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">{isRtl ? 'يوم مستحق' : 'Accrued Days'}</p>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-10 space-y-12">
                 
                 {/* Contact Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-start">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرقم المدني' : 'Civil ID'}</p>
                       <p className="text-sm font-black text-slate-800 font-mono">{employee.civilId}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</p>
                       <p className="text-sm font-black text-slate-800">{employee.mobile}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</p>
                       <p className="text-sm font-black text-slate-800">{employee.hireDate}</p>
                    </div>
                 </div>

                 <div className="h-[1px] bg-slate-100 w-full" />

                 {/* Current Assets Snapshot */}
                 <div className="space-y-6 text-start">
                    <div className="flex justify-between items-center">
                       <h3 className="font-black text-base flex items-center gap-2 text-slate-800">
                          <Package className="h-5 w-5 text-primary" /> {isRtl ? 'العهد الميدانية النشطة' : 'Active Field Assets'}
                       </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {assets && assets.length > 0 ? (
                         assets.map((asset: any) => (
                           <div key={asset.id} className="p-5 rounded-2xl bg-slate-50 border-2 border-white shadow-inner flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm"><Truck className="h-4 w-4" /></div>
                                 <div className="text-start">
                                    <p className="font-black text-xs text-slate-800">{asset.itemName}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{asset.quantity} units</p>
                                 </div>
                              </div>
                              <span className="text-[9px] font-mono font-bold text-slate-400">{asset.assignedAt?.toDate().toLocaleDateString()}</span>
                           </div>
                         ))
                       ) : (
                         <div className="col-span-full py-10 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                            <p className="text-xs font-bold text-slate-400 italic">{isRtl ? 'لا يوجد عهد مسجلة حالياً.' : 'No active assets assigned.'}</p>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Attendance Trend Preview */}
                 <div className="space-y-6 text-start">
                    <h3 className="font-black text-base flex items-center gap-2 text-slate-800">
                       <BarChart3 className="h-5 w-5 text-blue-600" /> {isRtl ? 'آخر عمليات الحضور' : 'Recent Attendance'}
                    </h3>
                    <div className="border rounded-2xl overflow-hidden shadow-sm">
                       <table className="w-full text-xs text-start">
                          <thead className="bg-slate-50 border-b">
                             <tr className="font-black text-slate-400 uppercase">
                                <th className="p-4 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                                <th className="p-4 text-start">{isRtl ? 'الدخول' : 'Punch In'}</th>
                                <th className="p-4 text-start">{isRtl ? 'الخروج' : 'Punch Out'}</th>
                                <th className="p-4 text-end pe-6">{isRtl ? 'الحالة' : 'Status'}</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y">
                             {attendance?.slice(0, 5).map((rec) => (
                                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="p-4 font-bold text-slate-600">{rec.date}</td>
                                   <td className="p-4 font-mono font-black text-slate-800">{rec.checkIn || '--:--'}</td>
                                   <td className="p-4 font-mono font-black text-slate-800">{rec.checkOut || '--:--'}</td>
                                   <td className="p-4 text-end pe-6">
                                      <Badge className={cn(
                                        "font-black text-[8px] uppercase",
                                        rec.status === 'present' ? "bg-emerald-500 text-white" : 
                                        rec.status === 'late' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                                      )}>{rec.status}</Badge>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

      </div>
    </div>
  );
}
