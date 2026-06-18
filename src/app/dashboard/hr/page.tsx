'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCircle, FileText, ShieldAlert, Sparkles, UploadCloud, Loader2 } from "lucide-react";
import { analyzeEmployeeDoc } from "@/ai/flows/analyzeEmployeeDoc";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function HRPage() {
  const { t, dir } = useLanguage();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const triggerSimulatedAnalysis = async () => {
    setAnalyzing(true);
    try {
      const dummyDataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
      const response = await analyzeEmployeeDoc({ documentDataUri: dummyDataUri });
      setResult(response);
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
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="text-start">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3">
          <UserCircle className="h-10 w-10 text-primary" />
          {t('operationalCompliance')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">{t('docAnalysis')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-1 overflow-hidden ring-1 ring-black/5">
          <CardHeader className="text-start bg-slate-50 border-b p-8">
            <CardTitle className="text-lg font-black">{t('docAnalysis')}</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="border-4 border-dashed border-muted rounded-[2rem] p-12 text-center bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group">
              <UploadCloud className="h-16 w-16 text-muted-foreground mx-auto group-hover:scale-110 transition-transform mb-4" />
              <p className="text-base font-black text-slate-700">{t('uploadDoc')}</p>
            </div>

            <Button
              onClick={triggerSimulatedAnalysis}
              disabled={analyzing}
              className="w-full bg-primary text-white font-black py-8 rounded-2xl shadow-xl shadow-primary/20 text-lg hover:scale-[1.02] transition-transform"
            >
              {analyzing ? (
                <><Loader2 className="me-3 h-6 w-6 animate-spin" /> {t('search')}</>
              ) : (
                <><Sparkles className="me-3 h-6 w-6" /> {t('analyzeNow')}</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-2 overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-secondary/40 border-b p-8 text-start">
            <CardTitle className="text-xl font-black flex items-center gap-3">
              <FileText className="text-primary h-6 w-6" />
              {t('complianceData')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 text-start">
            {result ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-muted/40 rounded-3xl border-2">
                    <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('employeeName')}</span>
                    <p className="font-black text-lg text-slate-800 mt-2">{result.employeeName || "Ahmad Mahmoud Hassan (Site Engineer)"}</p>
                  </div>
                  <div className="p-6 bg-muted/40 rounded-3xl border-2">
                    <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('docType')}</span>
                    <p className="font-black text-lg text-primary mt-2">{t('active')}</p>
                  </div>
                  <div className="p-6 bg-muted/40 rounded-3xl border-2">
                    <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('docNumber')}</span>
                    <p className="font-mono text-lg font-black mt-2 text-slate-800">{result.documentNumber || "9483021948"}</p>
                  </div>
                  <div className="p-6 bg-muted/40 rounded-3xl border-2">
                    <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('issuer')}</span>
                    <p className="font-black text-lg text-slate-800 mt-2">{result.issuer || "Kuwait Society of Engineers"}</p>
                  </div>
                </div>

                <div className="p-8 rounded-[2rem] border-2 bg-amber-50/50 space-y-4 shadow-inner">
                  <div className={cn("flex items-center gap-3 font-black text-lg text-amber-800", dir === 'rtl' ? 'flex-row-reverse' : 'flex-row')}>
                    <ShieldAlert className="h-6 w-6" />
                    <h6>{t('complianceNotes')}</h6>
                  </div>
                  <p className="text-base font-bold text-amber-900 leading-relaxed">
                    {result.complianceNotes || "The document meets all initial legal inspection requirements. Please match with PAM records."}
                  </p>
                </div>

                {result.summary && (
                  <div className="p-8 rounded-[2rem] bg-blue-50/50 border-2 border-blue-100 text-base leading-relaxed text-blue-900 font-bold shadow-sm">
                    <strong>{t('summary')}:</strong> {result.summary}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-32 text-muted-foreground space-y-6">
                <FileText className="h-20 w-20 mx-auto opacity-20" />
                <p className="text-lg font-bold italic">{t('search')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
