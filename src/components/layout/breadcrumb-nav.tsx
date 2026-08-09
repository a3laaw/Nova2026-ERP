'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight, Home } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, isRtl } = useLanguage();

  const segments = pathname.split('/').filter(Boolean);

  const formatSegment = (segment: string) => {
    const sLower = segment.toLowerCase();
    
    // التحقق مما إذا كان الجزء يمثل معرفاً (ID) طويل أو يحتوي على أرقام
    if (segment.length > 15 || /\d/.test(segment)) {
      return t('details');
    }
    
    // خريطة المسارات الموحدة لربط روابط المتصفح بالقاموس المركزي
    const segmentMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'clients': 'clients',
      'projects': 'projects',
      'hr': 'hr',
      'accounting': 'accounting',
      'procurement': 'procurement',
      'inventory': 'inventory',
      'settings': 'settings',
      'transactions': 'transactions',
      'employees': 'staffRecords',
      'payroll': 'payroll',
      'boqs': 'boqExplorer',
      'leaves': 'leaveRequests',
      'reports': 'reports',
      'client-visits': 'visitsDossier',
      'crm': 'crm',
      'equipment': 'equipment',
      'groups': 'workGroups',
      'attendance': 'attendance',
      'vouchers': 'paymentVouchers',
      'coa': 'chartOfAccounts',
      'journals': 'journalEntries',
      'receipt': 'receiptVouchers',
      'payment': 'paymentVouchers',
      'construction': 'construction',
      'bookings': 'construction.radar',
      'field-visits': 'construction.reports',
      'quotes': 'aiAnalysis',
      'orders': 'purchaseOrders',
      'suppliers': 'suppliers',
      'roles': 'rolesPermissions',
      'company': 'companyIdentity',
      'profile': 'userProfile',
      'checklists': 'checklists',
      'work-hours': 'workHours',
      'analytics': 'reports.analytics.title',
      'executive': 'reports.executive.title',
      'ai': 'ai.hub',
      'new': 'common.add',
      'edit': 'common.edit'
    };
    
    const key = segmentMap[sLower] || sLower;
    return t(key);
  };

  if (segments.length <= 1 && segments[0] === 'dashboard') return null;

  return (
    <nav className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-500" aria-label="Breadcrumb">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => router.back()}
        className="h-8 w-8 rounded-lg bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-primary transition-all shrink-0"
      >
        <ArrowRight className={cn("h-3.5 w-3.5", !isRtl && "rotate-180")} />
      </Button>

      <ol className="flex items-center whitespace-nowrap overflow-hidden">
        <li className="flex items-center">
          <Link 
            href="/dashboard" 
            className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Home className="h-3 w-3" />
          </Link>
        </li>

        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          const label = formatSegment(segment);

          if (segment === 'dashboard' && index === 0) return null;

          return (
            <li key={href} className="flex items-center">
              <div className="flex items-center">
                {isRtl ? (
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-300 mx-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 mx-0.5 shrink-0" />
                )}
                <Link
                  href={href}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest transition-all px-2 py-1 rounded-md",
                    isLast 
                      ? "text-slate-900 bg-slate-100/50 cursor-default pointer-events-none" 
                      : "text-slate-400 hover:text-primary hover:bg-primary/5"
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {label}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
