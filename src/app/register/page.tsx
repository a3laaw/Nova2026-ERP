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
import { Sparkles, Loader2, AlertCircle, ArrowRight, Eye, EyeOff, Building2, Clock } from 'lucide-react';
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

  const handleRequestRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth) return;

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      await updateProfile(userCredential.user, { displayName: formData.contactName });

      const batch = writeBatch(db);
      const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
      
      const requestRef = doc(collection(db, 'company_requests'));
      batch.set(requestRef, {
        id: requestRef.id,
        companyId: companyId,
        ownerUid: uid, 
        companyName: formData.companyName,
        contactName: formData.contactName,
        email: formData.email,
        activity: formData.activity,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      const companyRef = doc(db, 'companies', companyId);
      const companyData = {
        id: companyId,
        name: formData.companyName,
        status: 'inactive', 
        subscriptionType: 'trial',
        maxUsers: 5,
        activity: formData.activity, 
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(companyRef, companyData);

      const globalUserRef = doc(db, 'global_users', uid);
      const globalUserData = {
        companyId,
        roleCode: 'ADMIN', // توحيد قسري للحروف الكبيرة
        role: 'admin',      // توحيد قسري للحروف الصغيرة
        fullName: formData.contactName, 
        username: formData.username || formData.email.split('@')[0],
        email: formData.email,
        isActive: true, 
        isPendingApproval: true,
        updatedAt: serverTimestamp()
      };
      batch.set(globalUserRef, globalUserData);

      const tenantUserRef = doc(db, 'companies', companyId, 'users', uid);
      batch.set(tenantUserRef, {
        id: uid,
        displayName: formData.contactName,
        email: formData.email,
        username: formData.username || formData.email.split('@')[0],
        roleCode: 'ADMIN',
        role: 'admin',
        joinedAt: serverTimestamp(),
        isActive: true
      });

      await batch.commit();

      setIsSubmitted(true);
      toast({ title: "تم إرسال طلبك بنجاح" });

    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: error.message });
    } finally {
      setLoading(false);
    }
  };

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
              شكراً لاهتمامك بـ NovaFlow. لقد تم تسجيل منشأة <span className="text-primary">{formData.companyName}</span> بنجاح. سيتم تفعيل حسابك كمدير للنظام فوراً للمباشرة بالإعدادات.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-16">
             <Button onClick={() => router.push('/login')} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl">العودة لصفحة الدخول</Button>
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
            <CardTitle className="text-4xl font-black font-headline tracking-tighter text-slate-900">انضم إلى NovaFlow ERP</CardTitle>
            <CardDescription className="text-slate-500 font-bold text-lg">سجل منشأتك للحصول على السيطرة المطلقة على عملياتك</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-12">
          <form onSubmit={handleRequestRegistration} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">اسم المنشأة / الشركة</Label>
                <Input value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} required className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50" />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">نوع النشاط</Label>
                <Select value={formData.activity} onValueChange={(val) => setFormData({...formData, activity: val})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-0 shadow-2xl">
                    <SelectItem value="construction" className="font-bold">مقاولات وإنشاءات</SelectItem>
                    <SelectItem value="consulting" className="font-bold">استشارات هندسية</SelectItem>
                    <SelectItem value="design_build" className="font-bold text-primary">تصميم وإنشاء (D&B)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">اسم المدير المسؤول</Label>
                <Input value={formData.contactName} onChange={(e) => setFormData({...formData, contactName: e.target.value})} required className="h-14 rounded-2xl border-2 font-bold bg-slate-50/50" />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">البريد الإلكتروني للشركة</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className="h-14 rounded-2xl border-2 text-left bg-slate-50/50" dir="ltr" />
              </div>
              <div className="space-y-2 text-start md:col-span-2">
                <Label className="font-black text-xs text-slate-400 uppercase tracking-widest">كلمة المرور</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required className="h-14 rounded-2xl border-2 text-left bg-slate-50/50" dir="ltr" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><Eye className="h-5 w-5" /></button>
                </div>
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="w-full h-20 bg-primary text-white rounded-[2rem] text-2xl font-black shadow-xl shadow-primary/20 border-b-8 border-orange-700 mt-6">
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : 'إرسال طلب الانضمام والبدء'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-12 pt-4 justify-center">
          <Button variant="link" onClick={() => router.push('/login')} className="text-primary font-black text-lg">
            لديك حساب بالفعل؟ سجل دخولك <ArrowRight className="mr-2 h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
