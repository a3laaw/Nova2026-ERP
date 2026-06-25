'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, Calendar, MoonStar, 
  Loader2, Save, Sun, HardHat,
  Trash2, Zap, Sparkles,
  CheckCircle2, Coffee, Users
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { WorkHoursService } from '@/services/work-hours-service';
import { WorkHoursSettings, DayOfWeek, DailySchedule } from '@/types/work-hours';
import { fetchPublicHolidays } from '@/ai/flows/fetch-holidays-flow';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WorkHoursManager() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, lang } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingHolidays, setFetchingHolidays] = useState(false);
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);

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

  const handleAIFetchHolidays = async () => {
    if (!settings) return;
    setFetchingHolidays(true);
    try {
      const response = await fetchPublicHolidays({ country: 'الكويت', year: 2026 });
      if (response.holidays) {
        setSettings({ ...settings, publicHolidays: response.holidays });
        toast({ title: t('saved') });
      }
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setFetchingHolidays(false);
    }
  };

  const updateSchedule = (scope: keyof Pick<WorkHoursSettings, 'architectural' | 'meetingRooms' | 'fieldWork'>, field: keyof DailySchedule, value: any) => {
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

  const ScheduleCard = ({ scope, title, icon: Icon, colorClass, bgClass }: { scope: keyof Pick<WorkHoursSettings, 'architectural' | 'meetingRooms' | 'fieldWork'>, title: string, icon: any, colorClass: string, bgClass: string }) => {
    const sched = settings?.[scope];
    if (!sched) return null;

    const isDoubleShift = !!sched.eveningStartTime && sched.eveningStartTime !== "00:00" && sched.eveningStartTime !== "";

    return (
      <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className={cn("border-b p-8 text-start", bgClass)}>
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-white rounded-2xl shadow-sm"><Icon className={cn("h-6 w-6", colorClass)} /></div>
                 <div>
                    <CardTitle className="text-xl font-black">{title}</CardTitle>
                    <CardDescription className="font-bold">
                       {isDoubleShift ? t('shiftDetectMsg') : t('singleShiftMsg')}
                    </CardDescription>
                 </div>
              </div>
              <Badge className={cn("rounded-lg px-4 py-1.5 font-black uppercase text-[10px]", isDoubleShift ? "bg-blue-500 text-white" : "bg-primary text-white")}>
                 {isDoubleShift ? t('doubleShift') : t('singleShift')}
              </Badge>
           </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8 text-start">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 rounded-[2rem] bg-slate-50 border-2 border-white shadow-sm space-y-4">
                 <div className="flex items-center gap-2 text-primary font-black">
                    <Sun className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-widest">{t('morningShift')}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <Label className="text-[9px] font-bold text-slate-400">{t('checkInTime')}</Label>
                       <Input type="time" value={sched.morningStartTime} onChange={e => updateSchedule(scope, 'morningStartTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold" />
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[9px] font-bold text-slate-400">{t('checkOutTime')}</Label>
                       <Input type="time" value={sched.morningEndTime} onChange={e => updateSchedule(scope, 'morningEndTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold" />
                    </div>
                 </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-blue-50/50 border-2 border-white shadow-sm space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 font-black">
                       <MoonStar className="h-4 w-4" />
                       <span className="text-[10px] uppercase tracking-widest">{t('eveningShift')}</span>
                    </div>
                    {isDoubleShift && (
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-rose-500" onClick={() => {
                          updateSchedule(scope, 'eveningStartTime', '');
                          updateSchedule(scope, 'eveningEndTime', '');
                       }}><Trash2 className="h-3 w-3" /></Button>
                    )}
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <Label className="text-[9px] font-bold text-slate-400">{t('checkInTime')}</Label>
                       <Input type="time" value={sched.eveningStartTime || ''} onChange={e => updateSchedule(scope, 'eveningStartTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold bg-white" />
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[9px] font-bold text-slate-400">{t('checkOutTime')}</Label>
                       <Input type="time" value={sched.eveningEndTime || ''} onChange={e => updateSchedule(scope, 'eveningEndTime', e.target.value)} className="h-10 rounded-lg border-2 font-bold bg-white" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                       <Zap className="h-3 w-3" /> {t('gracePeriod')}
                    </Label>
                    <Input type="number" value={sched.bufferMinutes} onChange={e => updateSchedule(scope, 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2 font-black text-lg" />
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                       <Coffee className="h-3 w-3" /> {t('restDuration')}
                    </Label>
                    <Input type="number" value={sched.restDurationMinutes || 0} onChange={e => updateSchedule(scope, 'restDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2 font-black text-lg text-blue-600" />
                 </div>
              </div>
              
              <div className="bg-amber-50 p-5 rounded-3xl border-2 border-amber-100 flex items-start gap-3">
                 <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                    {t('smartDetectHint')}
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
             {t('workHoursDesc')}
           </p>
        </div>
        <div className="flex gap-4">
           <Button 
             variant="outline"
             onClick={handleAIFetchHolidays}
             disabled={fetchingHolidays}
             className="h-16 rounded-2xl border-2 font-black gap-3 px-8 shadow-sm hover:bg-slate-50 transition-all text-blue-600"
           >
              {fetchingHolidays ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {t('fetchHolidaysAI')}
           </Button>
           <Button onClick={handleSave} disabled={saving} className="bg-primary text-white font-black rounded-2xl px-10 h-16 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all">
             {saving ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
             {t('saveAllRules')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <ScheduleCard 
           scope="architectural" 
           title={t('architecturalWorkingHours')} 
           icon={HardHat} 
           colorClass="text-primary" 
           bgClass="bg-primary/5" 
        />
        <ScheduleCard 
           scope="meetingRooms" 
           title={t('meetingRoomsWorkingHours')} 
           icon={Users} 
           colorClass="text-blue-600" 
           bgClass="bg-blue-50/50" 
        />
        <ScheduleCard 
           scope="fieldWork" 
           title={t('fieldWorkWorkingHours')} 
           icon={Zap} 
           colorClass="text-emerald-600" 
           bgClass="bg-emerald-50/50" 
        />

        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-amber-50/50 border-b p-8 text-start flex flex-row items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600"><Calendar className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">{t('holidays')}</CardTitle>
                   <CardDescription className="font-bold">{t('holidaysDesc')}</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 space-y-10 text-start">
             <div>
                <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">{t('weeklyHolidaysStatic')}</p>
                <div className="flex flex-wrap gap-3">
                   {DAYS.map(day => (
                      <div 
                        key={day} 
                        onClick={() => toggleHoliday(day)}
                        className={cn(
                          "cursor-pointer px-8 py-4 rounded-2xl border-2 font-black transition-all flex items-center gap-2",
                          settings?.holidays.includes(day) 
                            ? "bg-amber-500 text-white border-amber-500 shadow-lg scale-105" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-amber-200"
                        )}
                      >
                         <Calendar className="h-4 w-4" />
                         {t(day)}
                      </div>
                   ))}
                </div>
             </div>

             {settings?.publicHolidays && settings.publicHolidays.length > 0 && (
               <div className="pt-8 border-t">
                  <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">{t('scheduledPublicHolidays')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {settings.publicHolidays.map((ph, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-50 border-2 border-white shadow-inner flex justify-between items-center group hover:bg-emerald-50 transition-all">
                           <div className="text-start">
                              <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700">{lang === 'ar' ? ph.name : ph.nameEn}</p>
                              <p className="text-[9px] font-mono font-bold text-slate-400">{ph.date}</p>
                           </div>
                           <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                     ))}
                  </div>
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
