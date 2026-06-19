'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Role } from '@/types/roles';

interface GlobalUserData {
  companyId: string;
  role: string;
  roleId?: string;
  roleCode?: string;
  isDeveloper?: boolean;
  username: string;
}

interface AuthContextType {
  user: User | null;
  globalUser: GlobalUserData | null;
  roleData: Role | null; // إضافة بيانات الدور المباشرة
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
  const [roleData, setRoleData] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          if (firebaseUser.email === 'admin@novaflow.com') {
            const devData: GlobalUserData = {
              companyId: 'dev_hq',
              role: 'developer',
              isDeveloper: true,
              username: 'super_dev'
            };
            setGlobalUser(devData);
            setRoleData({ permissions: ['*'] } as any);
            setLoading(false);
          } else {
            // جلب بيانات المستخدم العالمي
            const docRef = doc(db, 'global_users', firebaseUser.uid);
            const unsubscribeGlobalUser = onSnapshot(docRef, (snap) => {
              if (snap.exists()) {
                const gData = snap.data() as GlobalUserData;
                setGlobalUser(gData);

                // إذا وجدنا RoleId، نقوم بجلب بيانات الصلاحيات فوراً
                if (gData.companyId && gData.roleId) {
                  const roleRef = doc(db, 'companies', gData.companyId, 'roles', gData.roleId);
                  onSnapshot(roleRef, (roleSnap) => {
                    if (roleSnap.exists()) {
                      setRoleData(roleSnap.data() as Role);
                    }
                    setLoading(false);
                  });
                } else {
                  setRoleData(null);
                  setLoading(false);
                }
              } else {
                setGlobalUser(null);
                setRoleData(null);
                setLoading(false);
              }
            });

            return () => unsubscribeGlobalUser();
          }
        } catch (err: any) {
          setError("حدث خطأ في جلب بيانات المستخدم.");
          setLoading(false);
        }
      } else {
        setGlobalUser(null);
        setRoleData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, db]);

  const logout = async () => {
    if (auth) {
      await signOut(auth);
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  };

  return (
    <AuthContext.Provider value={{ user, globalUser, roleData, loading, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};
