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

      {/* 1. الأجور والساعات */}
      <Section title="1. نظام الرواتب والأجور والساعات" icon={Wallet}>
        <div className="space-y-4">
          <h4 className="font-black text-primary border-s-4 border-primary ps-3">الحد الأدنى والتسليم</h4>
          <ul className="list-disc ps-6 space-y-2 font-bold text-slate-600 text-sm">
            <li><strong>الحد الأدنى (مادة 63):</strong> الحد الأدنى للأجور في القطاع الأهلي هو 75 د.ك (ما لم يصدر قرار بتعديله)، ويجب أن يكفي الأجر احتياجات العامل الأساسية.</li>
            <li><strong>التحويل البنكي (مادة 57):</strong> تلتزم المنشأة بتحويل الرواتب إلى حسابات العمال في البنوك المحلية، ويجب إرسال نسخة من الكشوف للمنصة الحكومية (هيئة القوى العاملة).</li>
            <li><strong>مهلة الصرف:</strong> يجب صرف الأجر في يوم العمل خلال مدة لا تتجاوز 7 أيام من تاريخ استحقاقه.</li>
          </ul>

          <h4 className="font-black text-primary border-s-4 border-primary ps-3 pt-4">ساعات العمل والإضافي (مادة 64)</h4>
          <ul className="list-disc ps-6 space-y-2 font-bold text-slate-600 text-sm">
            <li><strong>الحد الأقصى:</strong> 8 ساعات يومياً (48 ساعة أسبوعياً). وفي رمضان 36 ساعة أسبوعياً.</li>
            <li><strong>حسبة الإضافي (مادة 66):</strong> ساعة العمل العادية x 1.25.</li>
            <li><strong>العمل يوم الراحة (الجمعة):</strong> ساعة العمل x 1.5 + منح يوم راحة بديل خلال الأسبوع التالي.</li>
            <li><strong>العمل في العطلات الرسمية:</strong> أجر يوم كامل + أجر مضاعف (ساعة x 2).</li>
          </ul>
        </div>
      </Section>

      {/* 2. الإجازات السنوية */}
      <Section title="2. نظام الإجازات ورصيدها السنوي" icon={CalendarDays}>
        <div className="space-y-4 text-sm font-bold text-slate-600">
          <p className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-800">
            <strong>المادة 70 (تعديل 2018):</strong> يستحق العامل إجازة سنوية مدتها 30 يوماً مدفوعة الأجر، ولا يحسب ضمنها أيام الراحة الأسبوعية أو العطلات الرسمية أو الإجازات المرضية التي تقع خلالها.
          </p>
          <ul className="list-disc ps-6 space-y-3">
            <li><strong>آلية الخصم:</strong> عند طلب إجازة لمدة أسبوع، يقوم Nova ERP بخصم 6 أيام فقط من الرصيد (باعتبار الجمعة يوم راحة لا يخصم).</li>
            <li><strong>تداخل الإجازات:</strong> إذا مرض الموظف أثناء إجازته السنوية وقدم طبية معتمدة، يتوقف خصم الرصيد السنوي فوراً وتبدأ حسبة الإجازة المرضية (بقوة القانون).</li>
            <li><strong>تجميع الرصيد (مادة 72):</strong> يحق للعامل تجميع إجازاته لسنتين، ويجوز له بموافقة صاحب العمل تجميعها لأكثر من ذلك.</li>
          </ul>
        </div>
      </Section>

      {/* 3. الإجازات المرضية والخاصة */}
      <Section title="3. الإجازات المرضية (المادة 69)" icon={Landmark}>
        <div className="space-y-6">
          <p className="font-bold italic text-slate-500">التدرج المالي الصارم خلال السنة الواحدة:</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
             {[
               { label: 'أول 15 يوم', pay: 'أجر كامل', color: 'bg-emerald-500' },
               { label: '10 أيام تالية', pay: '75% أجر', color: 'bg-blue-500' },
               { label: '10 أيام تالية', pay: '50% أجر', color: 'bg-amber-500' },
               { label: '10 أيام تالية', pay: '25% أجر', color: 'bg-orange-500' },
               { label: '30 يوم أخيرة', pay: 'بدون أجر', color: 'bg-rose-500' },
             ].map((t, i) => (
               <div key={i} className="p-4 rounded-2xl border-2 bg-white text-center shadow-sm">
                 <div className={cn("h-2 w-full rounded-full mb-3", t.color)} />
                 <p className="text-[10px] font-black text-slate-400">{t.label}</p>
                 <p className="text-sm font-black text-slate-800">{t.pay}</p>
               </div>
             ))}
          </div>
          
          <h4 className="font-black text-primary pt-6">إجازات أخرى مدفوعة الأجر:</h4>
          <ul className="list-disc ps-6 space-y-2 text-sm font-bold text-slate-600">
            <li><strong>الوضع والأمومة:</strong> 70 يوماً للمرأة (مادة 24).</li>
            <li><strong>إجازة الحج:</strong> 21 يوماً لمرة واحدة في العمر (مادة 76) لمن أمضى سنتين في الخدمة.</li>
            <li><strong>إجازة العدة:</strong> 4 أشهر و10 أيام للمرأة المسلمة المتوفى زوجها (أجر كامل).</li>
          </ul>
        </div>
      </Section>

      {/* 4. مكافأة نهاية الخدمة */}
      <Section title="4. مكافأة نهاية الخدمة (المواد 51-53)" icon={Calculator}>
        <div className="space-y-6 text-sm font-bold text-slate-600">
          <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4">
             <h5 className="text-primary font-black">معادلة الاحتساب للموظف الشهري:</h5>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                   <p className="text-xs text-slate-400">أول 5 سنوات</p>
                   <p className="text-lg">أجر 15 يوماً عن كل سنة</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                   <p className="text-xs text-slate-400">ما بعد 5 سنوات</p>
                   <p className="text-lg">أجر شهر كامل عن كل سنة</p>
                </div>
             </div>
             <p className="text-[10px] text-primary/80 font-black uppercase">الحد الأقصى للمكافأة: لا يتجاوز أجر 18 شهراً.</p>
          </div>

          <h4 className="font-black text-slate-800 border-s-4 border-amber-500 ps-3">نسبة الاستحقاق عند الاستقالة (مادة 53)</h4>
          <table className="w-full border rounded-2xl overflow-hidden">
             <thead className="bg-slate-50">
                <tr className="text-[10px] font-black uppercase">
                   <th className="p-4 text-start">مدة الخدمة</th>
                   <th className="p-4 text-center">النسبة المستحقة</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                <tr><td className="p-4">أقل من 3 سنوات</td><td className="p-4 text-center text-rose-600">0% (لا يستحق)</td></tr>
                <tr><td className="p-4">3 سنوات إلى أقل من 5</td><td className="p-4 text-center">50% (نصف المكافأة)</td></tr>
                <tr><td className="p-4">5 سنوات إلى أقل من 10</td><td className="p-4 text-center">66.6% (ثلثي المكافأة)</td></tr>
                <tr><td className="p-4">10 سنوات فأكثر</td><td className="p-4 text-center text-emerald-600">100% (كامل المكافأة)</td></tr>
             </tbody>
          </table>

          <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-emerald-900">
             <p className="font-black flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> البديل النقدي للإجازات (مادة 72)
             </p>
             <p className="mt-2 leading-relaxed">
                يستحق العامل عند نهاية خدمته بدلاً نقدياً عن رصيد إجازاته السنوية التي لم يستهلكها، ويحسب البديل على أساس **آخر راتب شامل** تقاضاه العامل.
             </p>
          </div>
        </div>
      </Section>

      {/* 5. فترة التجربة والإنذار */}
      <Section title="5. الضوابط العامة (التجربة والإنذار)" icon={Gavel}>
        <div className="space-y-6 text-sm font-bold text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-3">
                <h5 className="font-black text-slate-800 flex items-center gap-2">
                   <Clock className="h-4 w-4 text-primary" /> فترة التجربة (مادة 24)
                </h5>
                <ul className="list-disc ps-5 space-y-2">
                   <li>الحد الأقصى 100 يوم عمل.</li>
                   <li>يجوز لرب العمل إنهاء العقد خلالها دون إخطار أو مكافأة.</li>
                   <li>لا يجوز تعيين العامل تحت التجربة أكثر من مرة لدى نفس صاحب العمل.</li>
                </ul>
             </div>
             <div className="space-y-3">
                <h5 className="font-black text-slate-800 flex items-center gap-2">
                   <AlertTriangle className="h-4 w-4 text-primary" /> فترة الإنذار (مادة 44)
                </h5>
                <ul className="list-disc ps-5 space-y-2">
                   <li>مهلة الإخطار هي 3 أشهر (90 يوماً).</li>
                   <li>في حال عدم الالتزام، يلتزم الطرف المخالف بدفع "بدل إنذار" يعادل أجر العامل عن نفس المدة.</li>
                   <li>للعامل حق البحث عن عمل (يوم إجازة أسبوعي أو 6 ساعات يومياً) خلال مدة الإنذار.</li>
                </ul>
             </div>
          </div>

          <div className="p-8 bg-rose-50 border-2 border-rose-100 rounded-[2.5rem] space-y-4">
             <h5 className="font-black text-rose-800 flex items-center gap-2 uppercase tracking-widest text-xs">
                <Landmark className="h-5 w-5" /> الحالات الحصرية للفصل الفوري (مادة 41)
             </h5>
             <p className="text-xs text-rose-700 leading-relaxed">
                يجوز لصاحب العمل فصل العامل دون إخطار أو مكافأة في حالات محددة منها: ارتكاب خطأ نتج عنه خسارة جسيمة، مخالفة تعليمات السلامة عمداً، التغيب أكثر من 7 أيام متصلة أو 20 يوماً متفرقة بدون عذر، إفشاء أسرار المنشأة، أو صدور حكم نهائي في جريمة مخلة بالشرف.
             </p>
          </div>
        </div>
      </Section>

    </div>
  );
}
