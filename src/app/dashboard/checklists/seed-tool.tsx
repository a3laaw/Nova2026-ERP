'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Database, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { SeedService } from '@/services/seed-service';
import { toast } from '@/hooks/use-toast';

export function SeedTool() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  
  const isRtl = lang === 'ar';

  const handleRunSeed = async () => {
    if (!db || !globalUser?.companyId) return;
    
    setLoading(true);
    const service = new SeedService(db, globalUser.companyId);
    
    try {
      const alreadySeeded = await service.isSystemSeeded();
      if (alreadySeeded && !confirm(isRtl ? 'تم العثور على بيانات سابقة. هل تريد إضافة المزيد؟ قد يتسبب ذلك في تكرار السجلات.' : 'Existing data found. Proceeding might duplicate records. Continue?')) {
        setLoading(false);
        return;
      }

      await service.runSeed();
      setIsDone(true);
      toast({
        title: isRtl ? "تمت تهيئة النظام" : "System Initialized",
        description: isRtl ? "تم ضخ كافة البيانات المرجعية بنجاح." : "All reference data injected successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('error'),
        description: t('saveFailed'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-2xl">
      <CardHeader className="bg-primary/5 p-12 text-center">
        <div className="mx-auto w-24 h-24 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/30 mb-6 rotate-3">
          <Database className="h-12 w-12" />
        </div>
        <CardTitle className="text-3xl font-black font-headline tracking-tight">
          {isRtl ? 'تهيئة المصنع المرجعي' : 'Reference Factory Initialization'}
        </CardTitle>
        <CardDescription className="text-lg mt-2 font-bold opacity-70">
          {isRtl ? 'ضخ القواعد الجغرافية، التنظيمية، والفنية الموحدة لنظام Nova ERP' : 'Inject geography, organization, and technical paths for Nova ERP'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-start gap-4">
             <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm border text-primary shrink-0">
               <ShieldCheck className="h-5 w-5" />
             </div>
             <div className="text-start">
               <h5 className="font-black text-slate-800">{isRtl ? 'بيانات آمنة' : 'Secure Data'}</h5>
               <p className="text-xs text-muted-foreground font-bold leading-relaxed">{isRtl ? 'يتم عزل البيانات بالكامل داخل نطاق شركتك فقط.' : 'Data is fully isolated within your company scope.'}</p>
             </div>
          </div>
          <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-start gap-4">
             <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm border text-emerald-500 shrink-0">
               <Sparkles className="h-5 w-5" />
             </div>
             <div className="text-start">
               <h5 className="font-black text-slate-800">{isRtl ? 'تجهيز فوري' : 'Instant Setup'}</h5>
               <p className="text-xs text-muted-foreground font-bold leading-relaxed">{isRtl ? 'إنشاء الأقسام، المحافظات، والمسارات الفنية في ثوانٍ.' : 'Create departments, governorates, and paths in seconds.'}</p>
             </div>
          </div>
        </div>

        <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 flex items-center gap-4 text-amber-800">
           <AlertTriangle className="h-6 w-6 shrink-0" />
           <p className="text-sm font-bold">{isRtl ? 'تنبيه: لا تقم بتشغيل هذه العملية إلا عند إعداد الشركة لأول مرة.' : 'Warning: Only run this process during the initial company setup.'}</p>
        </div>

        <Button 
          onClick={handleRunSeed}
          disabled={loading || isDone}
          className="w-full h-20 rounded-[2rem] font-black text-2xl bg-primary hover:scale-[1.02] transition-all shadow-2xl shadow-primary/30"
        >
          {loading ? (
            <><Loader2 className="me-3 h-8 w-8 animate-spin" /> {isRtl ? 'جاري ضخ البيانات...' : 'Injecting Data...'}</>
          ) : isDone ? (
            <><CheckCircle2 className="me-3 h-8 w-8" /> {isRtl ? 'تمت التهيئة بنجاح' : 'System Ready'}</>
          ) : (
            <><Sparkles className="me-3 h-8 w-8" /> {isRtl ? 'تشغيل محرك التهيئة الآن' : 'Run Initialization Engine'}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}