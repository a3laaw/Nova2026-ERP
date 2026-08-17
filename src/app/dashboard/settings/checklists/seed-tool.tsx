'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SeedTool() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  const [purgingSystem, setPurgingSystem] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);

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
    setPurgingSystem(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      await service.purgeSystemData();
      toast({ title: isRtl ? "اكتمل التطهير الشامل" : "System Purge Complete" });
      setShowPurgeDialog(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setPurgingSystem(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 text-start" dir={dir}>
      
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
                  <p className="text-[10px] font-bold text-slate-400 max-w-sm leading-relaxed">
                    {isRtl ? 'إعادة حساب الرصيد المستحق لكل موظف بناءً على تاريخ تعيينه (2.5 يوم/شهر) وخصم الإجازات الفعلية المسجلة.' : 'Recalculate balances based on hire date (2.5d/mo) and used leaves.'}
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
          <CardTitle className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تهيئة المصنع المرجعي' : 'Reference Initialization'}</CardTitle>
          <CardDescription className="text-lg mt-2 font-bold opacity-70">ضخ القواعد الجغرافية والتنظيمية الموحدة</CardDescription>
        </CardHeader>
        <CardContent className="p-12">
          <Button onClick={handleRunSeed} disabled={loading || isDone} className="w-full h-20 rounded-3xl bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
            {loading ? <Loader2 className="animate-spin h-8 w-8 me-2" /> : isDone ? <CheckCircle2 className="h-8 w-8 me-2" /> : <Sparkles className="h-8 w-8 me-2" />}
            {isRtl ? 'تشغيل محرك التهيئة' : 'Run Init Engine'}
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
            <Button onClick={() => setShowPurgeDialog(true)} disabled={purgingSystem} className="w-full h-12 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 shadow-lg">
               <Trash2 className="me-2 h-4 w-4" /> {isRtl ? 'بدء التطهير الشامل' : 'Start Purge'}
            </Button>
         </CardContent>
      </Card>

      <AlertDialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <DatabaseZap className="h-12 w-12" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">
                  {isRtl ? 'تأكيد التطهير الشامل' : 'Confirm System Purge'}
               </AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {isRtl 
                    ? 'تحذير سيادي: هذا الإجراء سيقوم باقتلاع كافة البيانات التجارية والمالية والمقايسات من جذورها بشكل نهائي. سيتم الحفاظ فقط على سجلات الموظفين وهيكلك الإداري. هل أنت متأكد؟' 
                    : 'Danger: This action will permanently remove all commercial, financial and BOQ records. Only employee records and administrative structure will be preserved.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white" onClick={() => setShowPurgeDialog(false)}>{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction 
                 onClick={handleSystemPurge} 
                 className="flex-[2] h-14 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
               >
                  {purgingSystem ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، ابدأ التطهير' : 'Confirm Purge')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
