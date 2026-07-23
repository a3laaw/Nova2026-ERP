'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Plus, Trash2, Loader2, Send, 
  CheckCircle2, AlertTriangle, ArrowRight,
  TrendingDown, ShieldCheck, FileSearch
} from "lucide-react";
import { analyzeSupplierQuotes, AnalyzeSupplierQuotesOutput } from "@/ai/flows/analyze-supplier-quotes-flow";
import { useLanguage } from '@/context/language-context';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function SmartQuoteAnalyzerPage() {
  const { t, lang, dir } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [quotes, setQuotes] = useState([{ supplierName: '', quoteText: '' }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeSupplierQuotesOutput | null>(null);

  const addQuoteField = () => {
    setQuotes([...quotes, { supplierName: '', quoteText: '' }]);
  };

  const removeQuoteField = (index: number) => {
    setQuotes(quotes.filter((_, i) => i !== index));
  };

  const updateQuote = (index: number, field: string, value: string) => {
    const updated = [...quotes];
    (updated[index] as any)[field] = value;
    setQuotes(updated);
  };

  const handleAnalyze = async () => {
    if (quotes.some(q => !q.supplierName || !q.quoteText)) {
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Data" });
      return;
    }

    setLoading(true);
    try {
      const response = await analyzeSupplierQuotes({ quotes });
      setResult(response);
      toast({ title: isRtl ? "تم التحليل بنجاح" : "Analysis Complete" });
    } catch (error) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="text-start space-y-1 border-b pb-6">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full w-fit">
              <Sparkles className="h-3 w-3" /> {isRtl ? 'ذكاء اصطناعي' : 'GenAI'}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'محلل عروض الأسعار' : 'Quote Analyzer'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
           {quotes.map((quote, idx) => (
             <Card key={idx} className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-left-4 duration-300">
                <CardHeader className="bg-slate-50/50 border-b p-5 flex flex-row items-center justify-between">
                   <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest text-slate-500">
                      <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">{idx + 1}</Badge>
                      {isRtl ? 'بيانات العرض' : 'Quote Data'}
                   </CardTitle>
                   {quotes.length > 1 && (
                     <Button variant="ghost" size="icon" onClick={() => removeQuoteField(idx)} className="h-7 w-7 text-rose-500 hover:bg-rose-50">
                       <Trash2 className="h-3.5 w-3.5" />
                     </Button>
                   )}
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-start">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Supplier</Label>
                      <Input 
                        value={quote.supplierName} 
                        onChange={e => updateQuote(idx, 'supplierName', e.target.value)}
                        className="h-10 rounded-lg border-2 font-bold"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Content</Label>
                      <Textarea 
                        value={quote.quoteText}
                        onChange={e => updateQuote(idx, 'quoteText', e.target.value)}
                        className="min-h-[100px] rounded-lg border-2 p-3 text-xs font-medium bg-slate-50/30"
                      />
                   </div>
                </CardContent>
             </Card>
           ))}
           
           <Button variant="outline" onClick={addQuoteField} className="w-full h-11 rounded-xl border-dashed border-primary/30 text-primary font-black text-xs gap-2">
             <Plus className="h-4 w-4" /> {isRtl ? 'إضافة عرض مورد' : 'Add Quote'}
           </Button>

           <Button onClick={handleAnalyze} disabled={loading} className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 transition-all gap-3 mt-4">
             {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
             {isRtl ? 'تحليل ومقارنة العروض' : 'Analyze Now'}
           </Button>
        </div>

        <div className="lg:col-span-7">
           {result ? (
             <div className="space-y-6 animate-in slide-in-from-right-6 duration-500 text-start">
                <Card className="border-4 border-orange-100 shadow-2xl rounded-3xl bg-white overflow-hidden relative">
                   <CardHeader className="bg-primary/5 border-b p-8">
                      <div className="flex items-center gap-4">
                         <div className="h-11 w-11 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg"><ShieldCheck className="h-6 w-6" /></div>
                         <CardTitle className="text-xl font-black font-headline">{isRtl ? 'توصية Nova AI' : 'AI Analysis'}</CardTitle>
                      </div>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="p-5 bg-slate-50 rounded-2xl border-2 border-white shadow-inner space-y-2">
                         <Badge className="bg-emerald-500 text-white font-black text-[9px] px-3 uppercase">Best Value</Badge>
                         <h3 className="text-2xl font-black text-slate-900">{result.comparisonSummary.bestOverallSupplier}</h3>
                         <p className="text-xs font-bold text-slate-600 leading-relaxed">{result.comparisonSummary.recommendation}</p>
                      </div>
                   </CardContent>
                </Card>
             </div>
           ) : (
             <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-3xl border-4 border-dashed border-slate-100 animate-pulse">
                <Sparkles className="h-10 w-10 text-slate-200 mb-4" />
                <h3 className="text-xl font-black text-slate-400">{isRtl ? 'بانتظار المدخلات' : 'Waiting for Quotes'}</h3>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
