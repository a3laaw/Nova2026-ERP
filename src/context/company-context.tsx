
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuthContext } from './auth-context';
import { differenceInDays, parseISO } from 'date-fns';

interface CompanyData {
  id: string;
  name: string;
  status: string; // active, inactive, expired, suspended
  subscriptionType: 'trial' | 'monthly' | 'annual';
  expiryDate?: string;
  maxUsers: number;
  [key: string]: any;
}

interface CompanyContextType {
  company: CompanyData | null;
  loading: boolean;
  subscription: {
    isExpired: boolean;
    isTrial: boolean;
    daysRemaining: number;
    showWarning: boolean;
    status: string;
  };
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

    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'companies', globalUser.companyId), (snap) => {
      if (snap.exists()) {
        setCompany({ id: snap.id, ...snap.data() } as CompanyData);
      } else {
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, globalUser?.companyId]);

  const subscription = React.useMemo(() => {
    if (!company) return { isExpired: false, isTrial: false, daysRemaining: 0, showWarning: false, status: 'unknown' };

    const now = new Date();
    const expiry = company.expiryDate ? parseISO(company.expiryDate) : null;
    const daysRemaining = expiry ? differenceInDays(expiry, now) : 999;
    
    const isExpired = company.status === 'expired' || (expiry !== null && daysRemaining < 0);
    const isTrial = company.subscriptionType === 'trial';

    // ذكاء التنبيه:
    // 1. إذا كانت فترة تجربة: اظهر التنبيه دوماً طالما لم تنتهي.
    // 2. إذا كان اشتراك مدفوع: اظهر التنبيه قبل 5 أيام من الانتهاء.
    let showWarning = false;
    if (!isExpired) {
      if (isTrial) {
        showWarning = true; // تظهر كل يوم في الـ Trial
      } else if (expiry !== null && daysRemaining <= 5) {
        showWarning = true; // تظهر قبل 5 أيام في الاشتراك الرسمي
      }
    }

    return {
      isExpired,
      isTrial,
      daysRemaining: Math.max(0, daysRemaining),
      showWarning,
      status: company.status
    };
  }, [company]);

  return (
    <CompanyContext.Provider value={{ company, loading, subscription }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompanyContext = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompanyContext must be used within CompanyProvider');
  return context;
};
