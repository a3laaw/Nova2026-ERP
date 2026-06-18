
'use client';

import { FirebaseClientProvider } from '@/firebase';
import { AuthProvider } from '@/context/auth-context';
import { CompanyProvider } from '@/context/company-context';
import { LanguageProvider } from '@/context/language-context';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <CompanyProvider>
          <LanguageProvider>
            <FirebaseErrorListener />
            {children}
            <Toaster />
          </LanguageProvider>
        </CompanyProvider>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
