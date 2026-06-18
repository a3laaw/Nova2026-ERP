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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const companyId = `comp_${Date.now()}`;
      
      const companyRef = doc(db, 'companies', companyId);
      const globalUserRef = doc(db, 'global_users', user.uid);
      const userProfileRef = doc(db, 'companies', companyId, 'users', user.uid);

      setDoc(companyRef, {
        name: companyName,
        createdAt: serverTimestamp(),
      }).catch(async (err) => {
        if (err.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: companyRef.path,
            operation: 'create',
            requestResourceData: { name: companyName }
          }));
        }
      });

      setDoc(globalUserRef, {
        companyId: companyId,
        role: 'admin',
        isDeveloper: true,
      }).catch(async (err) => {
        if (err.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: globalUserRef.path,
            operation: 'create'
          }));
        }
      });

      setDoc(userProfileRef, {
        displayName: 'مدير النظام',
        email: email,
        joinedAt: serverTimestamp(),
      }).catch(async (err) => {
        if (err.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userProfileRef.path,
            operation: 'create'
          }));
        }
      });

      document.cookie = `session=true; path=/; max-age=${60 * 60 * 24 * 7}`;
      router.push('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/configuration-not-found') {
        setError({
          message: 'يرجى تفعيل خيار (Email/Password) في قسم Authentication داخل لوحة تحكم Firebase أولاً.',
          link: 'https://console.firebase.google.com/project/_/authentication/providers',
          linkText: 'تفعيل خيار تسجيل الدخول'
        });
      } else {
        setError({ message: err.message || 'حدث خطأ أثناء التسجيل.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-2 rotate-3">
            <Sparkles className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-black">إنشاء حساب جديد</CardTitle>
          <CardDescription className="text-lg">ابدأ بناء منظومتك الهندسية مع NovaFlow</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="rounded-2xl border-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>إجراء مطلوب</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>{error.message}</span>
                  {error.link && (
                    <a href={error.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-bold underline">
                      {error.linkText} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>اسم الشركة</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl text-left" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-xl text-left" dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white rounded-2xl text-lg font-bold">
              {loading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : 'إنشاء حساب NovaFlow'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
