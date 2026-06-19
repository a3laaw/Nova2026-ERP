'use client';

import React from 'react';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

interface PrintWrapperProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function PrintWrapper({ children, title, className }: PrintWrapperProps) {
  const { company } = useCompanyContext();
  const { dir } = useLanguage();

  if (!company) return <>{children}</>;

  return (
    <div className={cn("w-full bg-white print:p-0", className)} dir={dir}>
      {/* Header Section (Visible only in Print or Preview) */}
      <header className="mb-8 border-b pb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="w-32 h-32 flex items-center justify-center border rounded-2xl overflow-hidden bg-slate-50">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
            ) : (
              <span className="text-[10px] font-black text-slate-300 uppercase">Logo</span>
            )}
          </div>
          <div className="text-end">
            <h1 className="text-2xl font-black font-headline text-slate-900">{company.name}</h1>
            <p className="text-xs font-bold text-muted-foreground mt-1">الرقم الضريبي / السجل: {company.commercialRegistry || '---'}</p>
          </div>
        </div>

        {/* Visual Header (Image or Text) */}
        <div className="w-full min-h-[60px] flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">
          {company.headerImageUrl ? (
            <img src={company.headerImageUrl} alt="Header" className="w-full h-auto object-contain" />
          ) : company.headerText ? (
            <p className="text-sm font-bold text-slate-700 text-center px-4 leading-relaxed">{company.headerText}</p>
          ) : (
            <div className="h-2 w-full bg-primary" />
          )}
        </div>
      </header>

      {/* Report Title */}
      {title && (
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black font-headline uppercase tracking-tighter border-y-2 border-slate-900 py-4 inline-block px-12">
            {title}
          </h2>
          <p className="text-[10px] font-black text-muted-foreground mt-2 uppercase tracking-[0.2em]">
            NovaFlow Intelligence System / Official Report
          </p>
        </div>
      )}

      {/* Main Content */}
      <main className="min-h-[500px]">
        {children}
      </main>

      {/* Footer Section */}
      <footer className="mt-12 pt-6 border-t">
        <div className="w-full min-h-[60px] flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden mb-6">
          {company.footerImageUrl ? (
            <img src={company.footerImageUrl} alt="Footer" className="w-full h-auto object-contain" />
          ) : company.footerText ? (
            <p className="text-[10px] font-bold text-slate-500 text-center px-4 leading-tight">{company.footerText}</p>
          ) : (
            <p className="text-[9px] text-muted-foreground italic">هذا المستند صادر آلياً من نظام NovaFlow ERP</p>
          )}
        </div>
        
        <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
          <span>{new Date().toLocaleString()}</span>
          <span>صفحة 1 من 1</span>
          <span>{company.address || 'Kuwait City'}</span>
        </div>
      </footer>
    </div>
  );
}
