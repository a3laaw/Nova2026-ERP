
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
    <div className="space-y-10 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Sparkles className="h-3 w-3" /> {isRtl ? 'ذكاء اصطناعي توليدي' : 'Generative AI Intelligence'}
           </div>
           <h1 className="text-4xl font-black font-headline text-[#1e1b4b]">{isRtl ? 'محلل عروض الأسعار الذكي' : 'Smart Quote Analyzer'}</h1>
           <p className="text-muted-foreground font-bold text-sm opacity-70 italic">
             {isRtl ? 'استخدم الذكاء الاصطناعي لاستخراج البنود ومقارنة الموردين واختيار الأفضل.' : 'Compare supplier quotes and identify the best value using AI.'}
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Input Area */}
        <div className="lg:col-span-5 space-y-6">
           <div className="space-y-4">
              {quotes.map((quote, idx) => (
                <Card key={idx} className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-left-4 duration-300">
                   <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                         <div className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center text-xs">{idx + 1}</div>
                         {isRtl ? 'بيانات العرض' : 'Quote Data'}
                      </CardTitle>
                      {quotes.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeQuoteField(idx)} className="h-8 w-8 text-rose-500 hover:bg-rose-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                   </CardHeader>
                   <CardContent className="p-6 space-y-4 text-start">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم المورد' : 'Supplier Name'}</Label>
                         <Input 
                           value={quote.supplierName} 
                           onChange={e => updateQuote(idx, 'supplierName', e.target.value)}
                           className="h-11 rounded-xl border-2 font-bold"
                           placeholder={isRtl ? "مثلاً: شركة الخليج للحديد" : "e.g. Gulf Steel Co."}
                         />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نص العرض (Copy/Paste)' : 'Quote Text'}</Label>
                         <Textarea 
                           value={quote.quoteText}
                           onChange={e => updateQuote(idx, 'quoteText', e.target.value)}
                           className="min-h-[120px] rounded-xl border-2 p-4 text-xs font-medium resize-none bg-slate-50/50 focus:bg-white"
                           placeholder={isRtl ? "قم بلصق محتويات عرض السعر هنا..." : "Paste quote content here..."}
                         />
                      </div>
                   </CardContent>
                </Card>
              ))}
              
              <Button 
                variant="outline" 
                onClick={addQuoteField}
                className="w-full h-16 rounded-[2rem] border-2 border-dashed border-primary/30 text-primary font-black text-sm hover:bg-primary/5 transition-all gap-2"
              >
                <Plus className="h-5 w-5" /> {isRtl ? 'إضافة عرض مورد آخر' : 'Add Another Quote'}
              </Button>

              <Button 
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 mt-6"
              >
                {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Sparkles className="h-8 w-8" />}
                {isRtl ? 'تحليل ومقارنة العروض' : 'Analyze & Compare'}
              </Button>
           </div>
        </div>

        {/* Right: Results Analysis */}
        <div className="lg:col-span-7">
           {result ? (
             <div className="space-y-8 animate-in slide-in-from-right-6 duration-500">
                
                {/* AI Recommendation Banner */}
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                      <Sparkles className="h-32 w-32" />
                   </div>
                   <CardHeader className="bg-white/5 border-b border-white/5 p-10 text-start">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                            <ShieldCheck className="h-6 w-6 text-white" />
                         </div>
                         <div>
                            <CardTitle className="text-2xl font-black font-headline">{isRtl ? 'توصية Nova AI' : 'AI Recommendation'}</CardTitle>
                            <CardDescription className="text-primary font-bold">{isRtl ? 'المورد المفضل بناءً على التحليل' : 'Preferred supplier based on multi-criteria analysis'}</CardDescription>
                         </div>
                      </div>
                   </CardHeader>
                   <CardContent className="p-10 text-start space-y-6 relative z-10">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                         <div className="flex justify-between items-center">
                            <Badge className="bg-emerald-500 text-white font-black px-4 py-1 rounded-lg border-0 uppercase">Best Overall</Badge>
                            <h3 className="text-3xl font-black text-white">{result.comparisonSummary.bestOverallSupplier}</h3>
                         </div>
                         <p className="text-slate-300 font-bold leading-relaxed">{result.comparisonSummary.recommendation}</p>
                      </div>
                      <div className="space-y-3">
                         <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'الاختلافات الجوهرية' : 'Key Differences'}</h4>
                         <p className="text-sm text-slate-400 leading-relaxed italic">{result.comparisonSummary.keyDifferences}</p>
                      </div>
                   </CardContent>
                </Card>

                {/* Per Quote Extraction */}
                <div className="space-y-6">
                   <h3 className="text-xl font-black text-[#1e1b4b] flex items-center gap-2">
                      <FileSearch className="h-6 w-6 text-primary" />
                      {isRtl ? 'البنود المستخرجة آلياً' : 'Extracted Line Items'}
                   </h3>
                   {result.analysisPerQuote.map((analysis, i) => (
                      <Card key={i} className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                         <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-black text-[#1e1b4b]">{analysis.supplierName}</CardTitle>
                            <Badge variant="outline" className="font-bold">{analysis.extractedDetails.length} {isRtl ? 'بند' : 'Items'}</Badge>
                         </CardHeader>
                         <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-start text-sm">
                               <thead className="bg-slate-50/50 border-b">
                                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                                     <th className="p-4 text-start">{isRtl ? 'الصنف / البند' : 'Item'}</th>
                                     <th className="p-4 text-center">{isRtl ? 'الكمية' : 'Qty'}</th>
                                     <th className="p-4 text-end">{isRtl ? 'سعر الوحدة' : 'U. Price'}</th>
                                     <th className="p-4 text-end">{isRtl ? 'الإجمالي' : 'Total'}</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y">
                                  {analysis.extractedDetails.map((item, idx) => (
                                     <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-700">{item.item}</td>
                                        <td className="p-4 text-center font-black">{item.quantity || '-'}</td>
                                        <td className="p-4 text-end font-mono font-bold text-slate-500">{item.unitPrice?.toLocaleString() || '-'}</td>
                                        <td className="p-4 text-end font-mono font-black text-emerald-600">{item.totalPrice?.toLocaleString() || '-'}</td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </CardContent>
                      </Card>
                   ))}
                </div>

                <div className="flex gap-4">
                   <Button className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 hover:scale-105 transition-all gap-3">
                      <CheckCircle2 className="h-6 w-6" /> {isRtl ? 'اعتماد التوصية وإصدار LPO' : 'Approve & Create PO'}
                   </Button>
                   <Button variant="outline" onClick={() => setResult(null)} className="h-16 rounded-2xl border-2 font-black text-lg px-8">
                      {isRtl ? 'إعادة التحليل' : 'Re-Analyze'}
                   </Button>
                </div>
             </div>
           ) : (
             <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 animate-pulse">
                <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-slate-200 shadow-sm mb-6">
                   <Sparkles className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-black text-slate-400">{isRtl ? 'بانتظار مدخلات الموردين' : 'Waiting for Quote Inputs'}</h3>
                <p className="text-slate-300 font-bold mt-2 max-w-sm">
                  {isRtl ? 'قم بلصق محتويات عرض سعر واحد أو أكثر على الجانب للبدء في المقارنة الذكية.' : 'Paste content from one or more quotes to start the smart comparison.'}
                </p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
