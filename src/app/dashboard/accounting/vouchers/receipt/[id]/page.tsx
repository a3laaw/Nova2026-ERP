'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  ArrowRight, 
  Loader2, 
  Receipt,
  Landmark,
  User,
  Calendar,
  Wallet,
  CheckCircle2,
  History
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Voucher } from '@/types/accounting';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { cn } from '@/lib/utils';

export default function ReceiptVoucherDetailPage() {
  const params = useParams();
  const voucherId = params.id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const voucherRef = useMemo(() => 
    companyId && db ? doc(db, paths.vouchers(companyId), voucherId) : null, 
  [db, companyId, voucherId]);

  const { data: voucher, loading } = useDoc<Voucher>(voucherRef);

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!voucher) return <div className="p-20 text-center font-black">404 - Document Not Found</div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
           <Button 
             variant="ghost" 
             onClick={() => router.push('/dashboard/accounting/vouchers/receipt')} 
             className="h-10 w-10 p-0 rounded-xl border-2 bg-white text-slate-400"
           >
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-xl font-black text-slate-900">{tSafe('inline.review.receipt', 'مراجعة وطباعة السند', 'Review & Print')}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{voucher.voucherNumber}</p>
           </div>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => window.print()} className="rounded-xl h-10 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl">
              <Printer className="h-4 w-4" /> {t('common.print')}
           </Button>
        </div>
      </div>

      <PrintWrapper title={tSafe('inline.receipt.voucher', 'سند قبض نقدية', 'Receipt Voucher')}>
         <div className="space-y-10 text-start">
            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8">
               <div className="space-y-4">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.received.from', 'استلمنا من السيد / السادة', 'Received From')}</span>
                     <span className="text-xl font-black text-slate-900">{voucher.personName}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.payment.method', 'طريقة الدفع', 'Payment Method')}</span>
                     <span className="text-sm font-bold text-slate-700 uppercase">{voucher.paymentMethod}</span>
                  </div>
               </div>
               <div className="text-end space-y-4">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.date')}</span>
                     <span className="text-sm font-bold text-slate-700 font-mono">{voucher.date}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.ref.no', 'رقم المرجع', 'Ref No.')}</span>
                     <span className="text-sm font-bold text-slate-700 font-mono">{voucher.voucherNumber}</span>
                  </div>
               </div>
            </div>

            <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-white shadow-inner flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Wallet className="h-24 w-24" />
               </div>
               <div className="text-start relative z-10">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{tSafe('inline.total.amount', 'إجمالي المبلغ المقبوض', 'Total Amount Received')}</p>
                  <h3 className="text-5xl font-black font-headline text-slate-900">
                     {voucher.amount.toLocaleString()} <span className="text-sm font-bold text-slate-400">KWD</span>
                  </h3>
               </div>
               <div className="relative z-10">
                  <div className="bg-emerald-600 text-white px-8 py-3 rounded-2xl shadow-xl flex items-center gap-3">
                     <CheckCircle2 className="h-5 w-5" />
                     <span className="font-black text-sm uppercase">{tSafe('inline.fully.paid', 'تم التحصيل', 'Fully Paid')}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-4 text-start">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                  <History className="h-4 w-4 text-primary" /> {tSafe('inline.transaction.details', 'تفاصيل الدفعات والبيان', 'Transaction Details')}
               </h4>
               <p className="p-8 bg-white rounded-2xl border-2 border-slate-50 text-base font-bold text-slate-700 leading-relaxed italic">
                  {voucher.notes}
               </p>
            </div>

            <div className="pt-10 grid grid-cols-2 gap-20">
               <div className="text-center space-y-4">
                  <div className="h-24 border-b-2 border-slate-100" />
                  <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('inline.signature.receiver', 'توقيع المستلم', 'Receiver Signature')}</p>
               </div>
               <div className="text-center space-y-4">
                  <div className="h-24 border-b-2 border-slate-100" />
                  <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('inline.seal', 'ختم الشركة المعتمد', 'Official Seal')}</p>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
