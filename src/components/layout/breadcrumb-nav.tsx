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
  const { t, lang, dir } = useLanguage();
  const isRtl = lang === 'ar';

  const segments = pathname.split('/').filter(Boolean);

  // خريطة ترجمة المسارات لضمان ظهورها بشكل احترافي
  const routeMap: Record<string, string> = {
    dashboard: t('common.dashboard'),
    crm: t('common.crm'),
    clients: t('common.clients'),
    projects: t('common.projects'),
    hr: t('common.hr'),
    employees: t('hr.staff'),
    leaves: t('hr.leaves'),
    permissions: t('hr.permissions'),
    attendance: t('hr.attendance'),
    payroll: t('hr.payroll'),
    gratuity: t('hr.gratuity'),
    accounting: t('common.accounting'),
    inventory: t('common.inventory'),
    procurement: t('common.procurement'),
    suppliers: t('common.suppliers'),
    settings: t('common.settings'),
    profile: t('common.profile'),
    company: t('common.companyIdentity'),
    checklists: t('common.checklists'),
    roles: t('common.rolesRef'),
    'work-hours': t('common.workHours'),
    templates: t('common.templates'),
    quotes: t('common.quoteAnalysis'),
    'field-visits': t('construction.reports'),
    construction: t('common.construction'),
    bookings: t('construction.radar'),
    new: t('common.new'),
    edit: t('common.edit'),
  };

  const formatSegment = (segment: string) => {
    // إذا كان المقطع عبارة عن معرف (ID) طويل
    if (segment.length > 15 || /\d/.test(segment)) {
      return isRtl ? 'تفاصيل' : 'Details';
    }
    return routeMap[segment] || segment;
  };

  if (segments.length <= 1 && segments[0] === 'dashboard') return null;

  return (
    <nav className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1 duration-500" aria-label="Breadcrumb">
      {/* زر الرجوع الهندسي */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => router.back()}
        className="h-9 w-9 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-primary transition-all shrink-0"
      >
        <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
      </Button>

      <ol className="flex items-center whitespace-nowrap overflow-hidden">
        <li className="flex items-center">
          <Link 
            href="/dashboard" 
            className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Home className="h-3.5 w-3.5" />
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
                  <ChevronLeft className="h-4 w-4 text-slate-300 mx-1 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-300 mx-1 shrink-0" />
                )}
                <Link
                  href={href}
                  className={cn(
                    "text-[11px] font-black uppercase tracking-wider transition-all px-2 py-1 rounded-lg",
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
