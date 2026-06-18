
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, FileSearch, TrendingUp, Calculator, Wand2, Loader2, Send } from "lucide-react"
import { useAccountingAssistant } from "@/ai/flows/accounting-assistant-flow"
import { toast } from "@/hooks/use-toast"

export default function AIPage() {
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
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-4xl font-black font-headline tracking-tight">Nova Intelligence Hub</h1>
        <p className="text-muted-foreground">Advanced GenAI for engineering, procurement, and financial operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md bg-white rounded-3xl cursor-pointer group">
          <CardHeader className="pb-2">
            <Calculator className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle className="text-lg font-bold font-headline">Accounting Assistant</CardTitle>
            <CardDescription>Draft journal entries or get expert accounting advice based on descriptions.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md bg-white rounded-3xl cursor-pointer group opacity-60">
          <CardHeader className="pb-2">
            <FileSearch className="h-8 w-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle className="text-lg font-bold font-headline">Quote Analyzer</CardTitle>
            <CardDescription>Upload supplier PDF quotes to automatically generate comparison summaries.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md bg-white rounded-3xl cursor-pointer group opacity-60">
          <CardHeader className="pb-2">
            <TrendingUp className="h-8 w-8 text-green-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle className="text-lg font-bold font-headline">Cash Flow Forecast</CardTitle>
            <CardDescription>Project liquidity based on BOQ milestones and historical payment trends.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-muted/30 p-8">
          <CardTitle className="font-headline font-bold text-2xl flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            Accounting Intelligence Terminal
          </CardTitle>
          <CardDescription>Describe a transaction in natural language (e.g., "We received a payment of $5,000 for invoice #123 from Client A") to generate entries.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <Textarea 
              placeholder="Enter your transaction description or accounting query..."
              className="min-h-[150px] text-lg p-6 rounded-2xl border-2 border-muted focus:border-primary/50 transition-all"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex justify-end">
              <Button 
                onClick={handleAccountingAssistant} 
                disabled={loading || !query}
                className="bg-primary text-white px-8 py-6 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <Send className="mr-2 h-6 w-6" />
                )}
                Analyze & Draft Entry
              </Button>
            </div>
          </div>

          {result && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-primary/5 rounded-3xl p-8 border border-primary/20 space-y-6">
                <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                  <h3 className="font-headline font-bold text-xl">Proposed Journal Entry</h3>
                  <Button variant="outline" size="sm" className="bg-white">Refine with AI</Button>
                </div>
                
                {result.advice && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-primary uppercase tracking-widest">Advisory Note</p>
                    <p className="text-lg leading-relaxed">{result.advice}</p>
                  </div>
                )}

                {result.journalEntry && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-2xl shadow-sm space-y-2">
                      <p className="text-sm text-muted-foreground">Narration:</p>
                      <p className="font-bold text-lg">{result.journalEntry.narration}</p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-6 py-4 text-left font-bold font-headline">Account Name</th>
                            <th className="px-6 py-4 text-right font-bold font-headline">Debit ($)</th>
                            <th className="px-6 py-4 text-right font-bold font-headline">Credit ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {result.journalEntry.lines.map((line: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-6 py-4 font-medium">{line.accountName}</td>
                              <td className="px-6 py-4 text-right font-mono">{line.debit > 0 ? line.debit.toLocaleString() : "-"}</td>
                              <td className="px-6 py-4 text-right font-mono">{line.credit > 0 ? line.credit.toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-primary text-white font-bold">
                          <tr>
                            <td className="px-6 py-4">Total Balance</td>
                            <td className="px-6 py-4 text-right font-mono">
                              {result.journalEntry.lines.reduce((acc: number, cur: any) => acc + (cur.debit || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono">
                              {result.journalEntry.lines.reduce((acc: number, cur: any) => acc + (cur.credit || 0), 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex gap-4">
                      <Button className="flex-1 bg-primary text-white py-6 rounded-2xl font-bold">Post to Ledger</Button>
                      <Button variant="outline" className="flex-1 py-6 rounded-2xl font-bold bg-white">Save as Draft</Button>
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
