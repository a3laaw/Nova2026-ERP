
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  parse, 
  format, 
  isValid, 
  addMinutes, 
  startOfDay, 
  isSameDay, 
  parseISO, 
  setHours, 
  setMinutes 
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  CalendarDays, 
  Clock, 
  UserCircle, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  MoreVertical,
  Edit3,
  Trash2,
  XCircle,
  Loader2,
  CheckCircle2,
  MapPin,
  Info,
  Calendar as CalendarIcon,
  Search,
  HardHat,
  Save,
  Navigation
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { WorkHoursService } from '@/services/work-hours-service';
import { AppointmentService } from '@/services/appointment-service';
import { Appointment, AppointmentType } from '@/types/appointment';
import { Client } from '@/types/client';
import { Employee } from '@/types/hr';
import { DayOfWeek, WorkHoursSettings } from '@/types/work-hours';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Helpers ---
const weekDays: { id: DayOfWeek; labelAr: string; labelEn: string }[] = [
  { id: 'Sunday', labelAr: 'الأحد', labelEn: 'Sunday' },
  { id: 'Monday', labelAr: 'الاثنين', labelEn: 'Monday' },
  { id: 'Tuesday', labelAr: 'الثلاثاء', labelEn: 'Tuesday' },
  { id: 'Wednesday', labelAr: 'الأربعاء', labelEn: 'Wednesday' },
  { id: 'Thursday', labelAr: 'الخميس', labelEn: 'Thursday' },
  { id: 'Friday', labelAr: 'الجمعة', labelEn: 'Friday' },
  { id: 'Saturday', labelAr: 'السبت', labelEn: 'Saturday' },
];

function getVisitColor(visitCount: number, status?: string): string {
  if (visitCount === 1) return '#facc15'; // Yellow: First Visit
  if (visitCount > 1 && status !== 'contracted') return '#22c55e'; // Green: Follow-up
  if (visitCount > 1 && status === 'contracted') return '#3b82f6'; // Blue: Contracted
  return '#9ca3af'; // Gray: Default
}

function cardGradient(color: string) {
  if (color === '#facc15') return "bg-yellow-50 border-yellow-200 text-yellow-900 shadow-yellow-100/50";
  if (color === '#22c55e') return "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100/50";
  if (color === '#3b82f6') return "bg-blue-50 border-blue-200 text-blue-900 shadow-blue-100/50";
  return "bg-slate-50 border-slate-200 text-slate-900 shadow-slate-100/50";
}

function generateTimeSlots(s: string, e: string, dur: number, buf: number): string[] {
  if (!s || !e || !dur || dur <= 0) return [];
  const slots: string[] = [];
  const st = parse(s, 'HH:mm', new Date());
  const et = parse(e, 'HH:mm', new Date());
  if (!isValid(st) || !isValid(et) || st >= et) return [];
  let cur = st;
  while (cur < et) {
    const end = addMinutes(cur, dur);
    if (end > et) break;
    slots.push(format(cur, 'HH:mm'));
    cur = addMinutes(end, buf);
  }
  return slots;
}

type ApptMeta = { visitCount: number; status: string; color: string };

function computeMeta(list: Appointment[], clients: Map<string, Client>): Map<string, ApptMeta> {
  const byClient = new Map<string, Appointment[]>();
  list.forEach(a => {
    if (!a.clientId || !a.id) return;
    const arr = byClient.get(a.clientId) || [];
    arr.push(a);
    byClient.set(a.clientId, arr);
  });
  const out = new Map<string, ApptMeta>();
  byClient.forEach((arr, cid) => {
    const sorted = [...arr].sort((x, y) => (x.start || '').localeCompare(y.start || ''));
    const clientStatus = clients.get(cid)?.status || 'new';
    sorted.forEach((a, i) => {
      const vc = i + 1;
      out.set(a.id!, { visitCount: vc, status: clientStatus, color: getVisitColor(vc, clientStatus) });
    });
  });
  return out;
}

export function ArchitecturalAppointmentsView() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, isRtl, t } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  // --- State ---
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ mode: 'create' | 'edit'; appointment?: Appointment; slot?: string; engineer?: Employee } | null>(null);

  // --- Data Fetching ---
  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start')) : null, 
  [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);
  const { data: allEmployees, loading: empsLoading } = useCollection<Employee>(empsQuery);
  const { data: allClients, loading: clientsLoading } = useCollection<Client>(clientsQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  // --- Computations ---
  const engineers = useMemo(() => {
    return allEmployees.filter(e => e.departmentName?.includes('معماري') || e.departmentName?.includes('Arch'));
  }, [allEmployees]);

  const clientsMap = useMemo(() => {
    const m = new Map<string, Client>();
    allClients.forEach(c => { if (c.id) m.set(c.id, c); });
    return m;
  }, [allClients]);

  const filteredAppointments = useMemo(() => {
    return rawAppointments.filter(a => a.status !== 'cancelled' && isSameDay(parseISO(a.start), currentDate));
  }, [rawAppointments, currentDate]);

  const apptMeta = useMemo(() => computeMeta(rawAppointments, clientsMap), [rawAppointments, clientsMap]);

  const stats = useMemo(() => {
    const res = { total: filteredAppointments.length, yellow: 0, green: 0, blue: 0 };
    filteredAppointments.forEach(a => {
      const m = apptMeta.get(a.id!);
      if (m?.color === '#facc15') res.yellow++;
      else if (m?.color === '#22c55e') res.green++;
      else if (m?.color === '#3b82f6') res.blue++;
    });
    return res;
  }, [filteredAppointments, apptMeta]);

  const timeSlots = useMemo(() => {
    if (!settings) return { morning: [], evening: [] };
    const dow = format(currentDate, 'EEEE') as DayOfWeek;
    if (settings.holidays.includes(dow)) return { morning: [], evening: [] };

    const arch = settings.architectural;
    const dur = arch.slotDurationMinutes || 45;
    const buf = arch.bufferMinutes || arch.restDurationMinutes || 0;

    let mEnd = arch.morningEndTime;
    let eStart = arch.eveningStartTime;
    let eEnd = arch.eveningEndTime;

    if (settings.halfDay.day === dow) {
      if (settings.halfDay.mode === 'morning_only') {
        return { morning: generateTimeSlots(arch.morningStartTime, arch.morningEndTime, dur, buf), evening: [] };
      }
      mEnd = settings.halfDay.endTime;
      eStart = "00:00"; eEnd = "00:00"; // Disable evening
    }

    return {
      morning: generateTimeSlots(arch.morningStartTime, mEnd, dur, buf),
      evening: generateTimeSlots(eStart, eEnd, dur, buf)
    };
  }, [settings, currentDate]);

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, Appointment>>();
    engineers.forEach(eng => {
      const engMap = new Map<string, Appointment>();
      filteredAppointments.filter(a => a.engineerId === eng.id).forEach(a => {
        const time = format(parseISO(a.start), 'HH:mm');
        engMap.set(time, a);
      });
      map.set(eng.id!, engMap);
    });
    return map;
  }, [engineers, filteredAppointments]);

  const handleAction = (mode: 'create' | 'edit', eng?: Employee, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, engineer: eng, slot, appointment: appt });
    setDialogOpen(true);
  };

  const isLoading = apptsLoading || empsLoading || clientsLoading || !settings;

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir={dir}>
      {/* --- Print Style --- */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #print-header { display: block !important; }
          .A4 { width: 210mm; margin: 0 auto; }
          body { background: white !important; }
          .card-shadow { box-shadow: none !important; border: 1px solid #eee !important; }
        }
        #print-header { display: none; }
      `}</style>

      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="flex items-center gap-6">
           <div className="flex items-center bg-white rounded-2xl shadow-xl border-2 border-slate-50 p-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))} className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                <ChevronLeft className={cn("h-5 w-5", !isRtl && "rotate-0")} />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="px-6 font-black text-slate-800 gap-2 h-10 hover:bg-slate-50">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {format(currentDate, 'EEEE, d MMMM yyyy', { locale: isRtl ? ar : enUS })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-3xl shadow-3xl border-0">
                  <Calendar mode="single" selected={currentDate} onSelect={(d) => d && setCurrentDate(d)} locale={isRtl ? ar : enUS} />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))} className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                <ChevronRight className={cn("h-5 w-5", !isRtl && "rotate-0")} />
              </Button>
           </div>
           <Button variant="outline" onClick={() => setCurrentDate(new Date())} className="rounded-xl font-bold border-2 h-12 px-6 bg-white hover:bg-slate-50">
             {isRtl ? 'اليوم' : 'Today'}
           </Button>
        </div>
        <div className="flex gap-3">
           <Button onClick={() => window.print()} className="rounded-xl h-12 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all">
             <Printer className="h-4 w-4" /> {isRtl ? 'طباعة الجدول' : 'Print Grid'}
           </Button>
        </div>
      </div>

      {/* --- Stats --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 no-print">
         <Card className="border-0 shadow-lg rounded-3xl bg-white border-b-8 border-slate-900">
            <CardContent className="p-6 text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي المواعيد' : 'Total Appts'}</p>
               <h3 className="text-3xl font-black text-slate-900">{stats.total}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-lg rounded-3xl bg-white border-b-8 border-yellow-400">
            <CardContent className="p-6 text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'زيارة أولى (جديد)' : '1st Visits'}</p>
               <h3 className="text-3xl font-black text-yellow-500">{stats.yellow}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-lg rounded-3xl bg-white border-b-8 border-emerald-500">
            <CardContent className="p-6 text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'متابعة (تحت الدراسة)' : 'Follow-ups'}</p>
               <h3 className="text-3xl font-black text-emerald-600">{stats.green}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-lg rounded-3xl bg-white border-b-8 border-blue-500">
            <CardContent className="p-6 text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'عملاء متعاقدون' : 'Contracted'}</p>
               <h3 className="text-3xl font-black text-blue-600">{stats.blue}</h3>
            </CardContent>
         </Card>
      </div>

      {/* --- Main Grid --- */}
      <div className="space-y-12 pb-20">
         <GridSection 
           title={isRtl ? "الفترة الصباحية ☀️" : "Morning Session"} 
           slots={timeSlots.morning} 
           engineers={engineers} 
           grid={grid} 
           meta={apptMeta} 
           onAction={handleAction}
           isRtl={isRtl}
           clients={clientsMap}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة المسائية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={engineers} 
             grid={grid} 
             meta={apptMeta} 
             onAction={handleAction}
             isRtl={isRtl}
             clients={clientsMap}
           />
         )}
      </div>

      {/* --- Dialogs --- */}
      {dialogOpen && (
        <AppointmentManagerDialog 
          isOpen={dialogOpen} 
          onClose={() => setDialogOpen(false)} 
          data={dialogData!} 
          clients={allClients}
          companyId={companyId!}
          userId={user!.uid}
          db={db}
        />
      )}
    </div>
  );
}

function GridSection({ title, slots, engineers, grid, meta, onAction, isRtl, clients }: any) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4 px-2">
          <Badge className="bg-slate-900 text-white font-black px-6 py-2 rounded-full text-xs shadow-lg uppercase tracking-widest">{title}</Badge>
          <div className="h-[1px] flex-1 bg-slate-200" />
       </div>

       <div className="overflow-x-auto rounded-[2.5rem] shadow-2xl border-4 border-white bg-white ring-1 ring-black/5">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50/80">
                   <th className="w-24 p-6 border-b-2 border-white font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">{isRtl ? 'الوقت' : 'Time'}</th>
                   {engineers.map((eng: Employee) => (
                     <th key={eng.id} className="p-6 border-b-2 border-white border-s-2 text-start">
                        <div className="flex items-center gap-3">
                           <AvatarFallback className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-black text-xs uppercase">{eng.fullName.charAt(0)}</AvatarFallback>
                           <div className="flex flex-col">
                              <span className="font-black text-slate-800 text-sm">{eng.fullName}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{eng.jobTitle}</span>
                           </div>
                        </div>
                     </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string) => (
                  <tr key={slot} className="group/row">
                     <td className="p-6 text-center border-b-2 border-white font-mono font-black text-slate-400 bg-slate-50/30 text-xs">{slot}</td>
                     {engineers.map((eng: Employee) => {
                        const appt = grid.get(eng.id)?.get(slot);
                        if (appt) {
                           const m = meta.get(appt.id);
                           const client = clients.get(appt.clientId);
                           return (
                             <td key={eng.id} className="p-2 border-b-2 border-white border-s-2 align-top">
                                <Card 
                                  onClick={() => onAction('edit', eng, slot, appt)}
                                  className={cn("border-2 p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] rounded-2xl h-full", cardGradient(m?.color || ''))}
                                >
                                   <div className="flex justify-between items-start mb-2">
                                      <div className="text-start">
                                         <p className="font-black text-sm leading-tight mb-1">{appt.clientName || client?.nameAr}</p>
                                         <div className="flex items-center gap-1.5 text-[8px] font-black uppercase opacity-60">
                                            <MapPin className="h-2 w-2" /> {client?.governorateName || '---'}
                                         </div>
                                      </div>
                                      <Badge className="bg-white/40 text-inherit border-0 font-black text-[8px] h-5 px-1.5 rounded-lg">VISIT {m?.visitCount}</Badge>
                                   </div>
                                </Card>
                             </td>
                           );
                        }
                        return (
                          <td 
                            key={eng.id} 
                            onClick={() => onAction('create', eng, slot)}
                            className="p-2 border-b-2 border-white border-s-2 group-hover/row:bg-slate-50/50 transition-colors cursor-pointer"
                          >
                             <div className="h-16 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <Plus className="h-6 w-6 text-slate-200" />
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

function AppointmentManagerDialog({ isOpen, onClose, data, clients, companyId, userId, db }: { isOpen: boolean, onClose: () => void, data: any, clients: Client[], companyId: string, userId: string, db: any }) {
  const { lang, isRtl, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: data.appointment?.title || '',
    clientId: data.appointment?.clientId || '',
    clientName: data.appointment?.clientName || '',
    date: data.appointment ? format(parseISO(data.appointment.start), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: data.slot || (data.appointment ? format(parseISO(data.appointment.start), 'HH:mm') : '08:00'),
    notes: data.appointment?.notes || ''
  });

  const handleSave = async () => {
    if (!formData.title || !formData.clientId || !formData.date) return;
    setLoading(true);
    try {
      const service = new AppointmentService(db, companyId);
      const start = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      const selectedClient = clients.find(c => c.id === formData.clientId);

      if (data.mode === 'create') {
        await service.createAppointment({
          title: formData.title,
          clientId: formData.clientId,
          clientName: selectedClient?.nameAr || formData.clientName,
          engineerId: data.engineer.id,
          engineerName: data.engineer.fullName,
          type: 'client_meeting',
          start,
          status: 'scheduled',
          notes: formData.notes
        }, userId);
      } else if (data.appointment?.id) {
        await service.updateAppointment(data.appointment.id, {
          title: formData.title,
          clientId: formData.clientId,
          clientName: selectedClient?.nameAr || formData.clientName,
          start,
          notes: formData.notes
        });
      }
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
      <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-xl">
        <div className="bg-[#1e1b4b] p-8 text-white text-start">
           <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
              <Navigation className="h-6 w-6 text-blue-600" />
              {data.mode === 'create' ? (isRtl ? 'حجز موعد معماري' : 'Book Appointment') : (isRtl ? 'تعديل بيانات الموعد' : 'Edit Appointment')}
           </DialogTitle>
           <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{data.engineer?.fullName || data.appointment?.engineerName}</p>
        </div>

        <div className="p-8 space-y-6 text-start">
           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'غرض الزيارة / العنوان' : 'Subject / Purpose'}</Label>
              <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder="..." />
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'العميل المالك' : 'Client'}</Label>
              <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                 <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                 <SelectContent className="rounded-xl border-0 shadow-2xl">
                    {clients.map(c => <SelectItem key={c.id} value={c.id!} className="font-bold">{c.nameAr}</SelectItem>)}
                 </SelectContent>
              </Select>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'التاريخ' : 'Date'}</Label>
                 <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الوقت' : 'Time'}</Label>
                 <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'ملاحظات' : 'Internal Notes'}</Label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full h-24 rounded-xl border-2 bg-slate-50/50 p-4 text-xs font-bold resize-none shadow-inner" placeholder="..." />
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
           <Button variant="outline" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-8 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
              {isRtl ? 'تثبيت الموعد' : 'Confirm Booking'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvatarFallback({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-center rounded-full bg-slate-100", className)}>
      {children}
    </div>
  );
}
