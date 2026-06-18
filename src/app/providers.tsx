'use client';

import { FirebaseClientProvider } from '@/firebase';
import { AuthProvider } from '@/context/auth-context';
import { CompanyProvider } from '@/context/company-context';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <CompanyProvider>
          <FirebaseErrorListener />
          {children}
          <Toaster />
        </CompanyProvider>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}