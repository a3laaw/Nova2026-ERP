'use client';

import React, { useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => {
    // التحقق مما إذا كانت الإعدادات قد تم ملؤها أم لا تزال تحتوي على القيم الافتراضية
    const isConfigReady = firebaseConfig.apiKey && 
                         firebaseConfig.apiKey !== "" && 
                         !firebaseConfig.apiKey.includes("YOUR_");

    if (!isConfigReady) {
      return { app: null, auth: null, db: null };
    }

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      return { app, auth, db };
    } catch (error) {
      console.error("Firebase initialization error:", error);
      return { app: null, auth: null, db: null };
    }
  }, []);

  const { app, auth, db } = services;

  // واجهة إرشادية للمستخدم في حال عدم اكتمال الإعدادات
  if (!app || !auth || !db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center" dir="rtl">
        <div className="max-w-md space-y-6 bg-white p-10 rounded-3xl shadow-2xl border-2 border-primary/10">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h1 className="text-2xl font-black font-headline tracking-tight text-secondary-foreground">إعدادات Firebase مفقودة</h1>
          <p className="text-muted-foreground leading-relaxed">
            يرجى نسخ إعدادات مشروعك من لوحة تحكم Firebase ولصقها في الملف التالي للبدء:
          </p>
          <div className="bg-muted p-4 rounded-xl text-left font-mono text-xs overflow-x-auto" dir="ltr">
            src/firebase/config.ts
          </div>
          <div className="pt-4">
            <p className="text-xs text-muted-foreground mb-4">تجد هذه الإعدادات في: Project Settings {'>'} Your Apps {'>'} Config</p>
            <div className="animate-pulse bg-primary/5 h-2 w-full rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider firebaseApp={app} auth={auth} firestore={db}>
      {children}
    </FirebaseProvider>
  );
}
