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
import { Sparkles, Loader2, CheckCircle2, ArrowRight, Eye, EyeOff, Building2 } from 'lucide-react';
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
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      await updateProfile(userCredential.user, { displayName: formData.contactName });

      const batch = writeBatch(db);
      const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
      
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // سجل الطلب
      const requestRef = doc(collection(db, 'company_requests'));
      batch.set(requestRef, {
        companyName: formData.companyName,
        contactName: formData.contactName,
        email: formData.email,
        activity: formData.activity,
        status: 'activated',
        createdAt: serverTimestamp(),
      });

      // سجل المنشأة
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

      // السجل العالمي للمدير
      const globalUserRef = doc(db, 'global_users', uid);
      batch.set(globalUserRef, {
        companyId,
        role: 'admin',
        username: formData.username || formData.email.split('@')[0],
        isDeveloper: false,
        email: formData.email,
        isActive: true,
        updatedAt: serverTimestamp()
      });

      // سجل المستخدم داخل المنشأة
      const tenantUserRef = doc(db, 'companies', companyId, 'users', uid);
      batch.set(tenantUserRef, {
        displayName: formData.contactName,
        email: formData.email,
        joinedAt: serverTimestamp(),
        role: 'admin',
        isActive: true
      });

      await batch.commit();
      
      setIsSubmitted(true);
      toast({
        title: "مبروك! تم تفعيل منشأتك",
        description: "بدأت الآن فترة تجريبية لمدة 14 يوماً مع كامل الصلاحيات.",
      });

      document.cookie = `session=true; path=/; max-age=${60 * 60 * 24 * 7}`;
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
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf3] p-6" dir="rtl">
      <Card className="w-full max-w-2xl border-0 shadow-3xl rounded-[3rem] overflow-hidden bg-white">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center bg-slate-900 text-white">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl mb-2 rotate-3">
            <Building2 className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-black font-headline">NovaFlow لأصحاب الأعمال</CardTitle>
          <CardDescription className="text-slate-400 font-bold">سجل منشأتك الجديدة واحصل على 14 يوماً تجريبية مجانية</CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <form onSubmit={handleAutomaticProvisioning} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase">اسم المنشأة / الشركة</Label>
                <Input 
                  value={formData.companyName} 
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2 font-bold" 
                  placeholder="شركة المقاولات الحديثة"
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase">نوع النشاط</Label>
                <Select value={formData.activity} onValueChange={(val) => setFormData({...formData, activity: val})}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction" className="font-bold">مقاولات وإنشاءات</SelectItem>
                    <SelectItem value="consulting" className="font-bold">استشارات هندسية</SelectItem>
                    <SelectItem value="general" className="font-bold">تجارة عامة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase">اسم المدير المسؤول</Label>
                <Input 
                  value={formData.contactName} 
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2 font-bold" 
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase">اسم المستخدم الفريد</Label>
                <Input 
                  value={formData.username} 
                  onChange={(e) => setFormData({...formData, username: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2 font-mono text-sm" 
                  placeholder="admin_nova"
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase">البريد الإلكتروني للشركة</Label>
                <Input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2 text-left" 
                  dir="ltr"
                />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase">كلمة المرور</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    required 
                    className="h-12 rounded-xl border-2 text-left" 
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl text-xl font-black shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'تفعيل المنشأة والبدء فوراً'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-10 pt-4 justify-center flex-col space-y-4">
          <Button variant="link" onClick={() => router.push('/login')} className="text-primary font-black">
            لديك حساب شركة بالفعل؟ سجل دخولك <ArrowRight className="mr-2 h-4 w-4" />
          </Button>
          <p className="text-[10px] text-muted-foreground text-center max-w-sm font-bold">
            هذه الصفحة مخصصة لإنشاء **منشآت جديدة** فقط. إذا كنت موظفاً، يرجى طلب "رابط تفعيل حساب" من مدير النظام بشركتك.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
