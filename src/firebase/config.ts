'use client';

/**
 * إعدادات Firebase.
 * يرجى استبدال القيم أدناه بالقيم الحقيقية من Firebase Console.
 * يمكنك العثور عليها في Project Settings -> General -> Your apps.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "ضع_هنا_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ضع_هنا_PROJECT_ID.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ضع_هنا_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ضع_هنا_PROJECT_ID.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "ضع_هنا_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "ضع_هنا_APP_ID",
};
