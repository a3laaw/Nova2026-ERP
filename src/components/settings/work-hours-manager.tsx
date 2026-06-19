'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, Calendar, Coffee, MoonStar, 
  Loader2, Save, AlertCircle, Info,
  Sun, Sunset, HardHat
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { WorkHoursService } from '@/services/work-hours-service';
import { WorkHoursSettings, DayOfWeek, DailySchedule } from '@/types/work-hours';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WorkHoursManager() {
  const { globalUser, user } = useAuthContext();
  const db = useFirestore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);

  const service = useMemo(() => 
    db && globalUser?.companyId ? new WorkHoursService(db, globalUser.companyId) : null, 
  [db, globalUser]);

  useEffect(() => {
    async function load() {
      if (!service) return;
      try {
        const data = await service.getSettings();
        setSettings(data || { ...service.getDefaultSettings(), companyId: globalUser!.companyId });
      } catch (e) {
        toast({ variant: "destructive", title: "Error loading settings" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [service, globalUser]);

  const handleSave = async () => {
    if (!service || !settings || !user) return;
    setSaving(true);
    try {
      await service.saveSettings(settings, user.uid);
      toast({ title: "تم الحفظ بنجاح", description: "تم تحديث قواعد مواعيد العمل الرسمية." });
    } catch (e) {
      toast({ variant: "destructive", title: "فشل الحفظ", description: "يرجى المحاولة لاحقاً." });
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3">
             <Clock className="h-8 w-8 text-primary" />
             مواعيد العمل الرسمية
           </h1>
           <p className="text-muted-foreground font-bold text-sm mt-1 opacity-80">
             إدارة الدوام العام، القسم المعماري، وعطلات نهاية الأسبوع.
           </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-primary text-white font-black px-8 py-6 rounded-2xl text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          {saving ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
          حفظ كافة القواعد
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* General Working Hours */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-primary/5 border-b p-8 text-start">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-primary"><Sun className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">الدوام العام</CardTitle>
                   <CardDescription className="font-bold">قواعد العمل الافتراضية لكافة الأقسام.</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6 text-start">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">بداية الصباح</Label>
                   <Input type="time" value={settings?.general.morningStartTime} onChange={e => updateSchedule('general', 'morningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">نهاية الصباح</Label>
                   <Input type="time" value={settings?.general.morningEndTime} onChange={e => updateSchedule('general', 'morningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">بداية المساء</Label>
                   <Input type="time" value={settings?.general.eveningStartTime} onChange={e => updateSchedule('general', 'eveningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-muted-foreground">نهاية المساء</Label>
                   <Input type="time" value={settings?.general.eveningEndTime} onChange={e => updateSchedule('general', 'eveningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">مدة الموعد (دقيقة)</Label>
                   <Input type="number" value={settings?.general.slotDurationMinutes} onChange={e => updateSchedule('general', 'slotDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">الفاصل/Buffer (دقيقة)</Label>
                   <Input type="number" value={settings?.general.bufferMinutes} onChange={e => updateSchedule('general', 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Architectural Working Hours */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-blue-50/50 border-b p-8 text-start">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600"><HardHat className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">القسم المعماري</CardTitle>
                   <CardDescription className="font-bold">قواعد خاصة بالمهندسين المعماريين والمصممين.</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6 text-start">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">بداية الصباح</Label>
                   <Input type="time" value={settings?.architectural.morningStartTime} onChange={e => updateSchedule('architectural', 'morningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">نهاية الصباح</Label>
                   <Input type="time" value={settings?.architectural.morningEndTime} onChange={e => updateSchedule('architectural', 'morningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">بداية المساء</Label>
                   <Input type="time" value={settings?.architectural.eveningStartTime} onChange={e => updateSchedule('architectural', 'eveningStartTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">نهاية المساء</Label>
                   <Input type="time" value={settings?.architectural.eveningEndTime} onChange={e => updateSchedule('architectural', 'eveningEndTime', e.target.value)} className="h-12 rounded-xl border-2" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">مدة الموعد (دقيقة)</Label>
                   <Input type="number" value={settings?.architectural.slotDurationMinutes} onChange={e => updateSchedule('architectural', 'slotDurationMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black text-muted-foreground">الفاصل/Buffer (دقيقة)</Label>
                   <Input type="number" value={settings?.architectural.bufferMinutes} onChange={e => updateSchedule('architectural', 'bufferMinutes', Number(e.target.value))} className="h-12 rounded-xl border-2" />
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Holidays & Half-Day */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 lg:col-span-2">
          <CardHeader className="bg-amber-50/50 border-b p-8 text-start">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600"><Calendar className="h-6 w-6" /></div>
                <div>
                   <CardTitle className="text-xl font-black">العطلات ونظام نصف الدوام</CardTitle>
                   <CardDescription className="font-bold">تحديد أيام الإغلاق التام وأيام العمل القصيرة.</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 text-start">
             
             {/* Weekly Holidays */}
             <div className="space-y-4">
                <h4 className="font-black text-sm border-s-4 border-amber-400 ps-3">العطلات الأسبوعية</h4>
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
                         {day}
                      </div>
                   ))}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold">* الأيام المحددة سيتم إغلاق الحجوزات فيها تماماً.</p>
             </div>

             {/* Half-Day Logic */}
             <div className="space-y-6 border-r md:ps-12 border-slate-100">
                <h4 className="font-black text-sm border-s-4 border-blue-400 ps-3">نظام نصف الدوام</h4>
                <div className="grid grid-cols-1 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs font-black">يوم نصف الدوام</Label>
                      <Select 
                        value={settings?.halfDay.day} 
                        onValueChange={val => setSettings({...settings!, halfDay: { ...settings!.halfDay, day: val as DayOfWeek }})}
                      >
                         <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="اختر اليوم" /></SelectTrigger>
                         <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black">طريقة العمل</Label>
                      <Select 
                        value={settings?.halfDay.mode} 
                        onValueChange={val => setSettings({...settings!, halfDay: { ...settings!.halfDay, mode: val as any }})}
                      >
                         <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="morning_only">فترة صباحية فقط (إلغاء المساء)</SelectItem>
                            <SelectItem value="custom_end_time">وقت إغلاق مخصص</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   {settings?.halfDay.mode === 'custom_end_time' && (
                     <div className="space-y-2 animate-in slide-in-from-top-2">
                        <Label className="text-xs font-black">وقت الإغلاق النهائي</Label>
                        <Input type="time" value={settings?.halfDay.endTime} onChange={e => setSettings({...settings!, halfDay: { ...settings!.halfDay, endTime: e.target.value }})} className="h-12 rounded-xl border-2" />
                     </div>
                   )}
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Ramadan Schedule */}
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-indigo-900 text-white overflow-hidden lg:col-span-2">
          <CardHeader className="bg-white/5 border-b p-8 text-start">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-white/10 rounded-2xl shadow-sm text-indigo-200"><MoonStar className="h-6 w-6" /></div>
                   <div>
                      <CardTitle className="text-xl font-black">جدول شهر رمضان المبارك</CardTitle>
                      <CardDescription className="font-bold text-indigo-200/60">تفعيل مواعيد استثنائية خلال الشهر الفضيل.</CardDescription>
                   </div>
                </div>
                <Switch 
                  checked={settings?.ramadan.enabled} 
                  onCheckedChange={val => setSettings({...settings!, ramadan: { ...settings!.ramadan, enabled: val }})} 
                  className="data-[state=checked]:bg-emerald-500"
                />
             </div>
          </CardHeader>
          {settings?.ramadan.enabled && (
             <CardContent className="p-8 space-y-8 text-start animate-in fade-in zoom-in-95">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs font-black opacity-70">بداية الفترة</Label>
                      <Input type="date" value={settings.ramadan.startDate} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, startDate: e.target.value }})} className="h-12 rounded-xl bg-white/10 border-white/10 text-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black opacity-70">نهاية الفترة</Label>
                      <Input type="date" value={settings.ramadan.endDate} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, endDate: e.target.value }})} className="h-12 rounded-xl bg-white/10 border-white/10 text-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black opacity-70">بداية الدوام</Label>
                      <Input type="time" value={settings.ramadan.startTime} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, startTime: e.target.value }})} className="h-12 rounded-xl bg-white/10 border-white/10 text-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black opacity-70">نهاية الدوام</Label>
                      <Input type="time" value={settings.ramadan.endTime} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, endTime: e.target.value }})} className="h-12 rounded-xl bg-white/10 border-white/10 text-white" />
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/10">
                   <div className="space-y-2">
                      <Label className="text-xs font-black opacity-70">مدة الموعد</Label>
                      <Input type="number" value={settings.ramadan.slotDurationMinutes} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, slotDurationMinutes: Number(e.target.value) }})} className="h-12 rounded-xl bg-white/10 border-white/10 text-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black opacity-70">الفاصل/Buffer</Label>
                      <Input type="number" value={settings.ramadan.bufferMinutes} onChange={e => setSettings({...settings, ramadan: { ...settings.ramadan, bufferMinutes: Number(e.target.value) }})} className="h-12 rounded-xl bg-white/10 border-white/10 text-white" />
                   </div>
                   <div className="flex items-center gap-3 md:pt-6">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[10px] font-bold opacity-60">مواعيد رمضان تلغي كافة الجداول العادية خلال الفترة المحددة.</p>
                   </div>
                </div>
             </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}
