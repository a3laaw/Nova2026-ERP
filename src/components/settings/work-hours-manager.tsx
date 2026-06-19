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
  CalendarCheck, Plus, Flag,
  Info, Edit3, X
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
  { date: '2026-01-16', name: 'ذكرى الإسراء والمعراج', nameEn: 'Isra and Mi\'raj' },
  { date: '2026-02-25', name: 'العيد الوطني', nameEn: 'National Day' },
  { date: '2026-02-26', name: 'يوم التحرير', nameEn: 'Liberation Day' },
  { date: '2026-03-20', name: 'عيد الفطر السعيد', nameEn: 'Eid Al-Fitr' },
  { date: '2026-03-21', name: 'عيد الفطر - اليوم الثاني', nameEn: 'Eid Al-Fitr Holiday' },
  { date: '2026-03-22', name: 'عيد الفطر - اليوم الثالث', nameEn: 'Eid Al-Fitr Holiday' },
  { date: '2026-05-26', name: 'يوم وقفة عرفات', nameEn: 'Arafat Day' },
  { date: '2026-05-27', name: 'عيد الأضحى المبارك', nameEn: 'Eid Al-Adha' },
  { date: '2026-05-28', name: 'عيد الأضحى - اليوم الثاني', nameEn: 'Eid Al-Adha Holiday' },
  { date: '2026-05-29', name: 'عيد الأضحى - اليوم الثالث', nameEn: 'Eid Al-Adha Holiday' },
  { date: '2026-06-16', name: 'رأس السنة الهجرية', nameEn: 'Islamic New Year' },
  { date: '2026-08-26', name: 'ذكرى المولد النبوي الشريف', nameEn: 'Prophet\'s Birthday' },
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

  const addOrUpdateHoliday = () => {
    if (!manualHoliday.name || !manualHoliday.date) return;
    
    setSettings(prev => {
      if (!prev) return prev;
      
      let updatedHolidays = [...prev.publicHolidays];
      
      if (editingDate) {
        updatedHolidays = updatedHolidays.map(h => 
          h.date === editingDate ? { ...manualHoliday, nameEn: manualHoliday.name } : h
        );
      } else {
        const exists = updatedHolidays.some(h => h.date === manualHoliday.date);
        if (exists) {
          toast({ variant: "destructive", title: lang === 'ar' ? "التاريخ موجود مسبقاً" : "Date already exists" });
          return prev;
        }
        updatedHolidays.push({ ...manualHoliday, nameEn: manualHoliday.name });
      }

      return {
        ...prev,
        publicHolidays: updatedHolidays.sort((a, b) => a.date.localeCompare(b.date))
      };
    });

    setManualHoliday({ name: '', date: format(new Date(), 'yyyy-MM-dd') });
    setEditingDate(null);
    toast({ title: t('saved') });
  };

  const editHoliday = (holiday: PublicHoliday) => {
    setManualHoliday({ name: holiday.name, date: holiday.date });
    setEditingDate(holiday.date);
  };

  const cancelEdit = () => {
    setManualHoliday({ name: '', date: format(new Date(), 'yyyy-MM-dd') });
    setEditingDate(null);
  };

  const addSuggestedHolidays = () => {
    const existingDates = new Set(settings?.publicHolidays.map(h => h.date) || []);
    const toAdd = SUGGESTED_KUWAIT_HOLIDAYS_2026.filter(h => !existingDates.has(h.date));
    
    if (toAdd.length === 0) {
      toast({ title: lang === 'ar' ? "تمت إضافة العطلات مسبقاً" : "Already added" });
      return;
    }

    setSettings(prev => ({
      ...prev!,
      publicHolidays: [...(prev?.publicHolidays || []), ...toAdd].sort((a, b) => a.date.localeCompare(b.date))
    }));
    toast({ title: lang === 'ar' ? "تمت إضافة عطلات 2026" : "2026 holidays added" });
  };

  const removePublicHoliday = (date: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      publicHolidays: settings.publicHolidays.filter(h => h.date !== date)
    });
    if (editingDate === date) cancelEdit();
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
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('morningStart')}</Label>
                   <Input type="time" value={settings?.general.morningStartTime} onChange={e => updateSchedule('general', 'morningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('morningEnd')}</Label>
                   <Input type="time" value={settings?.general.morningEndTime} onChange={e => updateSchedule('general', 'morningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('eveningStart')}</Label>
                   <Input type="time" value={settings?.general.eveningStartTime} onChange={e => updateSchedule('general', 'eveningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('eveningEnd')}</Label>
                   <Input type="time" value={settings?.general.eveningEndTime} onChange={e => updateSchedule('general', 'eveningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('slotDuration')}</Label>
                   <Input type="number" value={settings?.general.slotDurationMinutes} onChange={e => updateSchedule('general', 'slotDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('bufferTime')}</Label>
                   <Input type="number" value={settings?.general.bufferMinutes} onChange={e => updateSchedule('general', 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
             </div>
          </CardContent>
        </Card>

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
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('morningStart')}</Label>
                   <Input type="time" value={settings?.architectural.morningStartTime} onChange={e => updateSchedule('architectural', 'morningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('morningEnd')}</Label>
                   <Input type="time" value={settings?.architectural.morningEndTime} onChange={e => updateSchedule('architectural', 'morningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('eveningStart')}</Label>
                   <Input type="time" value={settings?.architectural.eveningStartTime} onChange={e => updateSchedule('architectural', 'eveningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('eveningEnd')}</Label>
                   <Input type="time" value={settings?.architectural.eveningEndTime} onChange={e => updateSchedule('architectural', 'eveningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('slotDuration')}</Label>
                   <Input type="number" value={settings?.architectural.slotDurationMinutes} onChange={e => updateSchedule('architectural', 'slotDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('bufferTime')}</Label>
                   <Input type="number" value={settings?.architectural.bufferMinutes} onChange={e => updateSchedule('architectural', 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 lg:col-span-2">
          <CardHeader className="bg-amber-50/50 border-b p-8 text-start flex flex-row items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600"><Calendar className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">{t('holidays')}</CardTitle>
                   <CardDescription className="font-bold">{lang === 'ar' ? 'العطلات الأسبوعية والرسمية لعام 2026' : 'Weekly and 2026 public holidays'}</CardDescription>
                </div>
             </div>
             <Button 
                variant="outline" 
                onClick={addSuggestedHolidays}
                className="rounded-xl border-amber-200 text-amber-700 bg-white hover:bg-amber-50 gap-2 font-bold shadow-sm"
             >
                <Flag className="h-4 w-4" />
                {t('addKuwaitHolidays')}
             </Button>
          </CardHeader>
          <CardContent className="p-8 space-y-12 text-start">
             
             <div className="space-y-4">
                <h4 className="font-black text-sm border-s-4 border-amber-400 ps-3 uppercase tracking-tight">{lang === 'ar' ? 'العطلة الأسبوعية' : 'Weekly Holidays'}</h4>
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
                  <h4 className="font-black text-sm border-s-4 border-emerald-400 ps-3 flex items-center gap-2 uppercase tracking-tight">
                    <CalendarCheck className="h-4 w-4" /> 
                    {lang === 'ar' ? 'الأيام المغلقة (عطلات رسمية محددة)' : 'Closed Days (Official Holidays)'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className={cn(
                     "p-6 rounded-3xl border-2 border-dashed transition-all space-y-4",
                     editingDate ? "bg-primary/5 border-primary/30" : "bg-slate-50/30 border-slate-200"
                   )}>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {editingDate ? (lang === 'ar' ? 'تعديل العطلة' : 'Edit Holiday') : (lang === 'ar' ? 'إضافة عطلة جديدة' : 'Add New Holiday')}
                        </p>
                        {editingDate && (
                          <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-6 w-6 rounded-full hover:bg-white">
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Input 
                        placeholder={lang === 'ar' ? 'اسم العطلة' : 'Holiday Name'} 
                        value={manualHoliday.name} 
                        onChange={e => setManualHoliday({...manualHoliday, name: e.target.value})}
                        className="h-11 rounded-xl bg-white"
                      />
                      <SmartDateInput 
                        value={manualHoliday.date} 
                        onChange={v => setManualHoliday({...manualHoliday, date: v})}
                      />
                      <Button onClick={addOrUpdateHoliday} className="w-full h-12 rounded-xl gap-2 font-black shadow-md">
                        {editingDate ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                        {editingDate ? (lang === 'ar' ? 'تحديث البيانات' : 'Update Holiday') : (lang === 'ar' ? 'إضافة للجدول' : 'Add to Schedule')}
                      </Button>
                   </div>

                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {settings?.publicHolidays?.length === 0 ? (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50 rounded-3xl border-2 border-dashed">
                        <Info className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-xs font-bold italic">{lang === 'ar' ? 'لا توجد عطلات رسمية محددة بعد.' : 'No specific holidays defined.'}</p>
                        <p className="text-[9px] mt-1">{lang === 'ar' ? 'استخدم الزر في الأعلى لإضافة عطلات الكويت الرسمية لعام 2026.' : 'Use the button above to add 2026 Kuwait public holidays.'}</p>
                      </div>
                    ) : (
                      settings?.publicHolidays?.sort((a,b) => a.date.localeCompare(b.date)).map((ph) => (
                        <div key={ph.date} className={cn(
                          "p-4 rounded-2xl border-2 flex items-center justify-between group transition-all shadow-sm",
                          editingDate === ph.date ? "bg-primary/5 border-primary/30" : "bg-white border-slate-100 hover:border-emerald-200"
                        )}>
                          <div className="text-start">
                            <p className="font-black text-sm text-slate-800">{lang === 'ar' ? ph.name : ph.nameEn}</p>
                            <p className="text-[10px] font-mono font-bold text-emerald-600 mt-0.5">{ph.date}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => editHoliday(ph)}
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removePublicHoliday(ph.date)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/5 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
             </div>
          </CardContent>
        </Card>

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
                      <Label className="text-[10px] font-black uppercase tracking-widest">{lang === 'ar' ? 'يوم نصف الدوام' : 'Half-Day of week'}</Label>
                      <Select 
                        value={settings?.halfDay.day} 
                        onValueChange={val => setSettings({...settings!, halfDay: { ...settings!.halfDay, day: val as DayOfWeek }})}
                      >
                         <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{t(d)}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest">{t('halfDayMode')}</Label>
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
                        <Label className="text-[10px] font-black uppercase tracking-widest">{t('endTime')}</Label>
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
                      <SmartDateInput value={settings.ramadan.startDate} onChange={v => setSettings({...settings, ramadan: { ...settings.ramadan, startDate: v }})} />
                   </div>
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('periodEnd')}</Label>
                      <SmartDateInput value={settings.ramadan.endDate} onChange={v => setSettings({...settings, ramadan: { ...settings.ramadan, endDate: v }})} />
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
