'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Role } from '@/types/roles';

interface GlobalUserData {
  companyId: string;
  role: string;
  roleId?: string;
  roleCode?: string;
  departmentId?: string; // إضافة معرف القسم للتحقق من الصلاحيات
  isDeveloper?: boolean;
  username: string;
}

interface AuthContextType {
  user: User | null;
  globalUser: GlobalUserData | null;
  roleData: Role | null;
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
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setGlobalUser(null);
        setRoleData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!db || !user) return;

    if (user.email === 'admin@novaflow.com') {
      setGlobalUser({
        companyId: 'dev_hq',
        role: 'developer',
        isDeveloper: true,
        username: 'super_dev',
        departmentId: 'HQ'
      });
      setRoleData({ permissions: ['*'], code: 'ADMIN' } as any);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'global_users', user.uid);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GlobalUserData;
        setGlobalUser(data);
        if (!data.roleId) setLoading(false);
      } else {
        setGlobalUser(null);
        setLoading(false);
      }
    }, (err) => {
      console.error("Global user snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, user]);

  useEffect(() => {
    if (!db || !globalUser?.companyId || !globalUser?.roleId) {
      setRoleData(null);
      if (globalUser && !globalUser.roleId) setLoading(false);
      return;
    }

    const roleRef = doc(db, 'companies', globalUser.companyId, 'roles', globalUser.roleId);
    const unsubscribe = onSnapshot(roleRef, (snap) => {
      if (snap.exists()) {
        setRoleData(snap.data() as Role);
      } else {
        setRoleData(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Role snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, globalUser?.companyId, globalUser?.roleId]);

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
