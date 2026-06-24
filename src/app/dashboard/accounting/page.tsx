'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, Send } from "lucide-react";
import { reconcileBankStatement } from "@/ai/flows/reconcile-bank-statement-flow";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

const initialBankEntries = [
  { id: "b1", date: "2024-07-15", description: "Payment from Client - Al-Abraq Construction", amount: 15000, transactionType: "CREDIT" as const },
  { id: "b2", date: "2024-07-16", description: "Metro fees for Al-Zour refinery site tools", amount: 450, transactionType: "DEBIT" as const },
  { id: "b3", date: "2024-07-18", description: "Steel Rebar Purchase - Gulf Factory", amount: 8200, transactionType: "DEBIT" as const }
];

const initialLedgerEntries = [
  { id: "l1", date: "2024-07-15", description: "Revenue Collected - Al-Abraq Contract", amount: 15000, transactionType: "CREDIT" as const, accountName: "Bank - Main Account" },
  { id: "l2", date: "2024-07-16", description: "Petty cash Al-Zour refinery site", amount: 450, transactionType: "DEBIT" as const, accountName: "Field Operations Expense" },
  { id: "l3", date: "2024-07-19", description: "Raw material supply - Steel", amount: 8200, transactionType: "DEBIT" as const, accountName: "Raw Materials Inventory" }
];

export default function AccountingPage() {
  const { t, dir } = useLanguage();
  const { check } = usePermissions();
  const [reconciling, setReconciling] = useState(false);
  const [reconResult, setReconResult] = useState<any>(null);

  const canPost = check('accounting', 'post').can;
  const canReconcile = check('accounting', 'create').can;

  const handleSmartReconciliation = async () => {
    if (!canReconcile) return;
    setReconciling(true);
    try {
      const response = await reconcileBankStatement({
        bankStatementEntries: initialBankEntries,
        ledgerEntries: initialLedgerEntries
      });
      setReconResult(response);
      toast({ title: t('saved') });
    } catch (error) {
      toast({ title: t('error'), variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <header className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Calculator className="h-8 w-8 text-[#FFA000]" />
            {t('accounting')}
          </h1>
          <p className="text-slate-600 text-sm font-bold opacity-80 italic">{t('smartReconciliation')}</p>
        </div>
        
        {canPost && (
           <Button className="bg-emerald-600 text-white font-bold h-11 px-6 shadow-sm">
              <Send className="h-4 w-4 me-2" /> {t('post') || 'Post All Records'}
           </Button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm card-shadow bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b p-5 text-start">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">{t('bankStatement')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/5">
                <TableRow>
                  <TableHead className="text-start py-4 ps-6">{t('govs')}</TableHead>
                  <TableHead className="text-start">{t('summary')}</TableHead>
                  <TableHead className="text-end pe-6">{t('value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialBankEntries.map((entry) => (
                  <TableRow key={entry.id} className="border-b-slate-50 hover:bg-slate-50/50">
                    <TableCell className="font-mono text-[10px] text-slate-400 ps-6">{entry.date}</TableCell>
                    <TableCell className="font-bold text-xs text-slate-700">{entry.description}</TableCell>
                    <TableCell className="font-mono text-end font-black text-xs pe-6">{entry.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm card-shadow bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b p-5 text-start">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">{t('ledger')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/5">
                <TableRow>
                  <TableHead className="text-start py-4 ps-6">{t('govs')}</TableHead>
                  <TableHead className="text-start">{t('depts')}</TableHead>
                  <TableHead className="text-end pe-6">{t('value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLedgerEntries.map((entry) => (
                  <TableRow key={entry.id} className="border-b-slate-50 hover:bg-slate-50/50">
                    <TableCell className="font-mono text-[10px] text-slate-400 ps-6">{entry.date}</TableCell>
                    <TableCell className="font-black text-[10px] text-[#039BE5] uppercase">{entry.accountName}</TableCell>
                    <TableCell className="font-mono text-end font-black text-xs pe-6">{entry.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {canReconcile && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleSmartReconciliation}
            disabled={reconciling}
            className="bg-[#FFA000] text-white font-black rounded-xl h-16 px-12 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all"
          >
            {reconciling ? (
              <><RefreshCw className="me-3 h-6 w-6 animate-spin" /> {t('search')}</>
            ) : (
              <><Sparkles className="me-3 h-6 w-6" /> {t('smartReconciliation')}</>
            )}
          </Button>
        </div>
      )}

      {reconResult && (
        <Card className="border-2 border-primary/10 shadow-xl rounded-xl bg-white overflow-hidden animate-in slide-in-from-bottom-6">
          <CardHeader className="bg-primary/5 p-8 border-b text-start">
            <CardTitle className="font-black text-xl flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              {t('reconReport')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-start">
            <div className="p-6 bg-slate-50 rounded-lg border-2 border-white shadow-inner">
              <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-3">{t('summary')}</h4>
              <p className="text-slate-700 font-bold leading-relaxed">{reconResult.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}