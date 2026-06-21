
'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { RecruitmentService } from '@/services/recruitment-service';
import { Loader2, CheckCircle2, Sparkles, Send, UserCircle, Briefcase, GraduationCap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function PublicJobApplicationPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const db = useFirestore();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    position: '',
    experienceYears: 0,
    education: '',
    skills: '',
    notes: ''
  });

  // جلب بيانات الشركة لإضفاء طابع رسمي
  const companyRef = useMemo(() => db ? doc(db, 'companies', companyId) : null, [db, companyId]);
  const { data: company, loading: companyLoading } = useDoc<any>(companyRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !companyId) return;

    setLoading(true);
    try {
      const service = new RecruitmentService(db, companyId);
      await service.submitApplication(form);
      setSubmitted(true);
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال الطلب، يرجى المحاولة لاحقاً." });
    } finally {
      setLoading(false);
    }
  };

  if (companyLoading) return <div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin text-primary" /></div>;
  if (!company) return <div className="h-screen flex items-center justify-center">رابط توظيف غير صالح.</div>;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#fdfaf3] flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full border-0 shadow-2xl rounded-[3rem] p-10 text-center animate-in zoom-in-95">
           <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-12 w-12" />
           </div>
           <h1 className="text-3xl font-black font-headline mb-4">تم استلام طلبك بنجاح!</h1>
           <p className="text-slate-500 font-bold leading-relaxed mb-8">
              شكراً لاهتمامك بالانضمام لفريق <span className="text-primary">{company.name}</span>. سيقوم فريق الموارد البشرية بمراجعة ملفك والتواصل معك قريباً.
           </p>
           <Button variant="outline" onClick={() => setSubmitted(false)} className="rounded-xl">إرسال طلب آخر</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfaf3] py-12 px-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
           <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-xl border-2 border-primary/10 overflow-hidden p-2">
              {company.logoUrl ? <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Sparkles className="h-10 w-10 text-primary" />}
           </div>
           <div className="space-y-1">
              <h1 className="text-4xl font-black font-headline text-slate-900">بوابة التوظيف الرسمية</h1>
              <p className="text-xl font-bold text-primary">{company.name}</p>
           </div>
        </div>

        <Card className="border-0 shadow-3xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
           <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
              <CardTitle className="text-xl font-black">نموذج الانضمام للفريق</CardTitle>
              <CardDescription className="font-bold">يرجى تعبئة كافة البيانات بدقة لضمان سرعة معالجة طلبك.</CardDescription>
           </CardHeader>
           <CardContent className="p-10">
              <form onSubmit={handleSubmit} className="space-y-8 text-start">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <UserCircle className="h-3 w-3" /> الاسم الكامل
                       </Label>
                       <Input required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder="أدخل اسمك كما في الهوية" />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Briefcase className="h-3 w-3" /> الوظيفة المستهدفة
                       </Label>
                       <Input required value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder="مثلاً: مهندس معماري" />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400">البريد الإلكتروني</Label>
                       <Input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-12 rounded-xl border-2 font-bold text-left" dir="ltr" />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400">رقم الهاتف</Label>
                       <Input required value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder="+965" />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400">سنوات الخبرة</Label>
                       <Input type="number" required value={form.experienceYears} onChange={e => setForm({...form, experienceYears: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black" />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <GraduationCap className="h-3 w-3" /> المؤهل العلمي
                       </Label>
                       <Input required value={form.education} onChange={e => setForm({...form, education: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder="بكالوريوس هندسة..." />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="font-black text-xs uppercase tracking-widest text-slate-400">المهارات والخبرات السابقة</Label>
                    <Textarea value={form.skills} onChange={e => setForm({...form, skills: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-4" placeholder="اذكر أهم مهاراتك الفنية..." />
                 </div>

                 <Button 
                   type="submit" 
                   disabled={loading}
                   className="w-full h-20 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-105 transition-all gap-4"
                 >
                    {loading ? <Loader2 className="animate-spin" /> : <Send className="h-8 w-8" />}
                    تقديم الطلب الآن
                 </Button>

                 <p className="text-[10px] text-slate-400 text-center font-bold">
                    بتقديم هذا الطلب، أنت توافق على معالجة بياناتك لأغراض التوظيف داخل نظام {company.name}.
                 </p>
              </form>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
