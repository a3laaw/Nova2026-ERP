'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, Loader2, Database, ShieldCheck, 
  CheckCircle2, AlertTriangle, Trash2, CalendarX,
  Settings2, Fingerprint, RefreshCcw
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
  const [purging, setPurging] = useState(false);
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
      toast({ title: t('common.saved'), description: `Updated ${count} users.` });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Card className="border-4 border-emerald-100 rounded-[3rem] bg-emerald-50/20 overflow-hidden shadow-2xl">
        <CardHeader className="p-10 text-start">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg"><Fingerprint className="h-6 w-6" /></div>
              <div>
                 <CardTitle className="text-2xl font-black">{isRtl ? 'توحيد هويات النظام' : 'Identity Standardization'}</CardTitle>
                 <CardDescription className="font-bold">{isRtl ? 'إصلاح تباين الصلاحيات وتوحيد الأكواد المرجعية لكافة المستخدمين.' : 'Fix permission variances and unify roles.'}</CardDescription>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-10 pt-0 flex flex-col md:flex-row items-center justify-between gap-6">
           <Button onClick={handleIdentityMigration} disabled={migrating} className="h-16 px-10 rounded-2xl bg-emerald-600 text-white font-black shadow-xl gap-3">
              {migrating ? <Loader2 className="animate-spin h-6 w-6" /> : <RefreshCcw className="h-6 w-6" />}
              {isRtl ? 'بدء الهوية السيادية' : 'Run Identity Fix'}
           </Button>
        </CardContent>
      </Card>

      <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white overflow-hidden shadow-2xl">
        <CardHeader className="bg-primary/5 p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl mb-6"><Database className="h-12 w-12" /></div>
          <CardTitle className="text-3xl font-black font-headline tracking-tight">{isRtl ? 'تهيئة المصنع المرجعي' : 'Reference Factory Initialization'}</CardTitle>
          <CardDescription className="text-lg mt-2 font-bold opacity-70">{isRtl ? 'ضخ القواعد الجغرافية، التنظيمية، والفنية الموحدة لنظام Nova ERP' : 'Inject geography, organization, and technical paths.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-12 space-y-8">
          <Button onClick={handleRunSeed} disabled={loading || isDone} className="w-full h-20 rounded-[2rem] font-black text-2xl bg-primary shadow-2xl shadow-primary/20">
            {loading ? <Loader2 className="me-3 h-8 w-8 animate-spin" /> : isDone ? <CheckCircle2 className="me-3 h-8 w-8" /> : <Sparkles className="me-3 h-8 w-8" />}
            {isRtl ? 'تشغيل محرك التهيئة الآن' : 'Run Initialization Engine'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-2 border-rose-100 rounded-[2.5rem] bg-white overflow-hidden shadow-xl">
         <CardHeader className="bg-rose-50/50 p-8 border-b text-start"><CardTitle className="text-lg font-black flex items-center gap-3 text-rose-800"><Settings2 className="h-5 w-5" /> {isRtl ? 'أدوات سلامة وصيانة البيانات' : 'Data Maintenance Tools'}</CardTitle></CardHeader>
         <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-slate-50 border-2">
               <div className="text-start space-y-1"><h4 className="font-black text-slate-900">{isRtl ? 'تطهير سجل المواعيد' : 'Purge All Appointments'}</h4></div>
               <Button onClick={handlePurgeAppointments} disabled={purging} variant="destructive" className="rounded-xl h-12 px-8 font-black gap-2 shadow-lg">{isRtl ? 'حذف كافة المواعيد' : 'Purge Logs'}</Button>
            </div>
         </CardContent>
      </Card>
    </div>
  );
}
