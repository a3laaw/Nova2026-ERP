
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';

interface GlobalUserData {
  companyId: string;
  role: string;
  isDeveloper?: boolean;
  username: string;
}

interface AuthContextType {
  user: User | null;
  globalUser: GlobalUserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const db = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [globalUser, setGlobalUser] = useState<GlobalUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // حساب المطور الرئيسي للتجربة (Hardcoded Developer)
          if (firebaseUser.email === 'admin@novaflow.com') {
            setGlobalUser({
              companyId: 'dev_hq',
              role: 'developer',
              isDeveloper: true,
              username: 'super_dev'
            });
          } else {
            const docRef = doc(db, 'global_users', firebaseUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setGlobalUser(docSnap.data() as GlobalUserData);
            } else {
              setGlobalUser(null);
            }
          }
        } catch (err: any) {
          // الخطأ يعالج مركزياً، لا نستخدم console.log
          setError("حدث خطأ في جلب بيانات المستخدم.");
        }
      } else {
        setGlobalUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, db]);

  const logout = async () => {
    if (auth) {
      await signOut(auth);
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  };

  return (
    <AuthContext.Provider value={{ user, globalUser, loading, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};
