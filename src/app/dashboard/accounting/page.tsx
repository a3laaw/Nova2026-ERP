'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, RefreshCw, CheckCircle2, Sparkles, Send } from "lucide-react";
import { reconcileBankStatement } from "@/ai/flows/reconcile-bank-statement-flow";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';

const initialBankEntries = [
  { id: "b1", date: "2024-07-15", description: "Payment from Client - Al-Abraq Construction", amount: 15000, transactionType: "CREDIT" as const },
  { id: "b2", date: "2024-07-16", description: "Metro fees for site tools", amount: 450, transactionType: "DEBIT" as const }
];

const initialLedgerEntries = [
  { id: "l1", date: "2024-07-15", description: "Revenue Collected", amount: 15000, transactionType: "CREDIT" as const, accountName: "Bank - Main" },
  { id: "l2", date: "2024-07-16", description: "Petty cash Site A", amount: 450, transactionType: "DEBIT" as const, accountName: "Field Ops Expense" }
];

export default function AccountingPage() {
  const { t, dir, isRtl } = useLanguage();
  const { check } = usePermissions();
  const [reconciling, setReconciling] = useState(false);
  const [reconResult, setReconResult] = useState<any>(null);

  const handleSmartReconciliation = async () => {
    setReconciling(true);
    try {
      const response = await reconcileBankStatement({ bankStatementEntries: initialBankEntries, ledgerEntries: initialLedgerEntries });
      setReconResult(response);
      toast({ title: t('common.saved') });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-4 w-full animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> {t('accounting')}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">{t('accounting.smartRecon')}</p>
        </div>
        <Button onClick={handleSmartReconciliation} disabled={reconciling} size="sm" className="h-9 px-6 font-bold gap-2">
           {reconciling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
           {t('accounting.smartRecon')}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-lg shadow-sm border bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 p-4 border-b">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-500">{t('accounting.bankStatement')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50"><TableRow><TableHead className="ps-4">{t('common.date')}</TableHead><TableHead>{t('common.notes')}</TableHead><TableHead className="text-end pe-4">{t('common.amount')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {initialBankEntries.map(e => (
                  <TableRow key={e.id} className="border-b-slate-50"><TableCell className="ps-4 py-2 text-xs font-mono">{e.date}</TableCell><TableCell className="text-xs font-medium">{e.description}</TableCell><TableCell className="pe-4 text-end font-mono font-bold text-xs">{e.amount.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm border bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 p-4 border-b">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-500">{t('accounting.generalLedger')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50"><TableRow><TableHead className="ps-4">{t('common.date')}</TableHead><TableHead>{t('common.name')}</TableHead><TableHead className="text-end pe-4">{t('common.amount')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {initialLedgerEntries.map(e => (
                  <TableRow key={e.id} className="border-b-slate-50"><TableCell className="ps-4 py-2 text-xs font-mono">{e.date}</TableCell><TableCell className="text-xs font-black text-blue-600 uppercase">{e.accountName}</TableCell><TableCell className="pe-4 text-end font-mono font-bold text-xs">{e.amount.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {reconResult && (
        <Card className="rounded-lg border-2 border-emerald-100 bg-emerald-50/30 p-6 animate-in slide-in-from-bottom-4">
           <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <h4 className="font-bold text-sm">{t('accounting.aiReconSummary')}</h4>
           </div>
           <p className="text-xs font-medium leading-relaxed text-slate-700">{reconResult.summary}</p>
        </Card>
      )}
    </div>
  );
}
