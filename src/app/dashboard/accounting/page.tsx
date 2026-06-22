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

  const handleSmartReconciliation = async () => {
    setReconciling(true);
    try {
      const response = await reconcileBankStatement({
        bankStatementEntries: initialBankEntries,
        ledgerEntries: initialLedgerEntries
      });
      setReconResult(response);
      toast({
        title: t('saved'),
        description: t('entryAdded'),
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('saveFailed'),
        variant: "destructive"
      });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Calculator className="h-10 w-10 text-primary" />
            {t('accounting')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">{t('smartReconciliation')}</p>
        </div>
        
        {/* زر الترحيل النهائي يظهر فقط إذا كان يملك صلاحية post بنطاق all */}
        {check('accounting', 'post').can && (
           <Button className="bg-emerald-600 text-white font-black rounded-xl h-12 px-6 gap-2 shadow-xl shadow-emerald-100">
              <Send className="h-4 w-4" /> {t('post') || 'Post All'}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-primary/5 border-b p-6 text-start">
            <CardTitle className="text-lg font-bold">{t('bankStatement')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('govs')}</TableHead>
                  <TableHead className="text-start">{t('summary')}</TableHead>
                  <TableHead className="text-end">{t('value')}</TableHead>
                  <TableHead className="text-center">{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialBankEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-start">{entry.date}</TableCell>
                    <TableCell className="font-medium text-xs text-start">{entry.description}</TableCell>
                    <TableCell className="font-mono text-end font-bold text-xs">{entry.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={entry.transactionType === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}>
                        {entry.transactionType === 'CREDIT' ? (dir === 'rtl' ? 'إيداع' : 'Deposit') : (dir === 'rtl' ? 'سحب' : 'Withdrawal')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-secondary/40 border-b p-6 text-start">
            <CardTitle className="text-lg font-bold">{t('ledger')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('govs')}</TableHead>
                  <TableHead className="text-start">{t('depts')}</TableHead>
                  <TableHead className="text-start">{t('summary')}</TableHead>
                  <TableHead className="text-end">{t('value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLedgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-start">{entry.date}</TableCell>
                    <TableCell className="font-bold text-xs text-primary text-start">{entry.accountName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs text-start">{entry.description}</TableCell>
                    <TableCell className="font-mono text-end font-bold text-xs">{entry.amount.toLocaleString()}</TableCell>
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
          className="bg-primary text-white font-black rounded-2xl px-12 py-8 text-xl shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-transform"
        >
          {reconciling ? (
            <><RefreshCw className="me-3 h-6 w-6 animate-spin" /> {t('search')}</>
          ) : (
            <><Sparkles className="me-3 h-6 w-6" /> {t('smartReconciliation')}</>
          )}
        </Button>
      </div>

      {reconResult && (
        <Card className="border-2 border-primary/20 shadow-2xl rounded-[3rem] bg-white overflow-hidden animate-in slide-in-from-bottom-6 duration-500" dir={dir}>
          <CardHeader className="bg-primary/5 p-10 border-b text-start">
            <CardTitle className="font-headline font-black text-2xl flex items-center gap-3">
              <Calculator className="h-8 w-8 text-primary" />
              {t('reconReport')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-8 text-start">
            <div className="p-8 bg-muted/30 rounded-3xl border-2">
              <h4 className="font-black text-xl mb-4">{t('summary')}</h4>
              <p className="text-muted-foreground leading-relaxed text-lg">{reconResult.summary}</p>
            </div>

            <div className="space-y-6">
              <h4 className="font-black text-xl">{t('suggestedMatches')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reconResult.suggestedMatches?.map((match: any, idx: number) => (
                  <div key={idx} className="p-6 rounded-[2rem] border-2 bg-white flex flex-col justify-between space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-500 text-white font-black px-4 py-1">
                        {(match.matchConfidence * 100).toFixed(0)}%
                      </Badge>
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">MATCH #{idx + 1}</span>
                    </div>
                    <p className="text-base font-bold text-secondary-foreground leading-relaxed">{match.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
