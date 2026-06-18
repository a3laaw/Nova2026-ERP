
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    activity: 'construction',
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const router = useRouter();
  const db = useFirestore();

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'company_requests'), {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setIsSubmitted(true);
      toast({
        title: "تم إرسال الطلب بنجاح",
        description: "سيتواصل معك فريقنا قريباً بعد مراجعة البيانات.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الإرسال",
        description: "تعذر إرسال طلبك حالياً، يرجى المحاولة لاحقاً.",
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
            <CardTitle className="text-2xl font-black font-headline">شكراً لك!</CardTitle>
            <CardDescription className="text-lg">
              تم استلام طلب شركة <span className="font-bold text-primary">{formData.companyName}</span> بنجاح.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-10 space-y-4">
            <p className="text-muted-foreground">
              طلبك الآن قيد المراجعة من قبل الإدارة الفنية. ستصلك رسالة تفعيل على البريد الإلكتروني فور الموافقة.
            </p>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full rounded-2xl py-6">
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-2 rotate-3">
            <Sparkles className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-black font-headline">طلب انضمام للمنظومة</CardTitle>
          <CardDescription className="text-lg">ابدأ رحلة التحول الرقمي لشركتك الهندسية مع NovaFlow</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الشركة / المكتب</Label>
              <Input 
                value={formData.companyName} 
                onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                required 
                className="h-12 rounded-xl border-2" 
                placeholder="مثال: شركة نوفا للإنشاءات"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المسؤول</Label>
                <Input 
                  value={formData.contactName} 
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})} 
                  required 
                  className="h-12 rounded-xl border-2" 
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
            <div className="space-y-2">
              <Label>رقم التواصل (واتساب)</Label>
              <Input 
                type="tel" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                required 
                className="h-12 rounded-xl border-2 text-left" 
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white rounded-2xl text-lg font-bold mt-4">
              {loading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : 'إرسال طلب التفعيل'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-10 pt-4 justify-center">
          <Button variant="link" onClick={() => router.push('/login')} className="text-muted-foreground">
            لديك حساب بالفعل؟ سجل دخولك <ArrowRight className="mr-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
