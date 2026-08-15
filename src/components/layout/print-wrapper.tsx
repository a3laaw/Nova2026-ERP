'use client';

import React from 'react';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Landmark } from 'lucide-react';

interface PrintWrapperProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  fullWidth?: boolean; 
}

/**
 * غطاء الطباعة السيادي (Sovereign Print Wrapper).
 * تم تحديثه ليعتمد على العرض الكامل في المتصفح ويتقيد بالقياس الورقي عند الطباعة فقط.
 */
export function PrintWrapper({ children, title, className, fullWidth = false }: PrintWrapperProps) {
  const { company } = useCompanyContext();
  const { dir, isRtl } = useLanguage();

  if (!company) return <>{children}</>;

  return (
    <div className={cn("w-full transition-all", className)} dir={dir}>
      {/* المستند الفعلي المصمم كـ "ورقة" */}
      <div className={cn(
        "mx-auto bg-white shadow-[0_0_50px_rgba(0,0,0,0.05)] print:shadow-none min-h-[297mm] p-8 md:p-12 border-2 border-slate-100 print:border-0 rounded-sm print:rounded-none relative overflow-hidden",
        fullWidth ? "w-full max-w-[1600px]" : "w-full max-w-[1400px] print:max-w-[210mm]"
      )}>
        
        {/* شريط زينة علوي سيادي بالألوان الجديدة */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent print:hidden" />

        {/* Header Section */}
        <header className="mb-10 border-b-4 border-primary/20 pb-8">
          <div className="flex justify-between items-start mb-8">
            <div className="w-24 h-24 flex items-center justify-center border-2 border-slate-50 rounded-2xl overflow-hidden bg-white shadow-sm shrink-0">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
              ) : (
                <div className="text-[8px] font-black text-slate-200 uppercase text-center leading-none">NOVA<br/>LOGO</div>
              )}
            </div>
            <div className="text-end space-y-1">
              <h1 className="text-xl font-black font-headline text-slate-900 leading-tight">{company.name}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isRtl ? 'الرقم الضريبي / السجل:' : 'TAX / REG NO:'} {company.commercialRegistry || '---'}
              </p>
              <p className="text-[10px] font-bold text-slate-400">{company.address || 'Kuwait City'}</p>
            </div>
          </div>

          {/* Visual Sub-Header */}
          {company.headerText && (
            <div className="bg-primary/5 p-4 rounded-2xl border-2 border-white shadow-inner">
               <p className="text-[10px] font-bold text-slate-700 text-center leading-relaxed italic">{company.headerText}</p>
            </div>
          )}
        </header>

        {/* Report Title Section */}
        {title && (
          <div className="mb-12 text-center relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
               <div className="w-full border-t-2 border-dashed border-slate-100"></div>
            </div>
            <div className="relative flex justify-center">
               <span className="bg-white px-8">
                  <h2 className="text-2xl font-black font-headline uppercase tracking-tighter text-slate-900">
                    {title}
                  </h2>
               </span>
            </div>
            <p className="text-[8px] font-black text-slate-300 mt-2 uppercase tracking-[0.4em]">
              Sovereign ERP Intelligence / Official Document
            </p>
          </div>
        )}

        {/* Main Content */}
        <main className="text-start">
          {children}
        </main>

        {/* Footer Section */}
        <footer className="mt-20 pt-8 border-t-2 border-slate-50">
          <div className="flex justify-between items-end gap-10">
            <div className="text-start space-y-1 opacity-40">
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ الاستخراج' : 'Generated On'}</p>
               <p className="text-[8px] font-mono font-bold text-slate-500">{new Date().toLocaleString()}</p>
            </div>
            
            {company.footerText ? (
              <p className="text-[9px] font-bold text-slate-400 text-center flex-1 italic max-w-sm">{company.footerText}</p>
            ) : (
              <div className="flex-1 text-center">
                <p className="text-[7px] text-slate-300 italic">هذا المستند صادر آلياً من نظام NovaFlow ERP ولا يحتاج لتوقيع في حال الاعتماد الرقمي.</p>
              </div>
            )}

            <div className="text-end opacity-20">
               <Landmark className="h-10 w-10 text-primary" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}