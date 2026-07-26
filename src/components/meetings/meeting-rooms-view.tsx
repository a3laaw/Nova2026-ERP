'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  format, isSameDay, parseISO, addDays, subDays, parse,
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Landmark, Clock, Plus, ChevronLeft, ChevronRight, 
  Edit3, Loader2, CheckCircle2, MapPin, X, Save, 
  Trash2, Users, ShieldCheck, PlusCircle, Workflow,
  Target, Info, AlertCircle, Play, UserPlus, Briefcase
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { WorkHoursService } from '@/services/work-hours-service';
import * as WorkHoursEngine from '@/services/work-hours-engine';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { MeetingRoom, Department } from '@/types/reference';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * @fileOverview رادار حجز القاعات (Halls Radar View).
 * تم هندسته ليكون متوافقاً تماماً مع استايل الرادار المعماري.
 * الأعمدة = القاعات، الصفوف = التوقيتات.
 */
export function MeetingRoomsView() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [settings, setSettings] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  // 1. استعلام القاعات
  const roomsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.meetingRooms(companyId)), orderBy('order')) : null, 
  [db, companyId]);
  const { data: allRooms, loading: roomsLoading } = useCollection<MeetingRoom>(roomsQuery);

  // 2. استعلام المواعيد (للقاعات فقط)
  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), where('type', '==', 'hall_meeting'), orderBy('start', 'asc')) : null, 
  [db, companyId]);
  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);

  // 3. استعلام البيانات المساعدة (للحجز)
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId))) : null, [db, companyId]);
  
  const { data: departments } = useCollection<Department>(deptsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: clients } = useCollection<any>(clientsQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const filteredAppointments = useMemo(() => {
    return (rawAppointments || []).filter(a => a.status !== 'cancelled' && isSameDay(parseISO(a.start), currentDate));
  }, [rawAppointments, currentDate]);

  const timeSlots = useMemo(() => {
    if (!settings) return { morning: [], evening: [] };
    const result = WorkHoursEngine.buildDaySlots(currentDate, settings, 'meetingRooms');
    return { morning: result.morningSlots, evening: result.eveningSlots };
  }, [settings, currentDate]);

  const handleAction = (mode: 'create' | 'edit', room?: MeetingRoom, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, room, slot, appointment: appt });
    setDialogOpen(true);
  };

  if (!mounted || apptsLoading || roomsLoading || !settings) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 print:space-y-1 print:pt-0" dir={dir}>
      
      {/* 3-Day Strip Selector */}
      <div className="flex justify-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))} className="h-10 w-10 rounded-xl bg-white shadow-sm border-2 border-slate-100"><ChevronLeft className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
          <div className="flex gap-2">
            {[-1, 0, 1].map((offset) => {
              const d = addDays(currentDate, offset);
              const isActive = offset === 0;
              return (
                <Card 
                  key={offset}
                  onClick={() => setCurrentDate(d)}
                  className={cn(
                    "cursor-pointer transition-all border-2 rounded-2xl w-24 h-20 flex flex-col items-center justify-center text-center",
                    isActive ? "bg-primary border-primary shadow-xl shadow-primary/20 scale-105" : "bg-white border-slate-100 hover:border-primary/20"
                  )}
                >
                  <p className={cn("text-[9px] font-black uppercase tracking-tighter", isActive ? "text-white/70" : "text-slate-400")}>{format(d, 'EEEE', { locale: isRtl ? ar : enUS })}</p>
                  <p className={cn("text-xl font-black mt-0.5", isActive ? "text-white" : "text-slate-900")}>{format(d, 'd')}</p>
                  <p className={cn("text-[8px] font-bold uppercase", isActive ? "text-white/60" : "text-slate-400")}>{format(d, 'MMM')}</p>
                </Card>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} className="h-10 w-10 rounded-xl bg-white shadow-sm border-2 border-slate-100"><ChevronRight className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 print:gap-1">
         {[
           { label: isRtl ? 'إجمالي اجتماعات اليوم' : 'Daily Meetings', val: filteredAppointments.length, color: 'text-slate-900', b: 'border-b-slate-900' },
           { label: isRtl ? 'إشغال القاعات' : 'Room Occupancy', val: `${Math.round((filteredAppointments.length / (allRooms.length * 8)) * 100)}%`, color: 'text-blue-600', b: 'border-b-blue-400' },
           { label: isRtl ? 'قيد التنفيذ' : 'In Progress', val: filteredAppointments.filter(a => a.status === 'scheduled').length, color: 'text-orange-600', b: 'border-b-orange-500' },
           { label: isRtl ? 'قاعات مفعلة' : 'Active Halls', val: allRooms.length, color: 'text-emerald-600', b: 'border-b-emerald-500' },
         ].map((s, i) => (
           <Card key={i} className={cn("border-0 shadow-md rounded-xl bg-white border-b-4 print:shadow-none print:border-b-2", s.b)}>
              <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
                 <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{s.label}</p>
                 <h3 className={cn("text-xl print:text-xs font-black", s.color)}>{s.val}</h3>
              </CardContent>
           </Card>
         ))}
      </div>

      <div className="space-y-8 pb-10 print:pb-0 print:space-y-4">
         <HallGridSection 
           title={isRtl ? "فترة الدوام الرسمي 🏛️" : "Halls Schedule"} 
           slots={timeSlots.morning} 
           rooms={allRooms} 
           appts={filteredAppointments}
           onAction={handleAction}
           isRtl={isRtl}
           t={t}
         />
      </div>

      {dialogOpen && (
        <HallBookingDialog 
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          data={dialogData}
          companyId={companyId!}
          db={db}
          clients={clients || []}
          employees={employees || []}
          departments={departments || []}
          rooms={allRooms}
          existingAppts={rawAppointments || []}
          isRtl={isRtl}
          t={t}
        />
      )}
    </div>
  );
}

function HallGridSection({ title, slots, rooms, appts, onAction, isRtl, t }: any) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-4 print:space-y-1">
       <div className="flex items-center gap-3 px-1 print:gap-1">
          <Badge className="bg-slate-900 text-white font-black px-4 py-1 rounded-lg text-[9px] uppercase tracking-widest">{title}</Badge>
          <div className="h-[1px] flex-1 bg-slate-100" />
       </div>

       <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm print:border-0 print:shadow-none scrollbar-hide">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50/50 print:bg-white">
                   <th className="w-16 p-2 border-b border-slate-100 font-black text-[9px] text-slate-400 uppercase tracking-tighter bg-slate-50/50 print:p-1 print:w-10">Time</th>
                   {rooms.map((room: MeetingRoom) => (
                      <th key={room.id} className="p-3 border-b border-slate-100 border-s border-s-slate-50 min-w-[180px] print:p-1 print:min-w-[120px]">
                         <div className="flex flex-col items-center text-center">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2 shrink-0"><Landmark className="h-4 w-4" /></div>
                            <span className="font-black text-slate-800 text-[11px] leading-none block truncate">{isRtl ? room.name : room.nameEn}</span>
                         </div>
                      </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string) => (
                  <tr key={slot} className="group/row">
                     <td className="p-3 text-center border-b border-slate-50 border-e border-e-slate-50 font-mono font-black text-slate-300 text-[10px] bg-slate-50/20">{slot}</td>
                     {rooms.map((room: MeetingRoom) => {
                        const appt = appts.find((a: any) => {
                           const start = format(parseISO(a.start), 'HH:mm');
                           return start === slot && a.hallId === room.id;
                        });

                        if (appt) {
                           return (
                             <td key={room.id} className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 align-top">
                                <Card 
                                  className={cn(
                                    "p-1.5 rounded-lg h-full transition-all cursor-pointer min-h-[44px] border-2",
                                    appt.status === 'completed' ? "bg-emerald-50/50 border-emerald-500/20" : "bg-white shadow-sm"
                                  )}
                                  style={{ borderInlineStartColor: appt.departmentColor || '#FFA000', borderInlineStartWidth: '6px' }}
                                >
                                   <div className="text-start space-y-0.5">
                                      <p className="font-black text-[9px] leading-tight truncate text-slate-900">{appt.clientName}</p>
                                      <div className="flex items-center gap-1 text-[7px] font-bold text-slate-400">
                                         <Users className="h-2.5 w-2.5" /> {appt.engineerName}
                                         {(appt.additionalEngineerNames?.length || 0) > 0 && <span>+ {appt.additionalEngineerNames.length}</span>}
                                      </div>
                                   </div>
                                </Card>
                             </td>
                           );
                        }
                        return (
                          <td 
                            key={room.id} 
                            onClick={() => onAction('create', room, slot)}
                            className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 group-hover/row:bg-primary/[0.02] cursor-pointer"
                          >
                             <div className="h-6 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <Plus className="h-3 w-3 text-primary/30" />
                             </div>
                          </td>
                        );
                     })}
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function HallBookingDialog({ isOpen, onClose, data, companyId, db, clients, employees, departments, rooms, existingAppts, isRtl, t }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '', clientId: '', clientName: '', departmentId: '', departmentName: '', departmentColor: '',
    engineerId: '', engineerName: '', additionalEngineerIds: [] as string[],
    date: '', time: '', notes: ''
  });

  useEffect(() => {
    if (isOpen && data) {
       setFormData(prev => ({
         ...prev,
         date: format(new Date(), 'yyyy-MM-dd'),
         time: data.slot || '08:00',
         engineerId: '', additionalEngineerIds: [],
         clientId: '', departmentId: ''
       }));
    }
  }, [isOpen, data]);

  const handleSave = async () => {
    if (!db || !companyId || !formData.clientId || !formData.engineerId) return;

    // --- نظام التحقق الثلاثي السيادي ---
    const start = new Date(`${formData.date}T${formData.time}:00`).toISOString();
    
    // 1. فحص القاعة
    const hallBusy = existingAppts.some((a: any) => a.hallId === data.room.id && a.start === start && a.status !== 'cancelled');
    if (hallBusy) return toast({ variant: "destructive", title: isRtl ? "القاعة مشغولة في هذا الوقت" : "Hall Busy" });

    // 2. فحص العميل
    const clientBusy = existingAppts.some((a: any) => a.clientId === formData.clientId && a.start === start && a.status !== 'cancelled');
    if (clientBusy) return toast({ variant: "destructive", title: isRtl ? "العميل لديه موعد آخر في نفس الوقت" : "Client Busy" });

    // 3. فحص المهندس الرئيسي والمهندسين الإضافيين
    const allEngIds = [formData.engineerId, ...formData.additionalEngineerIds];
    const engBusy = existingAppts.some((a: any) => {
       if (a.start !== start || a.status === 'cancelled') return false;
       return allEngIds.includes(a.engineerId) || (a.additionalEngineerIds || []).some((id: string) => allEngIds.includes(id));
    });
    if (engBusy) return toast({ variant: "destructive", title: isRtl ? "أحد المهندسين لديه موعد متعارض" : "Engineer Busy" });

    setLoading(true);
    try {
      const client = clients.find((c: any) => c.id === formData.clientId);
      const dept = departments.find((d: any) => d.id === formData.departmentId);
      const eng = employees.find((e: any) => e.id === formData.engineerId);
      const addEngNames = formData.additionalEngineerIds.map(id => employees.find((e: any) => e.id === id)?.fullName || '');

      const payload: Partial<Appointment> = {
        companyId,
        type: 'hall_meeting',
        status: 'scheduled',
        start,
        title: formData.title || (isRtl ? 'اجتماع فني' : 'Professional Meeting'),
        hallId: data.room.id,
        hallName: data.room.name,
        clientId: formData.clientId,
        clientName: client?.nameAr || '',
        departmentId: formData.departmentId,
        departmentName: dept?.name || '',
        departmentColor: dept?.color || '#FFA000',
        engineerId: formData.engineerId,
        engineerName: eng?.fullName || '',
        additionalEngineerIds: formData.additionalEngineerIds,
        additionalEngineerNames: addEngNames,
        notes: formData.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, paths.appointments(companyId)), payload);
      toast({ title: t('saved') });
      onClose();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl text-start" dir={dir}>
        <div className="bg-slate-50 p-8 border-b flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm"><Landmark className="h-6 w-6" /></div>
              <div>
                 <DialogTitle className="text-2xl font-black font-headline">{isRtl ? 'حجز قاعة اجتماع' : 'Room Booking'}</DialogTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRtl ? `القاعة: ${data.room.name}` : `Room: ${data.room.nameEn}`}</p>
              </div>
           </div>
           <Badge className="bg-slate-900 text-white font-black h-8 px-4 rounded-xl text-lg">{formData.time}</Badge>
        </div>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'العميل المالك' : 'Client'}</Label>
                 <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {clients.map((c: any) => <SelectItem key={c.id} value={c.id} className="font-bold">{c.nameAr}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'القسم المختص (لتحديد اللون)' : 'Department (Coloring)'}</Label>
                 <Select value={formData.departmentId} onValueChange={v => setFormData({...formData, departmentId: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {departments.map((d: any) => (
                         <SelectItem key={d.id} value={d.id} className="font-bold">
                            <div className="flex items-center gap-2">
                               <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color || '#ccc' }} />
                               {isRtl ? d.name : d.nameEn}
                            </div>
                         </SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
           </div>

           <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-6">
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-primary flex items-center gap-2"><Briefcase className="h-4 w-4" /> {isRtl ? 'المهندس المسؤول عن الاجتماع' : 'Lead Engineer'}</Label>
                 <Select value={formData.engineerId} onValueChange={v => setFormData({...formData, engineerId: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {employees.map((e: any) => <SelectItem key={e.id} value={e.id} className="font-bold">{e.fullName}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>

              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'مهندسين مشاركين (ورشة عمل)' : 'Co-Engineers (Workshop)'}</Label>
                 <ScrollArea className="h-32 rounded-xl bg-white border-2 p-3 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {employees.filter((e: any) => e.id !== formData.engineerId).map((e: any) => (
                         <div key={e.id} className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox 
                              id={`eng-${e.id}`} 
                              checked={formData.additionalEngineerIds.includes(e.id)}
                              onCheckedChange={(checked) => {
                                 const ids = checked 
                                   ? [...formData.additionalEngineerIds, e.id]
                                   : formData.additionalEngineerIds.filter(id => id !== e.id);
                                 setFormData({...formData, additionalEngineerIds: ids});
                              }}
                            />
                            <label htmlFor={`eng-${e.id}`} className="text-[10px] font-bold cursor-pointer">{e.fullName}</label>
                         </div>
                       ))}
                    </div>
                 </ScrollArea>
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات الاجتماع' : 'Meeting Agenda / Notes'}</Label>
              <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
           <Button variant="outline" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 font-black">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading || !formData.clientId || !formData.engineerId} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 border-b-8 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
              {isRtl ? 'تأكيد الحجز السيادي' : 'Confirm Sovereign Booking'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
