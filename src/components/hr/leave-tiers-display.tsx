
'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

interface Props {
  tiers: {
    fullPay: number;
    threeQuarterPay: number;
    halfPay: number;
    quarterPay: number;
    noPay: number;
  };
}

export function LeaveTiersDisplay({ tiers }: Props) {
  const { lang, isRtl } = useLanguage();

  const labels = [
    { key: 'fullPay', label: 'راتب كامل', labelEn: 'Full Pay', color: 'bg-emerald-500' },
    { key: 'threeQuarterPay', label: '75% راتب', labelEn: '75% Pay', color: 'bg-blue-500' },
    { key: 'halfPay', label: '50% راتب', labelEn: '50% Pay', color: 'bg-amber-500' },
    { key: 'quarterPay', label: '25% راتب', labelEn: '25% Pay', color: 'bg-orange-500' },
    { key: 'noPay', label: 'بدون راتب', labelEn: 'Unpaid', color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">
        {lang === 'ar' ? 'تحليل الاحتساب المالي (قانون العمل)' : 'Financial Breakdown (Labor Law)'}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {labels.map((tier) => {
          const value = tiers[tier.key as keyof typeof tiers];
          if (value === 0) return null;
          return (
            <div key={tier.key} className="p-4 rounded-2xl bg-white border-2 border-slate-50 shadow-sm flex flex-col items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", tier.color)} />
              <span className="text-[10px] font-black text-slate-500 uppercase">{lang === 'ar' ? tier.label : tier.labelEn}</span>
              <span className="text-lg font-black text-slate-900">{value}</span>
              <span className="text-[9px] font-bold text-slate-400">{lang === 'ar' ? 'يوم' : 'Days'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
