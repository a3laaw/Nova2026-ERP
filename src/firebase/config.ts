'use client';

/**
 * @fileOverview إعدادات Firebase — نسخة محمولة (Platform-agnostic).
 *
 * ⚠️ قبل 2026-11: كانت القيم مكتوبة ثابتة وتشير إلى مشروع منصة التطوير
 *     (studio-2485061478-24bde). الآن القيم تُقرأ من متغيرات البيئة أولاً،
 *     مع fallback للقيم القديمة حتى لا يتوقف العمل الحالي.
 *
 * عند النقل إلى مشروع/منصة جديدة: لا تعدّل هذا الملف — ضع القيم في .env فقط.
 *   NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET
 *   / MESSAGING_SENDER_ID / APP_ID
 */

const env = (key: string, fallback: string) => {
  const v = process.env[key];
  return v && v.trim() !== '' && !v.includes('REPLACE_') ? v.trim() : fallback;
};

/** قيم مشروع المنصة الأصلية — تُستخدم فقط كخطة بديلة مؤقتة */
const LEGACY = {
  apiKey: 'AIzaSyBgegLx1kBUwaCLGRapZX8R7Djas9uVEjo',
  authDomain: 'studio-2485061478-24bde.firebaseapp.com',
  projectId: 'studio-2485061478-24bde',
  storageBucket: 'studio-2485061478-24bde.firebasestorage.app',
  messagingSenderId: '1094628419873',
  appId: '1:1094628419873:web:b60ec6cf4a3d287f283660',
};

export const firebaseConfig = {
  apiKey: env('NEXT_PUBLIC_FIREBASE_API_KEY', LEGACY.apiKey),
  authDomain: env('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', LEGACY.authDomain),
  projectId: env('NEXT_PUBLIC_FIREBASE_PROJECT_ID', LEGACY.projectId),
  storageBucket: env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', LEGACY.storageBucket),
  messagingSenderId: env('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', LEGACY.messagingSenderId),
  appId: env('NEXT_PUBLIC_FIREBASE_APP_ID', LEGACY.appId),
};

/** هل ما زلنا متصلين بمشروع المنصة القديم؟ (يُستخدم للتحذير في الـ console والـ developer panel) */
export const isLegacyStudioProject = firebaseConfig.projectId === LEGACY.projectId;

export const firebaseConfigStatus = {
  usingEnv: !isLegacyStudioProject,
  projectId: firebaseConfig.projectId,
  missing: Object.values(firebaseConfig).some((v) => !v || v.includes('YOUR_')),
};
