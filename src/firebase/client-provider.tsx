'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';
import { Loader2 } from 'lucide-react';

// ضمان وجود نسخة واحدة فقط على مستوى المتصفح
let initializedApp: FirebaseApp | undefined;
let initializedAuth: Auth | undefined;
let initializedDb: Firestore | undefined;

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // التحقق مما إذا كانت الإعدادات قد تم تعبئتها بالفعل
    const isConfigMissing = !firebaseConfig.apiKey || 
                           firebaseConfig.apiKey.includes("YOUR_") || 
                           firebaseConfig.apiKey === "";

    if (isConfigMissing) {
      setError(true);
      setIsReady(true);
      return;
    }

    try {
      if (!initializedApp) {
        initializedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        initializedAuth = getAuth(initializedApp);
        initializedDb = getFirestore(initializedApp);
      }
      setIsReady(true);
    } catch (err) {
      console.error("Firebase initialization error:", err);
      setError(true);
      setIsReady(true);
    }
  }, []);

  // واجهة الانتظار حتى استقرار النسخة في المتصفح
  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // واجهة إرشادية في حال عدم اكتمال الإعدادات
  if (error || !initializedApp || !initializedAuth || !initializedDb) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center" dir="rtl">
        <div className="max-w-md space-y-6 bg-white p-10 rounded-3xl shadow-2xl border-2 border-primary/10">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h1 className="text-2xl font-black font-headline tracking-tight text-secondary-foreground">إعدادات Firebase غير مكتملة</h1>
          <p className="text-muted-foreground leading-relaxed">
            يرجى التأكد من وضع المفاتيح الصحيحة في ملف <code className="bg-muted px-1 rounded font-mono text-xs">src/firebase/config.ts</code>.
          </p>
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-4 font-bold">تجد المفاتيح في Firebase Console تحت Project Settings.</p>
            <div className="animate-pulse bg-primary/10 h-2 w-full rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider firebaseApp={initializedApp} auth={initializedAuth} firestore={initializedDb}>
      {children}
    </FirebaseProvider>
  );
}
