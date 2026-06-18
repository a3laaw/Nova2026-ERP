'use client';

import { FirebaseClientProvider } from '@/firebase';
import { AuthProvider } from '@/context/auth-context';
import { CompanyProvider } from '@/context/company-context';
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <CompanyProvider>
          {children}
          <Toaster />
        </CompanyProvider>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
