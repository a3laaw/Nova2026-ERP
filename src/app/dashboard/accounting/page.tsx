'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, ArrowDownLeft } from "lucide-react";
import { reconcileBankStatement } from "@/ai/flows/reconcile-bank-statement-flow";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from '@/context/language-context';

const initialBankEntries = [
  { id: "b1", date: "2024-07-15", description: "دفعة من العميل - شركة الأبرق للإنشاءات", amount: 15000, transactionType: "CREDIT" as const },
  { id: "b2", date: "2024-07-16", description: "رسوم المترو لشراء أدوات موقع مصفاة الزور", amount: 450, transactionType: "DEBIT" as const },
  { id: "b3", date: "2024-07-18", description: "شراء حديد تسليح - مصنع الخليج", amount: 8200, transactionType: "DEBIT" as const }
];

const initialLedgerEntries = [
  { id: "l1", date: "2024-07-15", description: "إيرادات محصلة - عقد الأبرق", amount: 15000, transactionType: "CREDIT" as const, accountName: "البنك - الحساب الرئيسي" },
  { id: "l2", date: "2024-07-16", description: "مصاريف نثرية موقع مصفاة الزور", amount: 450, transactionType: "DEBIT" as const, accountName: "مصاريف عمليات ميدانية" },
  { id: "l3", date: "2024-07-19", description: "توريد مواد خام - حديد", amount: 8200, transactionType: "DEBIT" as const, accountName: "مخزون المواد الأولية" }
];

export default function AccountingPage() {
  const { t } = useLanguage();
  const [reconciling, setReconciling] = useState(false);
  const [reconResult, setReconResult] = useState<any>(null);

  const handleSmartReconciliation = async () => {
    setReconciling(true);
    try {
      const response = await reconcileBankStatement({
        bankStatementEntries: initialBankEntries,
        ledgerEntries: initialLedgerEntries
      });
      setReconResult(response);
      toast({
        title: "اكتملت التسوية الذكية",
        description: "تمت مطابقة القيود وتحليل الفروقات بنجاح.",
      });
    } catch (error) {
      toast({
        title: "فشلت التسوية الذكية",
        description: "حدث خطأ أثناء معالجة البيانات ماليًا.",
        variant: "destructive"
      });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-start">
        <h1 className="text-3xl font-black font-headline">{t('accounting')}</h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">المطابقة الذكية للأرصدة وكشوف الحسابات بالذكاء الاصطناعي</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-primary/5 border-b p-6">
            <div className="flex items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-lg font-bold">كشف الحساب البنكي</CardTitle>
                <CardDescription>العمليات المستوردة من بنك الكويت الوطني</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white border-primary/20 text-primary font-bold">نشط</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">التاريخ</TableHead>
                  <TableHead className="text-start">البيان</TableHead>
                  <TableHead className="text-end">المبلغ</TableHead>
                  <TableHead className="text-center">النوع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialBankEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-start">{entry.date}</TableCell>
                    <TableCell className="font-medium text-xs text-start">{entry.description}</TableCell>
                    <TableCell className="font-mono text-end font-bold text-xs">{entry.amount.toLocaleString()} د.ك</TableCell>
                    <TableCell className="text-center">
                      <Badge className={entry.transactionType === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}>
                        {entry.transactionType === 'CREDIT' ? 'إيداع' : 'سحب'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-secondary/40 border-b p-6">
            <div className="flex items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-lg font-bold">دفتر الأستاذ العام</CardTitle>
                <CardDescription>القيود المرحلة في نظام نوفا المالي</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white font-bold opacity-70">ERP</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">التاريخ</TableHead>
                  <TableHead className="text-start">الحساب</TableHead>
                  <TableHead className="text-start">البيان</TableHead>
                  <TableHead className="text-end">القيمة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLedgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-start">{entry.date}</TableCell>
                    <TableCell className="font-bold text-xs text-primary text-start">{entry.accountName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs text-start">{entry.description}</TableCell>
                    <TableCell className="font-mono text-end font-bold text-xs">{entry.amount.toLocaleString()} د.ك</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSmartReconciliation}
          disabled={reconciling}
          className="bg-primary text-white font-bold rounded-2xl px-10 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
        >
          {reconciling ? (
            <>
              <RefreshCw className="me-2 h-5 w-5 animate-spin" />
              جاري مطابقة القيود وتحليل الفروقات...
            </>
          ) : (
            <>
              <Sparkles className="me-2 h-5 w-5" />
              تشغيل نظام المطابقة الذكي (AI)
            </>
          )}
        </Button>
      </div>

      {reconResult && (
        <Card className="border-2 border-primary/20 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="bg-primary/5 p-8 border-b text-start">
            <CardTitle className="font-headline font-bold text-xl flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              تقرير التسوية والمطابقة الذكي
            </CardTitle>
            <CardDescription>تقرير فوري صادر عن وكيل الذكاء الاصطناعي المالي لنوفا</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6 text-start">
            <div className="p-6 bg-muted/30 rounded-2xl border">
              <h4 className="font-bold text-lg mb-2">الملخص التنفيذي</h4>
              <p className="text-muted-foreground leading-relaxed text-sm">{reconResult.summary}</p>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-lg">المطابقات المقترحة</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reconResult.suggestedMatches?.map((match: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border-2 bg-white flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-500 text-white font-bold">
                        ثقة {(match.matchConfidence * 100).toFixed(0)}%
                      </Badge>
                      <span className="text-xs font-bold text-muted-foreground">تطابق مالي #{idx + 1}</span>
                    </div>
                    <p className="text-sm font-medium text-secondary-foreground">{match.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertTriangle className="h-5 w-5" />
                  <h5>حركات بنكية معلقة</h5>
                </div>
                <p className="text-xs text-amber-700">عدد العمليات غير المطابقة: {reconResult.unmatchedBankEntries?.length || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                <div className="flex items-center gap-2 text-blue-800 font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                  <h5>قيود دفتر الأستاذ المعلقة</h5>
                </div>
                <p className="text-xs text-blue-700">عدد الحسابات غير المطابقة: {reconResult.unmatchedLedgerEntries?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
