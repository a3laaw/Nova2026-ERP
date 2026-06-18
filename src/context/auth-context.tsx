'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';

interface GlobalUserData {
  companyId: string;
  role: string;
  isDeveloper?: boolean;
}

interface AuthContextType {
  user: User | null;
  globalUser: GlobalUserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const db = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [globalUser, setGlobalUser] = useState<GlobalUserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'global_users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setGlobalUser(docSnap.data() as GlobalUserData);
        } else {
          setGlobalUser(null);
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
      // Clean up session storage/cookies if any
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  };

  return (
    <AuthContext.Provider value={{ user, globalUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};
