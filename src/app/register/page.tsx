'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useFirestore, useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

  const handleAutomaticProvisioning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth) return;

    setLoading(true);

    try {
      // 1. إنشاء حساب المستخدم في Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      // 2. إعداد البيانات والمسارات (SaaS Provisioning)
      const batch = writeBatch(db);
      const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
      
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // سجل الطلب (للأرشفة)
      const requestRef = doc(collection(db, 'company_requests'));
      batch.set(requestRef, {
        companyName: formData.companyName,
        contactName: formData.contactName,
        email: formData.email,
        activity: formData.activity,
        status: 'activated',
        createdAt: serverTimestamp(),
      });

      // سجل المنشأة الجديدة
      const companyRef = doc(db, 'companies', companyId);
      batch.set(companyRef, {
        name: formData.companyName,
        status: 'active',
        createdAt: serverTimestamp(),
        trialEndsAt: trialEndDate.toISOString(),
        maxUsers: 5,
        activity: formData.activity,
        ownerUid: uid
      });

      // ربط المستخدم العالمي (Global User)
      const globalUserRef = doc(db, 'global_users', uid);
      batch.set(globalUserRef, {
        companyId,
        role: 'admin',
        username: formData.username || formData.email.split('@')[0],
        isDeveloper: false,
        email: formData.email
      });

      // ملف المستخدم داخل الشركة (Tenanted Profile)
      const tenantUserRef = doc(db, 'companies', companyId, 'users', uid);
      batch.set(tenantUserRef, {
        displayName: formData.contactName,
        email: formData.email,
        joinedAt: serverTimestamp(),
        role: 'admin'
      });

      await batch.commit();
      
      setIsSubmitted(true);
      toast({
        title: "مبروك! تم تفعيل منشأتك",
        description: "بدأت الآن فترة تجريبية لمدة 14 يوماً مع كامل الصلاحيات.",
      });

      // جلسة تسجيل الدخول البسيطة
      document.cookie = `session=true; path=/; max-age=${60 * 60 * 24 * 7}`;
      
      // توجيه تلقائي بعد نجاح العملية
      setTimeout(() => router.push('/dashboard'), 2000);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في التسجيل",
        description: error.message || "تعذر إعداد حسابك حالياً.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden bg-white text-center">
          <CardHeader className="pt-10">
            <div className="mx-auto w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-black font-headline">تم الإعداد بنجاح!</CardTitle>
            <CardDescription className="text-lg">
              جاري توجيهك إلى لوحة تحكم شركة <span className="font-bold text-primary">{formData.companyName}</span>...
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-10">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-2xl border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-2 rotate-3">
            <Sparkles className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-black font-headline">ابدأ مع NovaFlow فوراً</CardTitle>
          <CardDescription className="text-lg">سجل الآن واحصل على 14 يوماً فترة تجريبية مجانية لشركتك</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAutomaticProvisioning} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>اسم الشركة / المكتب</Label>
                <Input 
                  value={formData.companyName} 
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2" 
                  placeholder="شركة المقاولات الحديثة"
                />
              </div>
              <div className="space-y-2">
                <Label>نوع النشاط</Label>
                <Select value={formData.activity} onValueChange={(val) => setFormData({...formData, activity: val})}>
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction">مقاولات وإنشاءات</SelectItem>
                    <SelectItem value="consulting">استشارات هندسية</SelectItem>
                    <SelectItem value="general">تجارة عامة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>اسم المسؤول المباشر</Label>
                <Input 
                  value={formData.contactName} 
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2" 
                />
              </div>
              <div className="space-y-2">
                <Label>اسم المستخدم (Username)</Label>
                <Input 
                  value={formData.username} 
                  onChange={(e) => setFormData({...formData, username: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2" 
                  placeholder="admin_nova"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني الرسمي</Label>
                <Input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2 text-left" 
                  dir="ltr"
                />
              </div>
              <div className="space-y-2 relative">
                <Label>كلمة المرور</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    required 
                    className="h-12 rounded-xl border-2 text-left pr-10" 
                    dir="ltr"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white rounded-2xl text-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all">
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري إعداد بيئة الشركة...
                </>
              ) : 'تفعيل الحساب والبدء فوراً'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-10 pt-4 justify-center flex-col space-y-4">
          <Button variant="link" onClick={() => router.push('/login')} className="text-muted-foreground font-bold">
            لديك حساب بالفعل؟ سجل دخولك <ArrowRight className="mr-2 h-4 w-4" />
          </Button>
          <p className="text-[10px] text-muted-foreground text-center max-w-sm">
            بالنقر على تفعيل، أنت توافق على شروط الخدمة وسياسة الفترة التجريبية (14 يوماً، بحد أقصى 5 مستخدمين).
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
