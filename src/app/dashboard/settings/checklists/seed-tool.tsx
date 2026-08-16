'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, Loader2, Database, ShieldCheck, 
  CheckCircle2, AlertTriangle, Trash2, CalendarX,
  Settings2, Fingerprint, RefreshCcw, DatabaseZap,
  UserCheck
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { SeedService } from '@/services/seed-service';
import { toast } from '@/hooks/use-toast';

export function SeedTool() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgingSystem, setPurgingSystem] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleRunSeed = async () => {
    if (!db || !globalUser?.companyId) return;
    setLoading(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      const alreadySeeded = await service.isSystemSeeded();
      if (alreadySeeded && !confirm(isRtl ? 'تم العثور على بيانات سابقة. هل تريد إضافة المزيد؟ قد يتسبب ذلك في تكرار السجلات.' : 'Existing data found. Duplicates possible. Continue?')) {
        setLoading(false);
        return;
      }
      await service.runSeed();
      setIsDone(true);
      toast({ title: t('common.saved') });
    } catch (error) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally { setLoading(false); }
  };

  const handleIdentityMigration = async () => {
    if (!db || !globalUser?.companyId) return;
    setMigrating(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      const count = await service.runIdentityMigration();
      toast({ title: tSafe('inline.identity.fixed', 'تم إصلاح الهويات', 'Identity Fixed'), description: `Updated ${count} users.` });
    } finally { setMigrating(false); }
  };

  const handlePurgeAppointments = async () => {
    if (!db || !globalUser?.companyId) return;
    if (!confirm(isRtl ? 'تنبيه: سيتم حذف كافة المواعيد (المجدولة والمكتملة) نهائياً. هل أنت متأكد؟' : 'Warning: All appointments will be deleted. Proceed?')) return;
    setPurging(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      await service.purgeAllAppointments();
      toast({ title: t('common.deleted') });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally { setPurging(false); }
  };

  const handleSystemPurge = async () => {
    if (!db || !globalUser?.companyId) return;
    const msg = isRtl 
      ? 'تنبيه خطير: سيتم حذف كافة العملاء، المشاريع، القيود المحاسبية، وشجرة الحسابات نهائياً وتصفير العدادات. سيتم الحفاظ على الموظفين فقط. هل أنت متأكد؟' 
      : 'Nuclear Warning: This will delete ALL clients, projects, accounting data, and reset counters. Employees will be kept. Proceed?';
    
    if (!confirm(msg)) return;

    setPurgingSystem(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      await service.purgeSystemData();
      toast({ 
        title: isRtl ? "اكتمل التطهير الشامل" : "System Purge Complete",
        description: isRtl ? "تم تصفير النظام بنجاح مع الحفاظ على القوى العاملة." : "System reset successfully, employees kept."
      });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setPurgingSystem(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* قسم التطهير الشامل السيادي */}
      <Card className="border-4 border-rose-100 rounded-[3rem] bg-rose-50/20 overflow-hidden shadow-2xl animate-in zoom-in-95">
         <CardHeader className="p-10 text-start bg-rose-50/50 border-b border-rose-100">
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg"><DatabaseZap className="h-6 w-6" /></div>
               <div className="text-start">
                  <CardTitle className="text-2xl font-black text-slate-800">{isRtl ? 'التطهير الشامل للنظام' : 'System-Wide Data Purge'}</CardTitle>
                  <Badge variant="destructive" className="mt-2 font-black uppercase text-[10px] tracking-widest px-3">NUCLEAR RESET</Badge>
               </div>
            </div>
         </CardHeader>
         <CardContent className="p-10 space-y-6 text-start">
            <div className="flex items-start gap-4 p-6 bg-white rounded-3xl border-2 border-rose-100 shadow-inner">
               <AlertTriangle className="h-8 w-8 text-rose-600 shrink-0 mt-1" />
               <div className="space-y-2">
                  <h4 className="font-black text-rose-800">{isRtl ? 'ماذا سيحدث عند الضغط؟' : 'What happens next?'}</h4>
                  <ul className="text-xs font-bold text-slate-500 space-y-2 list-disc ps-4">
                     <li>{isRtl ? 'حذف كافة العملاء والملفات الفنية.' : 'Delete all clients and technical files.'}</li>
                     <li>{isRtl ? 'مسح شجرة الحسابات، قيود اليومية، والسندات المالية.' : 'Wipe COA, journals, and vouchers.'}</li>
                     <li>{isRtl ? 'تصفير كافة العدادات الرقمية (الترقيم يبدأ من 1).' : 'Reset all sequential counters to 1.'}</li>
                     <li className="text-emerald-600 font-black">{isRtl ? 'سيتم الحفاظ على سجلات الموظفين والهيكل التنظيمي.' : 'Employees and Org Structure will be kept.'}</li>
                  </ul>
               </div>
            </div>
            <Button 
              onClick={handleSystemPurge} 
              disabled={purgingSystem} 
              className="w-full h-12 rounded-2xl bg-rose-600 text-white font-black text-sm shadow-xl shadow-rose-200 border-b-4 border-rose-800 hover:scale-[1.02] active:scale-95 transition-all gap-4"
            >
               {purgingSystem ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
               {isRtl ? 'بدء التطهير الشامل الآن' : 'Start Complete Purge'}
            </Button>
         </CardContent>
      </Card>

      <Card className="border-4 border-emerald-100 rounded-[3rem] bg-emerald-50/20 overflow-hidden shadow-xl">
        <CardHeader className="p-10 text-start">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg"><Fingerprint className="h-6 w-6" /></div>
              <div className="text-start">
                 <CardTitle className="text-2xl font-black text-slate-800">{isRtl ? 'توحيد هويات النظام' : 'Identity Standardization'}</CardTitle>
                 <CardDescription className="font-bold">{isRtl ? 'إصلاح تباين الصلاحيات وتوحيد الأكواد المرجعية لكافة المستخدمين.' : 'Fix permission variances and unify roles.'}</CardDescription>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-10 pt-0 flex flex-col md:flex-row items-center justify-between gap-6">
           <Button onClick={handleIdentityMigration} disabled={migrating} className="h-12 px-10 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl gap-3">
              {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {isRtl ? 'بدء الهوية السيادية' : 'Run Identity Fix'}
           </Button>
        </CardContent>
      </Card>

      <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-xl">
        <CardHeader className="bg-primary/5 p-12 text-center">
          <div className="mx-auto w-20 h-20 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl mb-6"><Database className="h-10 w-10" /></div>
          <CardTitle className="text-3xl font-black font-headline tracking-tight text-slate-800">{isRtl ? 'تهيئة المصنع المرجعي' : 'Reference Factory Initialization'}</CardTitle>
          <CardDescription className="text-lg mt-2 font-bold opacity-70">{isRtl ? 'ضخ القواعد الجغرافية، التنظيمية، والفنية الموحدة لنظام Nova ERP' : 'Inject geography, organization, and technical paths.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-12 space-y-8">
          <Button onClick={handleRunSeed} disabled={loading || isDone} className="w-full h-12 rounded-2xl font-black text-sm bg-primary shadow-xl shadow-primary/20">
            {loading ? <Loader2 className="me-3 h-5 w-5 animate-spin" /> : isDone ? <CheckCircle2 className="me-3 h-5 w-5" /> : <Sparkles className="me-3 h-5 w-5" />}
            {isRtl ? 'تشغيل محرك التهيئة الآن' : 'Run Initialization Engine'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}