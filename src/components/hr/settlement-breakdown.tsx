'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, Scale, Wallet, Clock, 
  CalendarDays, ShieldCheck, AlertCircle, Info,
  TrendingUp, ArrowDownRight, Receipt
} from "lucide-react";
import { SettlementResult } from "@/types/settlement";
import { cn } from "@/lib/utils";

interface Props {
  result: SettlementResult;
  isRtl: boolean;
}

export function SettlementBreakdown({ result, isRtl }: Props) {
  const t = (ar: string, en: string) => isRtl ? ar : en;

  const MetricItem = ({ label, value, sub, color }: any) => (
    <div className="p-6 rounded-2xl bg-slate-50/50 border-2 border-white shadow-inner space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={cn("text-2xl font-black", color || "text-slate-900")}>{value}</p>
        {sub && <span className="text-[10px] font-bold text-slate-400">{sub}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Result */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-slate-900 text-white p-8 flex flex-col justify-between overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
               <Receipt className="h-32 w-32" />
            </div>
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">{t('إجمالي التسوية النهائية', 'Final Settlement Total')}</p>
            <h3 className="text-5xl font-black font-headline text-emerald-400">
               {result.total.toLocaleString()} <span className="text-sm font-bold text-white/40">KWD</span>
            </h3>
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-2">
               <ShieldCheck className="h-4 w-4 text-primary" />
               <span className="text-[10px] font-bold text-slate-400 italic">{result.notice}</span>
            </div>
         </Card>

         <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <MetricItem label={t('آخر راتب شامل', 'Last Gross Salary')} value={result.lastSalary.toLocaleString()} sub="KWD" />
            <MetricItem label={t('الأجر اليومي (26 يوم)', 'Daily Wage')} value={result.dailyWage.toFixed(3)} sub="KWD" color="text-primary" />
            <MetricItem label={t('مدة الخدمة الفعلية', 'Years of Service')} value={result.yearsOfService} sub={t(`سنة و ${result.monthsOfService} شهر`, `${result.monthsOfService} Months`)} />
            <MetricItem label={t('رصيد الإجازات المتبقي', 'Leave Balance')} value={result.leaveBalance} sub={t('يوم', 'Days')} color="text-blue-600" />
         </div>
      </div>

      {/* Detailed Items */}
      <Card className="border-0 shadow-xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
           <CardTitle className="text-xl font-black flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              {t('تحليل البنود القانونية للمستحقات', 'Legal Itemized Analysis')}
           </CardTitle>
        </CardHeader>
        <CardContent className="p-10 space-y-10">
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-start">
              
              {/* Gratuity Section */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
                       <Calculator className="h-5 w-5" />
                    </div>
                    <h4 className="font-black text-lg text-slate-800">{t('مكافأة نهاية الخدمة (المواد 51-53)', 'End of Service Gratuity')}</h4>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                       <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">{t('المبلغ الأساسي (قبل الخصم)', 'Base Gratuity (Pre-factor)')}</span>
                       <span className="font-black text-slate-700">{result.baseGratuityBeforeFactor.toLocaleString()} KWD</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border-2 border-white shadow-sm">
                       <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-500" />
                          <span className="text-xs font-black text-blue-800 uppercase tracking-tighter">{t('نسبة استحقاق الاستقالة', 'Resignation Factor')}</span>
                       </div>
                       <Badge className="bg-blue-600 text-white font-black">x {(result.resignationFactor * 100).toFixed(0)}%</Badge>
                    </div>
                    {result.isCapped && (
                       <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-2 text-[10px] font-bold text-amber-700">
                          <AlertCircle className="h-3 w-3" /> {t('تم تطبيق سقف الـ 18 شهراً للمكافأة حسب القانون.', '18-month ceiling applied per law.')}
                       </div>
                    )}
                    <div className="pt-4 border-t-2 border-dashed flex justify-between items-center">
                       <span className="font-black text-slate-900">{t('صافي المكافأة المستحقة', 'Net Gratuity Payable')}</span>
                       <span className="text-2xl font-black text-emerald-600">{result.gratuity.toLocaleString()} KWD</span>
                    </div>
                 </div>
              </div>

              {/* Other Settlements */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                       <Wallet className="h-5 w-5" />
                    </div>
                    <h4 className="font-black text-lg text-slate-800">{t('التسويات النقدية والبدلات', 'Adjustments & Indemnities')}</h4>
                 </div>

                 <div className="space-y-6">
                    <div className="flex justify-between items-start">
                       <div className="text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('بدل رصيد الإجازات', 'Leave Encashment')}</p>
                          <p className="text-xs font-bold text-slate-500 italic">{result.leaveBalance} {t('يوم x الأجر اليومي', 'Days x Daily Wage')}</p>
                       </div>
                       <span className="font-black text-slate-800">{result.leaveBalancePay.toLocaleString()} KWD</span>
                    </div>

                    <div className="flex justify-between items-start">
                       <div className="text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('بدل الإنذار (المادة 44)', 'Notice Indemnity')}</p>
                          <p className="text-xs font-bold text-slate-500 italic">{t('يعادل راتب 3 أشهر', 'Equals 3 months gross salary')}</p>
                       </div>
                       <span className={cn("font-black", result.noticeIndemnity > 0 ? "text-emerald-600" : "text-slate-300")}>
                          {result.noticeIndemnity.toLocaleString()} KWD
                       </span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Legal Footer Note */}
           <div className="p-8 rounded-[2rem] bg-slate-900/5 border-2 border-white shadow-inner flex items-start gap-4">
              <Clock className="h-6 w-6 text-primary shrink-0 mt-1" />
              <div className="text-start space-y-2">
                 <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest">{t('تنبيهات حقوق العامل (فترة الإخطار)', 'Notice Period Rights')}</h5>
                 <p className="text-xs text-slate-500 font-bold leading-relaxed italic">
                    {t(
                      'بناءً على المادة 44، يحق للموظف خلال فترة الـ 90 يوماً التغيب يوماً واحداً في الأسبوع أو العمل لمدة 6 ساعات فقط يومياً للبحث عن عمل، مع استحقاقه لكامل الأجر الشامل.',
                      'As per Art 44, the employee is entitled to 1 day off per week or 6 hours daily during the 90-day notice to search for a new job with full pay.'
                    )}
                 </p>
              </div>
           </div>

        </CardContent>
      </Card>
    </div>
  );
}
