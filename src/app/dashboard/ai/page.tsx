'use client';

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, FileSearch, TrendingUp, Calculator, Wand2, Loader2, Send } from "lucide-react"
import { useAccountingAssistant } from "@/ai/flows/accounting-assistant-flow"
import { toast } from "@/hooks/use-toast"
import { useLanguage } from "@/context/language-context"
import { usePermissions } from "@/hooks/use-permissions"

export default function AIPage() {
  const { t, dir, isRtl } = useLanguage();
  const { check } = usePermissions();
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleAccountingAssistant = async () => {
    if (!query) return
    setLoading(true)
    try {
      const response = await useAccountingAssistant({ description: query })
      setResult(response)
    } catch (error) {
      toast({
        title: "AI Analysis Failed",
        description: "We couldn't process your accounting query right now.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto" dir={dir}>
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-4xl font-black font-headline tracking-tight">{t('ai.hub')}</h1>
        <p className="text-muted-foreground font-bold">{t('ai.desc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md bg-white rounded-3xl cursor-pointer group">
          <CardHeader className="pb-2 text-start">
            <Calculator className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle className="text-lg font-bold font-headline">{isRtl ? 'مساعد محاسبي' : 'Accounting Assistant'}</CardTitle>
            <CardDescription className="font-bold">{isRtl ? 'صياغة قيود اليومية أو الحصول على استشارات محاسبية ذكية.' : 'Draft journal entries or get expert advice.'}</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md bg-white rounded-3xl cursor-pointer group opacity-60">
          <CardHeader className="pb-2 text-start">
            <FileSearch className="h-8 w-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle className="text-lg font-bold font-headline">{isRtl ? 'محلل العروض' : 'Quote Analyzer'}</CardTitle>
            <CardDescription className="font-bold">{isRtl ? 'رفع عروض الموردين وتحليلها والمقارنة الفنية والمالية.' : 'Upload quotes and compare technically/financially.'}</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md bg-white rounded-3xl cursor-pointer group opacity-60">
          <CardHeader className="pb-2 text-start">
            <TrendingUp className="h-8 w-8 text-green-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle className="text-lg font-bold font-headline">{isRtl ? 'توقع السيولة' : 'Cash Flow Forecast'}</CardTitle>
            <CardDescription className="font-bold">{isRtl ? 'تحليل التدفقات النقدية بناءً على إنجاز المقايسات.' : 'Project liquidity based on BOQ progress.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl bg-white overflow-hidden text-start">
        <CardHeader className="bg-slate-50 p-8">
          <CardTitle className="font-headline font-bold text-2xl flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            {isRtl ? 'محطة الذكاء المحاسبي' : 'Accounting Intelligence Terminal'}
          </CardTitle>
          <CardDescription className="font-bold">{isRtl ? 'صف العملية المالية بلغة طبيعية (مثلاً: استلمنا دفعة 5,000 من العميل أ كدفعة مقدمة).' : 'Describe a transaction in natural language to generate entries.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <Textarea 
              placeholder={isRtl ? "اكتب هنا تفاصيل العملية..." : "Enter transaction description..."}
              className="min-h-[150px] text-lg p-6 rounded-2xl border-2 border-muted focus:border-primary/50 transition-all font-bold"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex justify-end">
              <Button 
                onClick={handleAccountingAssistant} 
                disabled={loading || !query}
                className="bg-primary text-white px-8 py-6 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Send className="h-6 w-6" />
                )}
                {isRtl ? 'تحليل وتوليد القيد' : 'Analyze & Draft Entry'}
              </Button>
            </div>
          </div>

          {result && (
            <div className="animate-in slide-in-from-bottom-4 duration-500 text-start">
              <div className="bg-primary/5 rounded-3xl p-8 border border-primary/20 space-y-6">
                <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                  <h3 className="font-headline font-bold text-xl">{isRtl ? 'القيد المحاسبي المقترح' : 'Proposed Journal Entry'}</h3>
                  <Button variant="outline" size="sm" className="bg-white rounded-xl">Refine with AI</Button>
                </div>
                
                {result.advice && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Advisory Note</p>
                    <p className="text-lg font-bold leading-relaxed">{result.advice}</p>
                  </div>
                )}

                {result.journalEntry && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-2xl shadow-sm space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Narration:</p>
                      <p className="font-bold text-lg">{result.journalEntry.narration}</p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 border-b">
                          <tr>
                            <th className="px-6 py-4 text-start font-black">{isRtl ? 'الحساب' : 'Account Name'}</th>
                            <th className="px-6 py-4 text-end font-black">{isRtl ? 'مدين ($)' : 'Debit ($)'}</th>
                            <th className="px-6 py-4 text-end font-black">{isRtl ? 'دائن ($)' : 'Credit ($)'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {result.journalEntry.lines.map((line: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-6 py-4 font-bold text-start">{line.accountName}</td>
                              <td className="px-6 py-4 text-end font-mono font-black text-blue-600">{line.debit > 0 ? line.debit.toLocaleString() : "-"}</td>
                              <td className="px-6 py-4 text-end font-mono font-black text-rose-600">{line.credit > 0 ? line.credit.toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-primary text-white font-black">
                          <tr>
                            <td className="px-6 py-4 text-start">Total Balance</td>
                            <td className="px-6 py-4 text-end font-mono">
                              {result.journalEntry.lines.reduce((acc: number, cur: any) => acc + (cur.debit || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-end font-mono">
                              {result.journalEntry.lines.reduce((acc: number, cur: any) => acc + (cur.credit || 0), 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
