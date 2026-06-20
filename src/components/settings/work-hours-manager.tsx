'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, Calendar, MoonStar, 
  Loader2, Save, Sun, HardHat,
  Coffee, Utensils, Trash2,
  CalendarCheck, Plus, Flag,
  Info, Edit3, X, Zap
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { WorkHoursService } from '@/services/work-hours-service';
import { WorkHoursSettings, DayOfWeek, DailySchedule, PublicHoliday } from '@/types/work-hours';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { SmartDateInput } from '@/components/ui/smart-date-input';

const DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUGGESTED_KUWAIT_HOLIDAYS_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'رأس السنة الميلادية', nameEn: 'New Year\'s Day' },
  { date: '2026-02-25', name: 'العيد الوطني', nameEn: 'National Day' },
  { date: '2026-02-26', name: 'يوم التحرير', nameEn: 'Liberation Day' },
];

export function WorkHoursManager() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, lang } = useLanguage();
  const db = useFirestore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);

  const [manualHoliday, setManualHoliday] = useState({ name: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const service = useMemo(() => 
    db && globalUser?.companyId ? new WorkHoursService(db, globalUser.companyId) : null, 
  [db, globalUser]);

  useEffect(() => {
    async function load() {
      if (!service) return;
      try {
        const data = await service.getSettings();
        setSettings(data || { 
          ...service.getDefaultSettings(), 
          companyId: globalUser!.companyId,
          publicHolidays: [] 
        } as WorkHoursSettings);
      } catch (e) {
        toast({ variant: "destructive", title: t('error'), description: "Error loading settings" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [service, globalUser, t]);

  const handleSave = async () => {
    if (!service || !settings || !user) return;
    setSaving(true);
    try {
      await service.saveSettings(settings, user.uid);
      toast({ title: t('saved'), description: t('entryAdded') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (scope: 'general' | 'architectural', field: keyof DailySchedule, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [scope]: { ...settings[scope], [field]: value }
    });
  };

  const toggleHoliday = (day: DayOfWeek) => {
    if (!settings) return;
    const current = settings.holidays;
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setSettings({ ...settings, holidays: updated });
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>;

  const ScheduleCard = ({ scope, title, icon: Icon, colorClass, bgClass }: { scope: 'general' | 'architectural', title: string, icon: any, colorClass: string, bgClass: string }) => {
    const sched = settings?.[scope];
    if (!sched) return null;

    return (
      <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className={cn("border-b p-8 text-start", bgClass)}>
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-white rounded-2xl shadow-sm"><Icon className={cn("h-6 w-6", colorClass)} /></div>
                 <div>
                    <CardTitle className="text-xl font-black">{title}</CardTitle>
                    <CardDescription className="font-bold">{lang === 'ar' ? 'نظام الدوام والورديات.' : 'Work system and shifts.'}</CardDescription>
                 </div>
              </div>
              <div className="bg-white/80 backdrop-blur p-1 rounded-xl border flex gap-1">
                 <Button 
                   variant={sched.mode === 'single' ? 'default' : 'ghost'} 
                   size="sm" 
                   onClick={() => updateSchedule(scope, 'mode', 'single')}
                   className="h-8 text-[10px] font-black rounded-lg"
                 >
                   {lang === 'ar' ? 'فترة واحدة' : 'Single'}
                 </Button>
                 <Button 
                   variant={sched.mode === 'double' ? 'default' : 'ghost'} 
                   size="sm" 
                   onClick={() => updateSchedule(scope, 'mode', 'double')}
                   className="h-8 text-[10px] font-black rounded-lg"
                 >
                   {lang === 'ar' ? 'فترتين' : 'Double'}
                 </Button>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8 text-start">
           <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-primary">
                    <Sun className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'ar' ? 'الفترة الصباحية' : 'Morning Shift'}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <Input type="time" value={sched.morningStartTime} onChange={e => updateSchedule(scope, 'morningStartTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold" />
                    <Input type="time" value={sched.morningEndTime} onChange={e => updateSchedule(scope, 'morningEndTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold" />
                 </div>
              </div>

              <div className={cn("space-y-4 transition-opacity", sched.mode === 'single' ? 'opacity-30' : 'opacity-100')}>
                 <div className="flex items-center gap-2 text-blue-600">
                    <MoonStar className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'ar' ? 'الفترة المسائية' : 'Evening Shift'}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <Input type="time" disabled={sched.mode === 'single'} value={sched.eveningStartTime} onChange={e => updateSchedule(scope, 'eveningStartTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold" />
                    <Input type="time" disabled={sched.mode === 'single'} value={sched.eveningEndTime} onChange={e => updateSchedule(scope, 'eveningEndTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold" />
                 </div>
              </div>
           </div>

           <div className="pt-6 border-t flex items-center justify-between">
              <div className="space-y-1">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{lang === 'ar' ? 'فترة السماح (دقيقة)' : 'Grace Period (Min)'}</Label>
                 <Input type="number" value={sched.bufferMinutes} onChange={e => updateSchedule(scope, 'bufferMinutes', Number(e.target.value))} className="w-24 h-10 rounded-lg border-2 font-black" />
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 max-w-[200px]">
                 <p className="text-[9px] font-bold text-amber-800 leading-tight">
                    {sched.mode === 'double' 
                      ? (lang === 'ar' ? 'يتم حساب التأخير عند بداية كل فترة بشكل منفصل.' : 'Latencies are calculated at the start of each shift.')
                      : (lang === 'ar' ? 'يتم حساب التأخير بناءً على بداية الصباح فقط.' : 'Lateness is based on morning start only.')}
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3">
             <Clock className="h-8 w-8 text-primary" />
             {t('workHours')}
           </h1>
           <p className="text-muted-foreground font-bold text-sm mt-1 opacity-80 italic">
             {lang === 'ar' ? 'تحديد نظام الشفتات والورديات للمنظمة.' : 'Define shifts and work system for the org.'}
           </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-white font-black rounded-2xl px-10 h-16 text-lg shadow-xl">
          {saving ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
          {t('saveAllRules')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ScheduleCard 
           scope="general" 
           title={t('generalWorkingHours')} 
           icon={Sun} 
           colorClass="text-primary" 
           bgClass="bg-primary/5" 
        />
        <ScheduleCard 
           scope="architectural" 
           title={t('architecturalWorkingHours')} 
           icon={HardHat} 
           colorClass="text-blue-600" 
           bgClass="bg-blue-50/50" 
        />

        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 lg:col-span-2">
          <CardHeader className="bg-amber-50/50 border-b p-8 text-start flex flex-row items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600"><Calendar className="h-6 w-6" /></div>
                <div><CardTitle className="text-xl font-black">{t('holidays')}</CardTitle></div>
             </div>
          </CardHeader>
          <CardContent className="p-8 text-start">
             <div className="flex flex-wrap gap-3">
                {DAYS.map(day => (
                   <div 
                     key={day} 
                     onClick={() => toggleHoliday(day)}
                     className={cn(
                       "cursor-pointer px-5 py-3 rounded-2xl border-2 font-black transition-all",
                       settings?.holidays.includes(day) 
                         ? "bg-amber-500 text-white border-amber-500 shadow-lg" 
                         : "bg-white text-slate-400 border-slate-100 hover:border-amber-200"
                     )}
                   >
                      {t(day)}
                   </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
