'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuthContext } from './auth-context';

interface CompanyData {
  id: string;
  name: string;
  logo?: string;
  settings?: any;
}

interface CompanyContextType {
  company: CompanyData | null;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore();
  const { globalUser } = useAuthContext();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !globalUser?.companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'companies', globalUser.companyId), (doc) => {
      if (doc.exists()) {
        setCompany({ id: doc.id, ...doc.data() } as CompanyData);
      } else {
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, globalUser]);

  return (
    <CompanyContext.Provider value={{ company, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompanyContext = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompanyContext must be used within CompanyProvider');
  return context;
};
