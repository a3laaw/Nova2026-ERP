
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, Loader2, Database, ShieldCheck, 
  CheckCircle2, AlertTriangle, Trash2, CalendarX,
  Settings2, Fingerprint, RefreshCcw, DatabaseZap,
  UserCheck, Plane
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
  const [purgingLeaves, setPurgingLeaves] = useState(false);
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
    } finally {
      setPurging(false);
    }
  };

  const handlePurgeLeaves = async () => {
    if (!db || !globalUser?.companyId) return;
    if (!confirm(isRtl ? 'تنبيه خطير: سيتم حذف كافة طلبات الإجازات نهائياً مع المحافظة على سجلات الموظفين. هل أنت متأكد؟' : 'Danger: This will delete all leave requests permanently. Employees will be kept. Proceed?')) return;
    setPurgingLeaves(true);
    const service = new SeedService(db, globalUser.companyId);
    try {
      await service.purgeAllLeaves();
      toast({ title: isRtl ? "تم تطهير أرشيف الإجازات" : "Leaves Purged Successfully" });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setPurgingLeaves(false);
    }
  };

  const handleSystemPurge = async () => {
    if (!db || !globalUser?.companyId) return;
    const msg = isRtl 
      ? 'تنبيه خطير: سيتم حذف كافة العملاء، المشاريع، العقود (مالك وباطن)، المقايسات، القيود المحاسبية، وشجرة الحسابات نهائياً وتصفير العدادات. سيتم الحفاظ على الموظفين فقط. هل أنت متأكد؟' 
      : 'Nuclear Warning: This will delete ALL clients, projects, contracts (owner & subcon), quotations, BOQs, accounting data, and reset counters. Employees will be kept. Proceed?';
    
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
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
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
                     <li>{isRtl ? 'حذف كافة العملاء، المعاملات، وعقود الملاك والمقاولين.' : 'Delete all clients, transactions, and owner/subcon contracts.'}</li>
                     <li>{isRtl ? 'مسح شجرة الحسابات، قيود اليومية، والسندات المالية.' : 'Wipe COA, journals, and vouchers.'}</li>
                     <li>{isRtl ? 'تصفير كافة العدادات الرقمية (الترقيم يبدأ من 1).' : 'Reset all sequential counters to 1.'}</li>
                     <li className="text-emerald-600 font-black">{isRtl ? 'سيتم الحفاظ على سجلات الموظفين والهيكل التنظيمي.' : 'Employees and Org Structure will be kept.'}</li>
                  </ul>
               </div>
            </div>
            <Button 
              onClick={handleSystemPurge} 
              disabled={purgingSystem} 
              className="w-full h-12 rounded-xl bg-rose-600 text-white font-black text-sm shadow-xl shadow-rose-200 border-b-4 border-rose-800 hover:scale-[1.02] active:scale-95 transition-all gap-4"
            >
               {purgingSystem ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
               {isRtl ? 'بدء التطهير الشامل الآن' : 'Start Complete Purge'}
            </Button>
         </CardContent>
      </Card>

      <Card className="border-2 border-slate-200 rounded-[2.5rem] bg-white overflow-hidden shadow-xl">
         <CardHeader className="bg-slate-50 border-b p-8 text-start">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
               <Settings2 className="h-5 w-5 text-primary" />
               {isRtl ? 'أدوات تنظيف الأقسام المتخصصة' : 'Specific Data Cleaning Tools'}
            </CardTitle>
         </CardHeader>
         <CardContent className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-slate-50 border-2 border-slate-100">
               <div className="text-start space-y-1">
                  <h4 className="font-black text-slate-900 flex items-center gap-2"><Plane className="h-4 w-4 text-primary" /> {isRtl ? 'تطهير أرشيف الإجازات' : 'Purge All Leaves'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 max-w-sm">
                    {isRtl ? 'حذف كافة طلبات الإجازات (المعتمدة والسابقة) لتصفير سجلات الغياب.' : 'Wipe all leave logs. Employees are safe.'}
                  </p>
               </div>
               <Button 
                 onClick={handlePurgeLeaves} 
                 disabled={purgingLeaves}
                 variant="destructive" 
                 className="rounded-xl h-11 px-8 font-black gap-2 shadow-lg shadow-rose-100"
               >
                  {purgingLeaves ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isRtl ? 'تطهير الإجازات' : 'Purge Leaves'}
               </Button>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-slate-50 border-2 border-slate-100">
               <div className="text-start space-y-1">
                  <h4 className="font-black text-slate-900 flex items-center gap-2"><CalendarX className="h-4 w-4 text-primary" /> {isRtl ? 'تطهير سجل المواعيد' : 'Purge All Appointments'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 max-w-sm">
                    {isRtl ? 'حذف كافة المواعيد المجدولة في الرادار لضمان بداية نظيفة لجدول العمل.' : 'Wipe all appointments logs.'}
                  </p>
               </div>
               <Button 
                 onClick={handlePurgeAppointments} 
                 disabled={purging}
                 variant="outline" 
                 className="rounded-xl h-11 px-8 font-black gap-2 border-2"
               >
                  {purging ? <Loader2 className="animate-spin h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isRtl ? 'حذف المواعيد' : 'Purge Logs'}
               </Button>
            </div>
         </CardContent>
      </Card>
    </div>
  );
}
