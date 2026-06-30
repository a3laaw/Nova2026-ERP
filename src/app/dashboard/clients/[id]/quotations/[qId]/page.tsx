
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, FileText, 
  CalendarDays, ShieldCheck, Clock,
  DollarSign, Landmark, Gavel, Loader2
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Quotation } from '@/types/documents';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { format, addDays } from 'date-fns';

export default function QuotationViewPage() {
  const params = useParams();
  const clientId = params.id as string;
  const quotationId = params.qId as string;
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const quoteRef = useMemo(() => 
    companyId && db ? doc(db, paths.quotations(companyId), quotationId) : null, 
  [db, companyId, quotationId]);

  const { data: quote, loading } = useDoc<Quotation>(quoteRef);

  const expiryDate = useMemo(() => {
    if (!quote?.createdAt || !quote.validDays) return null;
    const createdDate = quote.createdAt.toDate();
    return format(addDays(createdDate, quote.validDays), 'yyyy-MM-dd');
  }, [quote]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!quote) return <div className="p-20 text-center font-black">{isRtl ? 'المستند غير موجود' : 'Quotation not found'}</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline">{isRtl ? 'معاينة عرض السعر' : 'Quotation Preview'}</h1>
          <p className="text-xs font-bold text-muted-foreground">{quote.name}</p>
        </div>
        <div className="flex gap-4">
           <Button onClick={() => window.print()} className="rounded-2xl h-14 px-10 font-black gap-2 bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 transition-all">
              <Printer className="h-6 w-6" /> {isRtl ? 'طباعة العرض الرسمي' : 'Print Official Quote'}
           </Button>
        </div>
      </div>

      <PrintWrapper title={isRtl ? "عرض سعر رسمي" : "Official Quotation"}>
         <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-8 border-slate-100">
               <div className="text-start space-y-3">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'موجه إلى السيد/السادة' : 'Quotation For'}</p>
                     <p className="text-xl font-black text-slate-800">{quote.clientName}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'بخصوص' : 'Subject'}</p>
                     <p className="text-sm font-bold text-slate-600 italic">{quote.name}</p>
                  </div>
               </div>
               <div className="text-start md:text-end space-y-3">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</p>
                     <p className="text-sm font-black text-slate-800 font-mono">{quote.createdAt?.toDate().toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">{isRtl ? 'صلاحية العرض لغاية' : 'Valid Until'}</p>
                     <p className="text-sm font-black text-primary font-mono">{expiryDate || '---'}</p>
                     <p className="text-[8px] font-bold text-slate-400 italic">({quote.validDays} {isRtl ? 'يوم من تاريخه' : 'Days from issue'})</p>
                  </div>
               </div>
            </div>

            {quote.introText && (
              <div className="text-start animate-in fade-in slide-in-from-top-2">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText className="h-3 w-3 text-primary" /> {isRtl ? 'تحلية طيبة وبعد،،' : 'Introduction'}
                 </h4>
                 <div className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-50 leading-relaxed text-slate-700 font-bold whitespace-pre-wrap">
                    {quote.introText}
                 </div>
              </div>
            )}

            <div className="space-y-6 text-start">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <DollarSign className="h-3 w-3 text-emerald-500" /> {isRtl ? 'توصيف البنود المالية للدفعات' : 'Financial Milestones Breakdown'}
               </h4>
               <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-900 text-white">
                        <tr className="font-black uppercase text-[10px] tracking-widest">
                           <th className="p-6 text-start w-16">#</th>
                           <th className="p-6 text-start">{isRtl ? 'الدفعة / المرحلة' : 'Milestone'}</th>
                           <th className="p-6 text-start">{isRtl ? 'شرط الاستحقاق الفني' : 'Contractual Condition'}</th>
                           <th className="p-6 text-center w-32">{isRtl ? 'النسبة' : 'Share'}</th>
                           <th className="p-6 text-end pe-10 w-48">{isRtl ? 'المبلغ التقديري' : 'Amount'}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {quote.items?.map((item, idx) => {
                           const amount = quote.totalAmount > 0 
                             ? (quote.totalAmount * (item.percentage || 0)) / 100 
                             : ((quote as any).baseAmount * (item.percentage || 0)) / 100;
                           
                           return (
                             <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                                <td className="p-6 text-start">
                                   <p className="font-black text-slate-800 text-base">{item.label}</p>
                                   <Badge variant="secondary" className="bg-primary/5 text-primary border-0 text-[8px] uppercase font-black px-2 mt-1">
                                      {item.timing} {item.contractualEvent || 'STAGE'}
                                   </Badge>
                                </td>
                                <td className="p-6 text-start text-xs font-bold text-slate-500 leading-relaxed max-w-xs">
                                   {item.description}
                                </td>
                                <td className="p-6 text-center font-black text-slate-900 bg-slate-50/30">
                                   {item.percentage}%
                                </td>
                                <td className="p-6 text-end pe-10 font-mono font-black text-emerald-600 text-lg">
                                   {amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">KWD</span>
                                </td>
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-50 font-black border-t-4 border-slate-900">
                        <tr>
                           <td colSpan={3} className="p-8 text-start text-xl uppercase tracking-tighter">{isRtl ? 'إجمالي قيمة العرض المقدرة' : 'Total Estimated Quote Value'}</td>
                           <td colSpan={2} className="p-8 text-end pe-10 text-4xl text-slate-900 font-headline">
                              {(quote.totalAmount || (quote as any).baseAmount || 0).toLocaleString()} <span className="text-sm font-bold opacity-30">KWD</span>
                           </td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            {quote.defaultTerms && (
              <div className="text-start space-y-6 pt-10 border-t-2 border-dashed border-slate-100">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Gavel className="h-3 w-3 text-primary" /> {isRtl ? 'الشروط والأحكام والالتزامات' : 'Terms, Conditions & Clauses'}
                 </h4>
                 <div className="p-10 bg-slate-50 rounded-[3rem] border-2 border-white shadow-inner">
                    <div className="text-xs font-bold text-slate-600 leading-loose whitespace-pre-wrap columns-1 md:columns-2 gap-12 text-start">
                       {quote.defaultTerms}
                    </div>
                 </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-20 pt-20">
               <div className="text-start space-y-12">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'توقيع واعتماد العميل' : 'Client Approval & Signature'}</p>
                     <div className="h-20 w-full border-b-2 border-slate-200" />
                  </div>
               </div>
               <div className="text-end space-y-12 flex flex-col items-end">
                  <div className="space-y-1 w-full max-w-[240px]">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'ختم الشركة الرسمي' : 'Official Company Stamp'}</p>
                     <div className="h-24 w-24 rounded-full border-4 border-slate-100 flex items-center justify-center ms-auto">
                        <ShieldCheck className="h-10 w-10 text-slate-100" />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
