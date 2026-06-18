'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HardHat, Sparkles, TrendingUp, DollarSign, Calendar, RefreshCw } from "lucide-react";
import { generateCashFlowProjection } from "@/ai/flows/cash-flow-projection-flow";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from '@/context/language-context';

const initialMilestones = [
  { id: "m1", description: "إتمام حفر وتجهيز الأساسات الهيكلية", dueDate: "2024-08-15", expectedRevenue: 45000 },
  { id: "m2", description: "صب الخرسانة المسلحة للمرحلة الأولى", dueDate: "2024-09-20", expectedRevenue: 60000 },
  { id: "m3", description: "التشطيبات والوجهات الهندسية الخارجية", dueDate: "2024-11-05", expectedRevenue: 85000 }
];

const initialSchedules = [
  { contractId: "c_zor_01", paymentDate: "2024-08-20", amount: 30000 },
  { contractId: "c_zor_02", paymentDate: "2024-10-10", amount: 50000 }
];

const historicalData = [
  { period: "2024-04", inflows: 40000, outflows: 25000 },
  { period: "2024-05", inflows: 55000, outflows: 30000 },
  { period: "2024-06", inflows: 62000, outflows: 41000 }
];

export default function ProjectsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [projectionResult, setProjectionResult] = useState<any>(null);

  const handleGenerateForecast = async () => {
    setLoading(true);
    try {
      const response = await generateCashFlowProjection({
        projectMilestones: initialMilestones,
        contractPaymentSchedules: initialSchedules,
        historicalFinancialData: historicalData,
        projectionHorizonMonths: 4,
        currentCashBalance: 120000
      });
      setProjectionResult(response);
      toast({
        title: "اكتمل التنبؤ بالتدفق النقدي",
        description: "تم تحليل جداول العقود وجداول WBS بنجاح بالذكاء الاصطناعي.",
      });
    } catch (error) {
      toast({
        title: "فشل التوقع المالي",
        description: "عذراً، لم نتمكن من حساب التوقعات الهندسية حالياً.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline">{t('projects')}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80">ربط معالم WBS ومخططات جدول الكميات (BOQ) بالسيولة المتاحة</p>
        </div>
        <Button onClick={handleGenerateForecast} disabled={loading} className="bg-primary text-white font-bold rounded-xl px-6 py-5 shadow-lg shadow-primary/20">
          {loading ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
          توليد التوقعات المالية (AI)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md rounded-[2rem] bg-white lg:col-span-2 overflow-hidden ring-1 ring-black/5">
          <CardHeader className="p-6 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><HardHat className="text-primary h-5 w-5" /> المعالم الهندسية القادمة (WBS)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">المعرف</TableHead>
                  <TableHead className="text-start">الوصف الهندسي</TableHead>
                  <TableHead className="text-start">الاستحقاق</TableHead>
                  <TableHead className="text-end">العائد المتوقع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialMilestones.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs text-start">{m.id}</TableCell>
                    <TableCell className="font-bold text-xs text-start">{m.description}</TableCell>
                    <TableCell className="text-muted-foreground text-xs text-start"><Calendar className="inline me-1 h-3 w-3" />{m.dueDate}</TableCell>
                    <TableCell className="font-mono text-end text-emerald-600 font-bold text-xs">{m.expectedRevenue.toLocaleString()} د.ك</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="p-6 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><DollarSign className="text-blue-500 h-5 w-5" /> دفعات العقود</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {initialSchedules.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-muted/40 border">
                  <div className="text-start">
                    <p className="text-xs font-bold text-secondary-foreground">{s.contractId}</p>
                    <p className="text-[10px] text-muted-foreground">{s.paymentDate}</p>
                  </div>
                  <span className="font-mono font-bold text-sm text-primary">{s.amount.toLocaleString()} د.ك</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {projectionResult && (
        <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in duration-500">
          <CardHeader className="bg-primary/5 p-8 border-b text-start">
            <CardTitle className="font-headline font-bold text-xl flex items-center gap-2">
              <TrendingUp className="text-primary h-6 w-6" />
              التحليل التنبئي للسيولة النقدية
            </CardTitle>
            <CardDescription>محاكاة حركة المال والتدفقات النقدية المتوقعة للأشهر القادمة</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6 text-start">
            {projectionResult.summary && (
              <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 text-sm leading-relaxed font-bold">
                <strong>التوجيه الاستراتيجي (AI):</strong> {projectionResult.summary}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-start">الفترة</TableHead>
                    <TableHead className="text-end">التدفق الداخل</TableHead>
                    <TableHead className="text-end">التدفق الخارج</TableHead>
                    <TableHead className="text-end">صافي التدفق</TableHead>
                    <TableHead className="text-end">الرصيد التراكمي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectionResult.projectionPeriods?.map((p: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-bold text-xs text-start">{p.periodName}</TableCell>
                      <TableCell className="font-mono text-end text-emerald-600 font-bold text-xs">+{p.projectedInflows?.toLocaleString()} د.ك</TableCell>
                      <TableCell className="font-mono text-end text-destructive font-medium text-xs">-{p.projectedOutflows?.toLocaleString()} د.ك</TableCell>
                      <TableCell className={`font-mono text-end font-bold text-xs ${p.netCashFlow >= 0 ? 'text-emerald-700' : 'text-destructive'}`}>
                        {p.netCashFlow?.toLocaleString()} د.ك
                      </TableCell>
                      <TableCell className="font-mono text-end bg-muted/20 font-bold text-xs text-primary">{p.cumulativeCashFlow?.toLocaleString()} د.ك</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
