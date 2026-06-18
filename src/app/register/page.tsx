
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Sparkles, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; link?: string; linkText?: string } | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Create Company
      const companyId = `comp_${Date.now()}`;
      
      // المحاولة الأولى للكتابة في Firestore
      await setDoc(doc(db, 'companies', companyId), {
        name: companyName,
        createdAt: serverTimestamp(),
      });

      // 3. Create Global User Map
      await setDoc(doc(db, 'global_users', user.uid), {
        companyId: companyId,
        role: 'admin',
        isDeveloper: true,
      });

      // 4. Create Local User Profile
      await setDoc(doc(db, 'companies', companyId, 'users', user.uid), {
        displayName: 'مدير النظام',
        email: email,
        joinedAt: serverTimestamp(),
      });

      document.cookie = `session=true; path=/; max-age=${60 * 60 * 24 * 7}`;
      router.push('/dashboard');
    } catch (err: any) {
      console.error("Registration Error:", err);
      
      if (err.code === 'auth/configuration-not-found') {
        setError({
          message: 'يرجى تفعيل خيار (Email/Password) في قسم Authentication داخل لوحة تحكم Firebase.',
          link: 'https://console.firebase.google.com/project/_/authentication/providers',
          linkText: 'تفعيل خيار تسجيل الدخول'
        });
      } else if (err.code === 'permission-denied' || err.message?.includes("offline")) {
        setError({
          message: 'فشل الوصول لقاعدة البيانات. يرجى التأكد من إنشاء Firestore Database في لوحة التحكم وتفعيل وضع الاختبار (Test Mode).',
          link: 'https://console.firebase.google.com/project/_/firestore',
          linkText: 'إنشاء Firestore Database'
        });
      } else {
        setError({ 
          message: err.message || 'حدث خطأ غير متوقع. تأكد من اتصال الإنترنت وإعدادات Firebase.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-2 rotate-3">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black font-headline tracking-tight">إنشاء حساب جديد</CardTitle>
            <CardDescription className="text-lg">ابدأ بناء منظومتك الهندسية مع NovaFlow</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="rounded-2xl border-2 bg-destructive/5">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>إجراء مطلوب</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>{error.message}</span>
                  {error.link && (
                    <a 
                      href={error.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1 font-bold underline hover:text-primary mt-2"
                    >
                      {error.linkText || 'اذهب للرابط'} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="company">اسم الشركة / المؤسسة</Label>
              <Input
                id="company"
                type="text"
                placeholder="شركة الإنشاءات الحديثة"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="h-12 rounded-xl border-2 border-muted focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-2 border-muted focus:border-primary/50 transition-all text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-2 border-muted focus:border-primary/50 transition-all text-left"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary text-white rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري إنشاء الحساب...
                </>
              ) : (
                'إنشاء حساب NovaFlow'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-10 pt-4 flex flex-col space-y-4">
          <Button variant="link" onClick={() => router.push('/login')} className="text-muted-foreground">
            لديك حساب بالفعل؟ سجل دخولك
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
