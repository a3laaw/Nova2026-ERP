'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Scale, BookOpen, Clock, Calculator, 
  ShieldCheck, AlertTriangle, Gavel, 
  CalendarDays, Wallet, Landmark 
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function LegalGuidePage() {
  const { t, lang, dir } = useLanguage();
  const isRtl = lang === 'ar';

  const Section = ({ title, icon: Icon, children, id }: any) => (
    <Card id={id} className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 mb-10">
      <CardHeader className="bg-slate-50 border-b p-8 text-start">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black font-headline">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-10 text-start space-y-6 leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="text-start space-y-2 border-b pb-8">
        <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
          <Landmark className="h-3 w-3" /> {isRtl ? 'مرجع الامتثال التشغيلي' : 'Operational Compliance Reference'}
        </div>
        <h1 className="text-4xl font-black font-headline text-slate-900">دليل قانون العمل الكويتي (2026)</h1>
        <p className="text-muted-foreground font-bold italic">شرح تفصيلي للمواد القانونية المنظمة لعمليات Nova ERP</p>
      </div>

      <Section title="1. نظام الرواتب وحسبة الـ 26 يوماً" icon={Wallet}>
        <div className="space-y-4 font-bold text-slate-600 text-sm">
          <p className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-emerald-800">
             <strong>مبدأ هام:</strong> الراتب الشهري هو مبلغ مقطوع مقابل الشهر التقويمي. نستخدم "حسبة الـ 26" (راتب ÷ 26) فقط في حالتين:
          </p>
          <ul className="list-disc ps-6 space-y-3">
            <li><strong>تصفية الإجازات:</strong> عند نهاية الخدمة، يتم تحويل أيام الرصيد المتبقية إلى مبالغ نقدية بضربها في (الراتب ÷ 26). هذا يعني أن تعويض 30 يوماً قد يتجاوز قيمة الراتب الشهري.</li>
            <li><strong>الخصم والإضافي:</strong> خصم يوم الغياب أو احتساب ساعة العمل الإضافي يعتمد على قيمة اليوم المحسوب بـ 1/26 من الراتب.</li>
            <li><strong>الراتب أثناء الإجازة:</strong> إذا خرج الموظف في إجازة فعلية، فإنه يتقاضى راتبه الشهري المعتاد دون زيادة أو نقصان.</li>
          </ul>
        </div>
      </Section>

      <Section title="2. الإجازات السنوية والمرضية" icon={CalendarDays}>
        <div className="space-y-4 text-sm font-bold text-slate-600">
          <p className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-800">
            <strong>المادة 70:</strong> الموظف يستحق 30 يوماً عن كل سنة. Nova ERP يحسبها بمعدل 2.5 يوم عن كل شهر عمل فعلي.
          </p>
          <ul className="list-disc ps-6 space-y-3">
            <li><strong>قاعدة الـ 6 أشهر:</strong> لا يجوز القيام بالإجازة السنوية إلا بعد قضاء أول 6 أشهر في الخدمة.</li>
            <li><strong>آلية الخصم:</strong> لا تُخصم أيام الجمعة أو العطلات الرسمية إذا تخللت الإجازة السنوية.</li>
            <li><strong>تدرج المرضية (مادة 69):</strong> 15 يوم (أجر كامل)، 10 أيام (75%)، 10 أيام (50%)، 10 أيام (25%)، ثم 30 يوماً بدون أجر.</li>
          </ul>
        </div>
      </Section>

      <Section title="3. مكافأة نهاية الخدمة (مادة 51-53)" icon={Calculator}>
        <div className="space-y-6 text-sm font-bold text-slate-600">
          <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4">
             <h5 className="text-primary font-black">معادلة التصفية النهائية:</h5>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                   <p className="text-xs text-slate-400">أول 5 سنوات</p>
                   <p className="text-lg">أجر 15 يوماً (محسوب بـ 26) عن كل سنة</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                   <p className="text-xs text-slate-400">ما بعد 5 سنوات</p>
                   <p className="text-lg">أجر شهر كامل عن كل سنة</p>
                </div>
             </div>
          </div>

          <h4 className="font-black text-slate-800 border-s-4 border-amber-500 ps-3">نسبة الاستحقاق عند الاستقالة (مادة 53)</h4>
          <table className="w-full border rounded-2xl overflow-hidden text-xs">
             <thead className="bg-slate-50">
                <tr className="font-black uppercase">
                   <th className="p-4 text-start">مدة الخدمة</th>
                   <th className="p-4 text-center">النسبة المستحقة</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                <tr><td className="p-4">أقل من 3 سنوات</td><td className="p-4 text-center text-rose-600 font-black">0% (لا يستحق)</td></tr>
                <tr><td className="p-4">من 3 إلى أقل من 5 سنوات</td><td className="p-4 text-center">50% (نصف المكافأة)</td></tr>
                <tr><td className="p-4">من 5 إلى أقل من 10 سنوات</td><td className="p-4 text-center">66.6% (ثلثي المكافأة)</td></tr>
                <tr><td className="p-4">10 سنوات فأكثر</td><td className="p-4 text-center text-emerald-600 font-black">100% (كامل المكافأة)</td></tr>
             </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. فترة الإنذار والبحث عن عمل" icon={Gavel}>
        <div className="space-y-6 text-sm font-bold text-slate-600">
          <ul className="list-disc ps-5 space-y-3">
             <li><strong>مهلة الـ 90 يوماً:</strong> يجب إخطار الطرف الآخر قبل 3 أشهر من إنهاء التعاقد.</li>
             <li><strong>بدل الإنذار:</strong> في حال الإنهاء الفوري، يلتزم الطرف المنهي بدفع راتب 3 أشهر كاملة للطرف الآخر كتعويض.</li>
             <li><strong>حقوق العامل (مادة 44):</strong> يحق للعامل خلال فترة الإنذار التغيب يوماً واحداً أسبوعياً أو 6 ساعات يومياً للبحث عن عمل بأجر كامل.</li>
          </ul>
        </div>
      </Section>

    </div>
  );
}