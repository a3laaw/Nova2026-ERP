
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, Loader2, Database, ShieldCheck, 
  CheckCircle2, AlertTriangle, Trash2, CalendarX,
  Settings2, RefreshCcw, DatabaseZap,
  CalendarDays
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { SeedService } from '@/services/seed-service';
import { toast } from '@/hooks/use-toast';

export function SeedTool() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  const [purgingSystem, setPurgingSystem] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleRunSeed = async () => {
    if (!db || !globalUser?.companyId) return;
    setLoading(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      await service.runSeed();
      setIsDone(true);
      toast({ title: t('common.saved') });
    } catch (error) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally { setLoading(false); }
  };

  const handleSyncBalances = async () => {
    if (!db || !globalUser?.companyId) return;
    setMigrating(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      const count = await service.syncAllEmployeeBalances();
      toast({ 
        title: isRtl ? "تمت مزامنة الأرصدة" : "Balances Synced", 
        description: isRtl ? `تم تحديث أرصدة ${count} موظف بناءً على تاريخ تعيينهم وإجازاتهم.` : `Updated ${count} employee balances.` 
      });
    } finally { setMigrating(false); }
  };

  const handleSystemPurge = async () => {
    if (!db || !globalUser?.companyId) return;
    const msg = isRtl 
      ? 'تنبيه خطير: سيتم حذف كافة العملاء، المشاريع، العقود، المقايسات، والقيود المحاسبية نهائياً. سيتم الحفاظ على الموظفين فقط. هل أنت متأكد؟' 
      : 'Danger: This will delete ALL clients, projects, contracts, BOQs, and accounting data. Employees will be kept. Proceed?';
    
    if (!confirm(msg)) return;

    setPurgingSystem(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      await service.purgeSystemData();
      toast({ title: isRtl ? "اكتمل التطهير الشامل" : "System Purge Complete" });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setPurgingSystem(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      
      {/* أدوات المزامنة والإصلاح */}
      <Card className="border-2 border-emerald-100 rounded-[2.5rem] bg-white overflow-hidden shadow-xl">
         <CardHeader className="bg-emerald-50/50 p-8 border-b text-start">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-emerald-800">
               <RefreshCcw className="h-5 w-5" />
               {isRtl ? 'أدوات إصلاح وصيانة البيانات' : 'Data Repair Tools'}
            </CardTitle>
         </CardHeader>
         <CardContent className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-slate-50 border-2 border-slate-100">
               <div className="text-start space-y-1">
                  <h4 className="font-black text-slate-900 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-600" /> {isRtl ? 'مزامنة أرصدة الإجازات التاريخية' : 'Sync Historical Leave Balances'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 max-w-sm">
                    {isRtl ? 'إعادة حساب الرصيد المستحق لكل موظف بناءً على تاريخ تعيينه (2.5 يوم/شهر) وخصم الإجازات الفعلية.' : 'Recalculate balances based on hire date (2.5d/mo) and used leaves.'}
                  </p>
               </div>
               <Button 
                 onClick={handleSyncBalances} 
                 disabled={migrating}
                 className="rounded-xl h-11 px-8 font-black gap-2 bg-emerald-600 text-white shadow-lg"
               >
                  {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {isRtl ? 'مزامنة الأرصدة الآن' : 'Sync Now'}
               </Button>
            </div>
         </CardContent>
      </Card>

      <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-2xl">
        <CardHeader className="bg-primary/5 p-12 text-center">
          <div className="mx-auto w-20 h-20 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-lg mb-6">
            <Database className="h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-black font-headline">{isRtl ? 'تهيئة المصنع المرجعي' : 'Reference Initialization'}</CardTitle>
          <CardDescription className="text-lg mt-2 font-bold opacity-70">ضخ القواعد الجغرافية والتنظيمية الموحدة</CardDescription>
        </CardHeader>
        <CardContent className="p-12">
          <Button onClick={handleRunSeed} disabled={loading || isDone} className="w-full h-16 rounded-2xl font-black text-xl bg-primary shadow-xl">
            {loading ? <Loader2 className="animate-spin me-2" /> : isDone ? <CheckCircle2 className="me-2" /> : <Sparkles className="me-2" />}
            تشغيل محرك التهيئة
          </Button>
        </CardContent>
      </Card>

      <Card className="border-2 border-rose-100 rounded-[3rem] bg-rose-50/20 overflow-hidden shadow-xl">
         <CardHeader className="p-8 text-start bg-rose-50/50 border-b">
            <CardTitle className="text-xl font-black text-rose-800 flex items-center gap-3"><DatabaseZap className="h-6 w-6" /> {isRtl ? 'التطهير الشامل للنظام' : 'System Purge'}</CardTitle>
         </CardHeader>
         <CardContent className="p-8">
            <p className="text-xs font-bold text-rose-700 leading-relaxed mb-6">
               تنبيه: سيتم مسح كافة السجلات المالية والتشغيلية (عملاء، مشاريع، عقود، رواتب) مع الحفاظ على القوى العاملة والهيكل التنظيمي.
            </p>
            <Button onClick={handleSystemPurge} disabled={purgingSystem} className="w-full h-12 rounded-xl bg-rose-600 text-white font-black">
               {purgingSystem ? <Loader2 className="animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />} {isRtl ? 'بدء التطهير الشامل' : 'Start Purge'}
            </Button>
         </CardContent>
      </Card>
    </div>
  );
}
