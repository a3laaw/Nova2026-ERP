'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Sparkles, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      document.cookie = `session=true; path=/; max-age=${60 * 60 * 24 * 7}`;
      router.push('/');
    } catch (err: any) {
      setError('فشل تسجيل الدخول. يرجى التأكد من البريد الإلكتروني وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf3] p-4">
      <Card className="w-full max-w-md border-0 shadow-3xl rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl mb-2 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black font-headline tracking-tight">NovaFlow ERP</CardTitle>
            <CardDescription className="text-lg font-bold">بوابة الدخول الموحدة للمنشآت</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="rounded-2xl border-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-start">خطأ</AlertTitle>
                <AlertDescription className="text-start font-bold">{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">البريد الإلكتروني</Label>
              <Input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-2 text-left font-bold"
                dir="ltr"
              />
            </div>
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">كلمة المرور</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-2 text-left font-bold"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-primary text-white rounded-2xl text-xl font-black shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all"
            >
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'تسجيل الدخول'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-10 pt-4 flex flex-col space-y-4 text-center">
          <Button variant="link" onClick={() => router.push('/register')} className="text-primary font-black gap-2">
            <Building2 className="h-4 w-4" /> تسجيل شركة جديدة
          </Button>
          <p className="text-[10px] text-muted-foreground font-bold italic">
            تنبيه: إذا كنت موظفاً، يجب أن تحصل على دعوة من مديرك لتفعيل حسابك.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
