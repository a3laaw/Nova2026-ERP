
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useFirestore, useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, CheckCircle2, ArrowRight, Eye, EyeOff, Building2, HardHat, PencilRuler, Zap, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    activity: 'construction',
    password: '',
    username: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();

  const handleRequestRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth) return;

    setLoading(true);

    try {
      // 1. إنشاء حساب الدخول الأساسي (سيبقى معلقاً إدارياً)
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      await updateProfile(userCredential.user, { displayName: formData.contactName });

      const batch = writeBatch(db);
      const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
      
      // تحديد موعد انتهاء التجربة الافتراضي (لكنه لن يظهر إلا بعد التفعيل)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // 2. تسجيل طلب الانضمام السيادي (المسار الجديد)
      const requestRef = doc(collection(db, 'company_requests'));
      batch.set(requestRef, {
        id: requestRef.id,
        companyId: companyId,
        companyName: formData.companyName,
        contactName: formData.contactName,
        email: formData.email,
        activity: formData.activity,
        status: 'pending', // الحالة المعلقة بانتظار المطور
        createdAt: serverTimestamp(),
      });

      // 3. إنشاء مستند الشركة بحالة "غير نشطة" (Inactive)
      const companyRef = doc(db, 'companies', companyId);
      batch.set(companyRef, {
        id: companyId,
        name: formData.companyName,
        status: 'inactive', // معطلة بانتظار المطور
        createdAt: serverTimestamp(),
        trialEndsAt: trialEndDate.toISOString(),
        maxUsers: 5,
        activity: formData.activity, 
        ownerUid: uid
      });

      // 4. إنشاء السجل العالمي للمدير (Identity Sovereignty) مع وسم الانتظار
      const globalUserRef = doc(db, 'global_users', uid);
      batch.set(globalUserRef, {
        companyId,
        role: 'admin',
        roleCode: 'ADMIN',
        fullName: formData.contactName, 
        username: formData.username || formData.email.split('@')[0],
        isDeveloper: false,
        email: formData.email,
        activity: formData.activity, 
        isActive: false, // الحساب غير نشط حتى يتم قبول الشركة
        isPendingApproval: true,
        updatedAt: serverTimestamp()
      });

      // 5. السجل المحلي داخل المنشأة
      const tenantUserRef = doc(db, 'companies', companyId, 'users', uid);
      batch.set(tenantUserRef, {
        id: uid,
        displayName: formData.contactName,
        email: formData.email,
        username: formData.username || formData.email.split('@')[0],
        joinedAt: serverTimestamp(),
        role: 'admin',
        roleCode: 'ADMIN',
        isActive: false
      });

      await batch.commit();
      
      setIsSubmitted(true);
      toast({
        title: isRtl ? "تم إرسال طلبك بنجاح" : "Request Submitted",
        description: isRtl ? "طلبك الآن قيد المراجعة من قبل الإدارة الفنية." : "Your request is pending technical approval.",
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في التسجيل",
        description: error.message || "تعذر إرسال طلبك حالياً.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isRtl = true; // نثبت العربية كخيار سيادي هنا

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfaf3] p-6" dir="rtl">
        <Card className="w-full max-w-md border-0 shadow-3xl rounded-[3rem] overflow-hidden bg-white text-center">
          <CardHeader className="pt-16 pb-10">
            <div className="mx-auto w-24 h-24 bg-amber-50 text-amber-600 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner ring-8 ring-amber-50/50">
              <Clock className="h-12 w-12" />
            </div>
            <CardTitle className="text-3xl font-black font-headline text-slate-900 leading-tight">طلبك قيد المراجعة!</CardTitle>
            <CardDescription className="text-lg font-bold text-slate-500 mt-4 leading-relaxed">
              شكراً لاهتمامك بـ NovaFlow. لقد تم تسجيل طلب شركة <span className="text-primary">{formData.companyName}</span> بنجاح. سيتم تفعيل حسابك فور مراجعة الطلب من قبل المطور.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-16">
             <Button onClick={() => router.push('/login')} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black">العودة لصفحة الدخول</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf3] p-6" dir="rtl">
      <Card className="w-full max-w-2xl border-0 shadow-3xl rounded-[3rem] overflow-hidden bg-white">
        <CardHeader className="space-y-4 pt-12 pb-8 text-center bg-slate-50 border-b">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shadow-inner mb-2 rotate-3 group hover:rotate-0 transition-transform duration-500">
            <Building2 className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-4xl font-black font-headline tracking-tighter text-slate-900">NovaFlow لأصحاب الأعمال</CardTitle>
            <CardDescription className="text-slate-500 font-bold text-lg">سجل منشأتك الجديدة بانتظار الاعتماد الفني</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-12">
          <form onSubmit={handleRequestRegistration} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">اسم المنشأة / الشركة</Label>
                <Input 
                  value={formData.companyName} 
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                  required 
                  className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50" 
                  placeholder="شركة المقاولات الحديثة"
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">نوع النشاط الرئيسي</Label>
                <Select value={formData.activity} onValueChange={(val) => setFormData({...formData, activity: val})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-0 shadow-2xl">
                    <SelectItem value="construction" className="font-bold">
                       <div className="flex items-center gap-2">
                          <HardHat className="h-4 w-4 text-slate-500" />
                          <span>مقاولات وإنشاءات</span>
                       </div>
                    </SelectItem>
                    <SelectItem value="consulting" className="font-bold">
                       <div className="flex items-center gap-2">
                          <PencilRuler className="h-4 w-4 text-slate-500" />
                          <span>استشارات هندسية</span>
                       </div>
                    </SelectItem>
                    <SelectItem value="design_build" className="font-bold text-primary">
                       <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <span>تصميم وإنشاء (D&B)</span>
                       </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">اسم المدير المسؤول</Label>
                <Input 
                  value={formData.contactName} 
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})} 
                  required 
                  className="h-14 rounded-2xl border-2 font-bold bg-slate-50/50" 
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">معرّف الدخول (Login ID)</Label>
                <Input 
                  value={formData.username} 
                  onChange={(e) => setFormData({...formData, username: e.target.value})} 
                  required 
                  className="h-14 rounded-2xl border-2 font-mono text-primary bg-slate-50/50" 
                  placeholder="admin_nova"
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">البريد الإلكتروني للشركة</Label>
                <Input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  required 
                  className="h-14 rounded-2xl border-2 text-left bg-slate-50/50" 
                  dir="ltr"
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">كلمة المرور</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    required 
                    className="h-14 rounded-2xl border-2 text-left bg-slate-50/50" 
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="w-full h-20 bg-primary text-white rounded-[2rem] text-2xl font-black shadow-2xl shadow-primary/20 hover:scale-[1.01] transition-all border-b-8 border-orange-700 mt-6">
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : 'إرسال طلب الانضمام للمراجعة'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-12 pt-4 justify-center flex flex-col space-y-4">
          <Button variant="link" onClick={() => router.push('/login')} className="text-primary font-black text-lg">
            لديك حساب شركة بالفعل؟ سجل دخولك <ArrowRight className="mr-2 h-5 w-5" />
          </Button>
          <p className="text-[11px] text-slate-400 text-center max-w-sm font-bold leading-relaxed">
            بإرسال هذا الطلب، أنت توافق على أن تفعيل المنشأة يخضع لمراجعة المطور التقني لضمان جودة الخدمة السيادية.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
