
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, Calendar, MoonStar, 
  Loader2, Save, Sun, HardHat,
  Coffee, Utensils, Sparkles, Trash2,
  CalendarCheck, Plus, Flag
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { WorkHoursService } from '@/services/work-hours-service';
import { WorkHoursSettings, DayOfWeek, DailySchedule, PublicHoliday } from '@/types/work-hours';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// قائمة العطلات الرسمية المتوقعة في الكويت
const SUGGESTED_KUWAIT_HOLIDAYS: PublicHoliday[] = [
  { date: `${new Date().getFullYear()}-01-01`, name: 'رأس السنة الميلادية', nameEn: 'New Year' },
  { date: `${new Date().getFullYear()}-02-25`, name: 'العيد الوطني', nameEn: 'National Day' },
  { date: `${new Date().getFullYear()}-02-26`, name: 'عيد التحرير', nameEn: 'Liberation Day' },
];

export function WorkHoursManager() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, lang } = useLanguage();
  const db = useFirestore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);

  // حالة لإضافة عطلة يدوية
  const [manualHoliday, setManualHoliday] = useState({ name: '', date: format(new Date(), 'yyyy-MM-dd') });

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

  const addManualHoliday = () => {
    if (!manualHoliday.name || !manualHoliday.date) return;
    const exists = settings?.publicHolidays.some(h => h.date === manualHoliday.date);
    if (exists) {
      toast({ variant: "destructive", title: lang === 'ar' ? "التاريخ موجود مسبقاً" : "Date already exists" });
      return;
    }
    setSettings(prev => ({
      ...prev!,
      publicHolidays: [...(prev?.publicHolidays || []), { ...manualHoliday, nameEn: manualHoliday.name }]
    }));
    setManualHoliday({ name: '', date: format(new Date(), 'yyyy-MM-dd') });
  };

  const addSuggestedHolidays = () => {
    const existingDates = new Set(settings?.publicHolidays.map(h => h.date) || []);
    const toAdd = SUGGESTED_KUWAIT_HOLIDAYS.filter(h => !existingDates.has(h.date));
    
    if (toAdd.length === 0) {
      toast({ title: lang === 'ar' ? "تمت إضافة العطلات مسبقاً" : "Already added" });
      return;
    }

    setSettings(prev => ({
      ...prev!,
      publicHolidays: [...(prev?.publicHolidays || []), ...toAdd]
    }));
    toast({ title: lang === 'ar' ? "تمت إضافة العطلات الرسمية" : "Suggested holidays added" });
  };

  const removePublicHoliday = (date: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      publicHolidays: settings.publicHolidays.filter(h => h.date !== date)
    });
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
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          {saving ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
          {t('saveAllRules')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* General working hours card omitted for brevity but preserved in full logic */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-primary/5 border-b p-8 text-start">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-primary"><Sun className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">{t('generalWorkingHours')}</CardTitle>
                   <CardDescription className="font-bold">{lang === 'ar' ? 'قواعد العمل الافتراضية لكافة الأقسام.' : 'Default rules for all departments.'}</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6 text-start">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">{t('morningStart')}</Label>
                   <Input type="time" value={settings?.general.morningStartTime} onChange={e => updateSchedule('general', 'morningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">{t('morningEnd')}</Label>
                   <Input type="time" value={settings?.general.morningEndTime} onChange={e => updateSchedule('general', 'morningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">{t('eveningStart')}</Label>
                   <Input type="time" value={settings?.general.eveningStartTime} onChange={e => updateSchedule('general', 'eveningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">{t('eveningEnd')}</Label>
                   <Input type="time" value={settings?.general.eveningEndTime} onChange={e => updateSchedule('general', 'eveningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('slotDuration')}</Label>
                   <Input type="number" value={settings?.general.slotDurationMinutes} onChange={e => updateSchedule('general', 'slotDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('bufferTime')}</Label>
                   <Input type="number" value={settings?.general.bufferMinutes} onChange={e => updateSchedule('general', 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Architectural working hours card omitted for brevity but preserved in full logic */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-blue-50/50 border-b p-8 text-start">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600"><HardHat className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">{t('architecturalWorkingHours')}</CardTitle>
                   <CardDescription className="font-bold">{lang === 'ar' ? 'قواعد خاصة بالمهندسين المعماريين والمصممين.' : 'Special rules for architects and designers.'}</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6 text-start">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('morningStart')}</Label>
                   <Input type="time" value={settings?.architectural.morningStartTime} onChange={e => updateSchedule('architectural', 'morningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('morningEnd')}</Label>
                   <Input type="time" value={settings?.architectural.morningEndTime} onChange={e => updateSchedule('architectural', 'morningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('eveningStart')}</Label>
                   <Input type="time" value={settings?.architectural.eveningStartTime} onChange={e => updateSchedule('architectural', 'eveningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('eveningEnd')}</Label>
                   <Input type="time" value={settings?.architectural.eveningEndTime} onChange={e => updateSchedule('architectural', 'eveningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('slotDuration')}</Label>
                   <Input type="number" value={settings?.architectural.slotDurationMinutes} onChange={e => updateSchedule('architectural', 'slotDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">{t('bufferTime')}</Label>
                   <Input type="number" value={settings?.architectural.bufferMinutes} onChange={e => updateSchedule('architectural', 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Holidays Section */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 lg:col-span-2">
          <CardHeader className="bg-amber-50/50 border-b p-8 text-start flex flex-row items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600"><Calendar className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">{t('holidays')}</CardTitle>
                   <CardDescription className="font-bold">{lang === 'ar' ? 'العطلات الأسبوعية والرسمية' : 'Weekly and public holidays'}</CardDescription>
                </div>
             </div>
             <Button 
                variant="outline" 
                onClick={addSuggestedHolidays}
                className="rounded-xl border-amber-200 text-amber-700 bg-white hover:bg-amber-50 gap-2 font-bold"
             >
                <Flag className="h-4 w-4" />
                {lang === 'ar' ? 'إضافة عطلات الكويت الرسمية' : 'Add Kuwait Public Holidays'}
             </Button>
          </CardHeader>
          <CardContent className="p-8 space-y-12 text-start">
             
             <div className="space-y-4">
                <h4 className="font-black text-sm border-s-4 border-amber-400 ps-3">{t('holidays')} (Weekly)</h4>
                <div className="flex flex-wrap gap-3">
                   {DAYS.map(day => (
                      <div 
                        key={day} 
                        onClick={() => toggleHoliday(day)}
                        className={cn(
                          "cursor-pointer px-5 py-3 rounded-2xl border-2 font-black transition-all",
                          settings?.holidays.includes(day) 
                            ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200 scale-105" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-amber-200"
                        )}
                      >
                         {t(day)}
                      </div>
                   ))}
                </div>
             </div>

             <div className="space-y-6 pt-8 border-t">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-sm border-s-4 border-emerald-400 ps-3 flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4" /> 
                    {lang === 'ar' ? 'العطلات الرسمية المحددة' : 'Specific Public Holidays'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {/* فورم الإضافة اليدوية */}
                   <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-3">
                      <Input 
                        placeholder={lang === 'ar' ? 'اسم العطلة' : 'Holiday Name'} 
                        value={manualHoliday.name} 
                        onChange={e => setManualHoliday({...manualHoliday, name: e.target.value})}
                        className="h-10 rounded-xl"
                      />
                      <Input 
                        type="date" 
                        value={manualHoliday.date} 
                        onChange={e => setManualHoliday({...manualHoliday, date: e.target.value})}
                        className="h-10 rounded-xl"
                      />
                      <Button onClick={addManualHoliday} className="w-full h-10 rounded-xl gap-2 font-bold">
                        <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة يدوية' : 'Add Manual'}
                      </Button>
                   </div>

                  {settings?.publicHolidays?.length === 0 ? (
                    <div className="md:col-span-2 flex items-center justify-center italic text-muted-foreground text-xs">
                      {lang === 'ar' ? 'لا توجد عطلات محددة.' : 'No holidays defined.'}
                    </div>
                  ) : (
                    settings?.publicHolidays?.map((ph) => (
                      <div key={ph.date} className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-between group h-fit">
                        <div className="text-start">
                          <p className="font-black text-sm text-slate-800">{lang === 'ar' ? ph.name : ph.nameEn}</p>
                          <p className="text-[10px] font-mono text-slate-400">{ph.date}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removePublicHoliday(ph.date)}
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Half-Day and Ramadan Sections remain with full logic as per previous turns */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 lg:col-span-2">
          <CardHeader className="bg-blue-50/50 border-b p-8 text-start">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600"><Calendar className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">{t('halfDay')}</CardTitle>
                   <CardDescription className="font-bold">{lang === 'ar' ? 'نظام العمل في أيام الدوام القصيرة.' : 'Working policy for short days.'}</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 text-start">
             <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs font-black">{lang === 'ar' ? 'يوم نصف الدوام' : 'Half-Day of week'}</Label>
                      <Select 
                        value={settings?.halfDay.day} 
                        onValueChange={val => setSettings({...settings!, halfDay: { ...settings!.halfDay, day: val as DayOfWeek }})}
                      >
                         <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{t(d)}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black">{t('halfDayMode')}</Label>
                      <Select 
                        value={settings?.halfDay.mode} 
                        onValueChange={val => setSettings({...settings!, halfDay: { ...settings!.halfDay, mode: val as any }})}
                      >
                         <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="morning_only">{t('morningOnly')}</SelectItem>
                            <SelectItem value="custom_end_time">{t('customEndTime')}</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   {settings?.halfDay.mode === 'custom_end_time' && (
                     <div className="space-y-2 animate-in slide-in-from-top-2">
                        <Label className="text-xs font-black">{t('endTime')}</Label>
                        <Input type="time" value={settings?.halfDay.endTime} onChange={e => setSettings({...settings!, halfDay: { ...settings!.halfDay, endTime: e.target.value }})} className="h-12 rounded-xl border-2" />
                     </div>
                   )}
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden lg:col-span-2 ring-1 ring-black/5">
          <CardHeader className="bg-purple-50/50 border-b p-8 text-start">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-white rounded-2xl shadow-sm text-purple-600"><MoonStar className="h-6 w-6" /></div>
                   <div>
                      <CardTitle className="text-xl font-black">{t('ramadanSchedule')}</CardTitle>
                      <CardDescription className="font-bold text-slate-500">{t('ramadanPeriod')}</CardDescription>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black uppercase text-slate-400">{t('enabled')}</span>
                  <Switch 
                    checked={settings?.ramadan.enabled} 
                    onCheckedChange={val => setSettings({...settings!, ramadan: { ...settings!.ramadan, enabled: val }})} 
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
             </div>
          </CardHeader>
          
          {settings?.ramadan.enabled && (
             <CardContent className="p-10 space-y-10 text-start animate-in fade-in zoom-in-95 duration-500">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('periodStart')}</Label>
                      <Input type="date" value={settings.ramadan.startDate} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, startDate: e.target.value }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-lg font-black" />
                   </div>
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('periodEnd')}</Label>
                      <Input type="date" value={settings.ramadan.endDate} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, endDate: e.target.value }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-lg font-black" />
                   </div>
                </div>

                <div className="h-[1px] bg-slate-100 w-full" />

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('ramadanMode')}</Label>
                  <Tabs 
                    value={settings.ramadan.mode} 
                    onValueChange={(val: any) => setSettings({...settings, ramadan: { ...settings.ramadan, mode: val }})}
                    className="w-full md:w-[400px]"
                  >
                    <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-2xl h-14 border border-slate-200">
                      <TabsTrigger value="single" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">{t('singleShift')}</TabsTrigger>
                      <TabsTrigger value="double" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">{t('doubleShift')}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-6">
                      <div className="flex items-center gap-3 text-purple-600">
                         <Coffee className="h-5 w-5" />
                         <span className="font-black text-sm uppercase tracking-widest">{t('morningStart')} / {t('morningEnd')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <Input type="time" value={settings.ramadan.morningStartTime} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, morningStartTime: e.target.value }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-lg font-black text-center" />
                         <Input type="time" value={settings.ramadan.morningEndTime} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, morningEndTime: e.target.value }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-lg font-black text-center" />
                      </div>
                   </div>

                   <div className={cn("space-y-6 transition-all duration-500", settings.ramadan.mode === 'single' ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100')}>
                      <div className="flex items-center gap-3 text-purple-600">
                         <Utensils className="h-5 w-5" />
                         <span className="font-black text-sm uppercase tracking-widest">{t('eveningStart')} / {t('eveningEnd')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <Input type="time" value={settings.ramadan.eveningStartTime} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, eveningStartTime: e.target.value }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-lg font-black text-center" />
                         <Input type="time" value={settings.ramadan.eveningEndTime} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, eveningEndTime: e.target.value }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-lg font-black text-center" />
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-slate-100">
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('slotDuration')}</Label>
                      <Input type="number" value={settings.ramadan.slotDurationMinutes} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, slotDurationMinutes: Number(e.target.value) }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-xl font-black" />
                   </div>
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('bufferTime')}</Label>
                      <Input type="number" value={settings.ramadan.bufferMinutes} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, bufferMinutes: Number(e.target.value) }})} className="h-14 rounded-2xl bg-slate-50 border-slate-100 text-slate-900 text-xl font-black" />
                   </div>
                </div>

                <div className="flex items-center gap-4 p-6 bg-purple-50 rounded-[2rem] border border-purple-100">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[11px] font-bold text-purple-800 leading-relaxed">
                     {lang === 'ar' ? 'ملاحظة: تفعيل نظام رمضان يلغي كافة جداول العمل العادية للقسمين العام والمعماري خلال الفترة المحددة أعلاه.' : 'Note: Activating Ramadan schedule overrides all regular working hours for both general and architectural depts during the specified dates.'}
                   </p>
                </div>
             </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}
