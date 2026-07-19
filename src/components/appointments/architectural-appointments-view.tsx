
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
  addDays,
  eachDayOfInterval,
  subDays
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  CalendarDays, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Edit3,
  Loader2,
  CheckCircle2,
  MapPin,
  Phone,
  Sparkles,
  X,
  Save,
  Trash2,
  Search,
  Target,
  ArrowRight,
  MoreVertical,
  Calendar as CalendarIcon,
  Globe,
  Hammer,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, addDoc, serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { WorkHoursService } from '@/services/work-hours-service';
import { AppointmentService } from '@/services/appointment-service';
import { ClientService } from '@/services/client-service';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { Client } from '@/types/client';
import { Employee } from '@/types/hr';
import { DayOfWeek, WorkHoursSettings } from '@/types/work-hours';
import { Governorate } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";

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
  if (visitCount === 1) return '#facc15'; 
  if (visitCount > 1 && status !== 'contracted') return '#22c55e'; 
  if (visitCount > 1 && status === 'contracted') return '#3b82f6'; 
  return '#9ca3af'; 
}

function cardGradient(color: string) {
  if (color === '#facc15') return "bg-yellow-50 border-yellow-200 text-yellow-900 shadow-yellow-100/50";
  if (color === '#22c55e') return "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100/50";
  if (color === '#3b82f6') return "bg-blue-50 border-blue-200 text-blue-900 shadow-blue-100/50";
  return "bg-slate-50 border-slate-200 text-slate-900 shadow-slate-100/50";
}

function generateTimeSlots(s: string, e: string, duration: number, rest: number): string[] {
  if (!s || !e || !duration || duration <= 0) return [];
  const slots: string[] = [];
  try {
    const st = parse(s, 'HH:mm', new Date());
    const et = parse(e, 'HH:mm', new Date());
    if (!isValid(st) || !isValid(et) || st >= et) return [];
    let cur = st;
    while (cur < et) {
      const end = addMinutes(cur, duration);
      if (end > et) break;
      slots.push(format(cur, 'HH:mm'));
      cur = addMinutes(end, rest);
    }
  } catch (e) { return []; }
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
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ mode: 'create' | 'edit'; appointment?: Appointment; slot?: string; engineer?: Employee } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visibleDates = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(currentDate, 2),
      end: addDays(currentDate, 2)
    });
  }, [currentDate]);

  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start')) : null, 
  [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);
  const { data: allEmployees, loading: empsLoading } = useCollection<Employee>(empsQuery);
  const { data: allClients, loading: clientsLoading } = useCollection<Client>(clientsQuery);
  const { data: governorates } = useCollection<Governorate>(govsQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const visibleEngineers = useMemo(() => {
    const archEmps = (allEmployees || []).filter(e => e.departmentName?.includes('معماري') || e.departmentName?.includes('Arch'));
    if (isAdmin) return archEmps;
    return archEmps.filter(e => e.id === globalUser?.employeeId);
  }, [allEmployees, isAdmin, globalUser?.employeeId]);

  const clientsMap = useMemo(() => {
    const m = new Map<string, Client>();
    (allClients || []).forEach(c => { if (c.id) m.set(c.id, c); });
    return m;
  }, [allClients]);

  const filteredAppointments = useMemo(() => {
    let list = (rawAppointments || []).filter(a => a.status !== 'cancelled' && isSameDay(parseISO(a.start), currentDate));
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(a => a.engineerId === globalUser.employeeId);
    }
    return list;
  }, [rawAppointments, currentDate, isAdmin, globalUser?.employeeId]);

  const apptMeta = useMemo(() => computeMeta(rawAppointments || [], clientsMap), [rawAppointments, clientsMap]);

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
    const buf = arch.restDurationMinutes || 0;

    let mEnd = arch.morningEndTime;
    let eStart = arch.eveningStartTime;
    let eEnd = arch.eveningEndTime;

    if (settings.halfDay.day === dow) {
      if (settings.halfDay.mode === 'morning_only') {
        return { morning: generateTimeSlots(arch.morningStartTime, arch.morningEndTime, dur, buf), evening: [] };
      }
      mEnd = settings.halfDay.endTime;
      eStart = "00:00"; eEnd = "00:00"; 
    }

    return {
      morning: generateTimeSlots(arch.morningStartTime, mEnd, dur, buf),
      evening: generateTimeSlots(eStart, eEnd, dur, buf)
    };
  }, [settings, currentDate]);

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, Appointment>>();
    visibleEngineers.forEach(eng => {
      const engMap = new Map<string, Appointment>();
      filteredAppointments.filter(a => a.engineerId === eng.id).forEach(a => {
        const time = format(parseISO(a.start), 'HH:mm');
        engMap.set(time, a);
      });
      map.set(eng.id!, engMap);
    });
    return map;
  }, [visibleEngineers, filteredAppointments]);

  const handleAction = (mode: 'create' | 'edit', eng?: Employee, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, engineer: eng, slot, appointment: appt });
    setDialogOpen(true);
  };

  if (!mounted || apptsLoading || empsLoading || clientsLoading || !settings) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-12 animate-in fade-in duration-700" dir={dir}>
      
      {/* Sovereign Date Slider */}
      <div className="flex flex-col items-center gap-6 print:hidden">
        <h2 className="text-xl font-black text-primary uppercase tracking-widest">{isRtl ? 'رادار المواعيد' : 'Appointments Radar'}</h2>
        
        <div className="flex items-center gap-6 w-full max-w-4xl justify-center">
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setCurrentDate(subDays(currentDate, 1))}
             className="h-12 w-12 rounded-full hover:bg-slate-100 transition-all text-slate-400"
           >
              <ChevronLeft className={cn("h-6 w-6", !isRtl && "rotate-180")} />
           </Button>

           <div className="flex gap-4 overflow-hidden py-4 px-2">
              {visibleDates.map((date) => {
                const isSelected = isSameDay(date, currentDate);
                return (
                  <Card 
                    key={date.toISOString()}
                    onClick={() => setCurrentDate(date)}
                    className={cn(
                      "min-w-[100px] h-24 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 rounded-[1.5rem] border-2 shadow-sm",
                      isSelected 
                        ? "bg-primary border-primary text-white scale-110 shadow-orange-500/30 ring-4 ring-orange-500/10" 
                        : "bg-white border-transparent text-slate-400 hover:border-slate-100 hover:bg-slate-50"
                    )}
                  >
                     <span className={cn("text-[10px] font-black uppercase mb-1", isSelected ? "text-white/80" : "text-slate-400")}>
                        {format(date, 'EEEE', { locale: isRtl ? ar : enUS })}
                     </span>
                     <span className="text-3xl font-black font-headline">
                        {format(date, 'd')}
                     </span>
                  </Card>
                );
              })}
           </div>

           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setCurrentDate(addDays(currentDate, 1))}
             className="h-12 w-12 rounded-full hover:bg-slate-100 transition-all text-slate-400"
           >
              <ChevronRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:hidden">
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

      <div className="space-y-12 pb-20">
         <GridSection 
           title={isRtl ? "الفترة الصباحية ☀️" : "Morning Session"} 
           slots={timeSlots.morning} 
           engineers={visibleEngineers} 
           grid={grid} 
           meta={apptMeta} 
           onAction={handleAction}
           isRtl={isRtl}
           clients={clientsMap}
           isAdmin={isAdmin}
           currentEngineerId={globalUser?.employeeId}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة المسائية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={visibleEngineers} 
             grid={grid} 
             meta={apptMeta} 
             onAction={handleAction}
             isRtl={isRtl}
             clients={clientsMap}
             isAdmin={isAdmin}
             currentEngineerId={globalUser?.employeeId}
           />
         )}
      </div>

      <AppointmentManagerDialog 
        isOpen={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        data={dialogData} 
        clients={allClients || []}
        governorates={governorates || []}
        companyId={companyId!}
        userId={user!.uid}
        userName={user!.displayName || 'User'}
        db={db}
        rawAppointments={rawAppointments || []}
      />
    </div>
  );
}

function GridSection({ title, slots, engineers, grid, meta, onAction, isRtl, clients, isAdmin, currentEngineerId }: any) {
  if (slots.length === 0) return null;
  
  const visibleEngineers = isAdmin ? engineers : engineers.filter((e: any) => e.id === currentEngineerId);

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
                   {visibleEngineers.map((eng: Employee) => (
                     <th key={eng.id} className="p-6 border-b-2 border-white border-s-2 text-start">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs uppercase shadow-inner">{eng.fullName.charAt(0)}</div>
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
                     {visibleEngineers.map((eng: Employee) => {
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

function AppointmentManagerDialog({ isOpen, onClose, data, clients, governorates, companyId, userId, userName, db, rawAppointments }: any) {
  const { dir, lang, isRtl, t } = useLanguage();
  const { isAdmin } = usePermissions();
  const { globalUser } = useAuthContext();
  
  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [govSearch, setGovSearch] = useState("");
  
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [govPopoverOpen, setGovPopoverOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    clientName: '',
    newClientName: '',
    newClientPhone: '',
    newClientGovId: '',
    newClientGovName: '',
    date: '',
    time: '',
    notes: ''
  });

  // Sovereign Filter Protocol: Show only clients assigned to THIS engineer in the dropdown
  const filteredClients = useMemo(() => {
    let list = clients || [];
    
    if (!isAdmin) {
       // Only clients belonging to the logged-in engineer (employeeId)
       list = list.filter((c: any) => c.assignedEngineerId === globalUser?.employeeId);
    }

    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      list = list.filter((c: any) => 
        c.nameAr?.toLowerCase().includes(q) || 
        c.fileNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, isAdmin, globalUser?.employeeId, clientSearch]);

  const filteredGovs = useMemo(() => {
    if (!govSearch.trim()) return governorates;
    const q = govSearch.toLowerCase();
    return governorates.filter((g: any) => 
      g.name?.toLowerCase().includes(q) || 
      g.nameEn?.toLowerCase().includes(q)
    );
  }, [governorates, govSearch]);

  useEffect(() => {
    if (!isOpen) {
       setFormData({
         title: '', clientId: '', clientName: '', newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', date: '', time: '', notes: ''
       });
       setIsNewClient(false);
       setClientSearch("");
       setGovSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && data) {
      setFormData({
        title: data.appointment?.title || '',
        clientId: data.appointment?.clientId || '',
        clientName: data.appointment?.clientName || '',
        newClientName: '',
        newClientPhone: '',
        newClientGovId: '',
        newClientGovName: '',
        date: data.appointment ? format(parseISO(data.appointment.start), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        time: data.slot || (data.appointment ? format(parseISO(data.appointment.start), 'HH:mm') : '08:00'),
        notes: data.appointment?.notes || ''
      });
    }
  }, [isOpen, data]);

  const handleSave = async () => {
    if (!data) return;
    const isCreate = data.mode === 'create';
    const finalTitle = formData.title || (isNewClient ? `زيارة أولى: ${formData.newClientName}` : 'اجتماع عميل');
    const start = new Date(`${formData.date}T${formData.time}:00`).toISOString();
    
    setLoading(true);
    try {
      const appService = new AppointmentService(db, companyId);
      const clientService = new ClientService(db, companyId);
      let targetClientId = formData.clientId;
      let targetClientName = formData.clientName;

      if (isCreate && isNewClient) {
        if (!formData.newClientName || !formData.newClientPhone) {
          toast({ variant: "destructive", title: isRtl ? "بيانات العميل الجديد ناقصة" : "New client data missing" });
          setLoading(false);
          return;
        }
        const gov = governorates?.find((g: any) => g.id === formData.newClientGovId);
        const nextFileNum = await clientService.getNextFileNumber();
        // Registering client with assigned engineer automatically
        targetClientId = await clientService.addClient({
          nameAr: formData.newClientName,
          mobile: formData.newClientPhone,
          governorateId: formData.newClientGovId,
          governorateName: gov ? (isRtl ? gov.name : gov.nameEn) : '',
          fileNumber: nextFileNum,
          status: 'new',
          assignedEngineerId: globalUser?.employeeId,
          assignedEngineerName: globalUser?.username || userName
        }, userId, userName);
        targetClientName = formData.newClientName;
      }

      const isConflict = rawAppointments?.some((a: any) => 
        a.clientId === targetClientId && a.start === start && a.status !== 'cancelled' && a.id !== data.appointment?.id
      );

      if (isConflict) {
        toast({ variant: "destructive", title: isRtl ? "تنبيه: تعارض في المواعيد" : "Schedule Conflict", description: isRtl ? "هذا العميل لديه موعد آخر مسجل في نفس التوقيت بالضبط." : "Client already has an appointment at this specific time." });
        setLoading(false);
        return;
      }

      if (isCreate) {
        await appService.createAppointment({
          title: finalTitle,
          clientId: targetClientId,
          clientName: targetClientName,
          engineerId: data.engineer.id,
          engineerName: data.engineer.fullName,
          type: 'client_meeting',
          start,
          status: 'scheduled',
          companyId
        }, userId);
      } else if (data.appointment?.id) {
        await appService.updateAppointment(data.appointment.id, {
          title: formData.title,
          clientId: targetClientId,
          clientName: targetClientName,
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

  const isCreate = data?.mode === 'create';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
        <div className="bg-primary/5 p-8 text-slate-900 text-start border-b">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-xl border-2 border-primary/10">
                    {isCreate ? <Plus className="h-6 w-6" /> : <Edit3 className="h-6 w-6" />}
                 </div>
                 <div>
                    <DialogTitle className="text-xl font-black font-headline">
                       {isCreate ? (isRtl ? 'حجز موعد جديد' : 'New Appointment') : (isRtl ? 'تعديل الموعد' : 'Edit Appointment')}
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">
                       {data?.engineer?.fullName || data?.appointment?.engineerName}
                    </p>
                 </div>
              </div>
              <Badge variant="outline" className="h-9 px-4 border-2 font-black text-xs bg-white text-slate-400">
                 <Clock className="h-3.5 w-3.5 me-2" /> {formData.time}
              </Badge>
           </div>
        </div>

        <div className="p-8 space-y-6 text-start max-h-[65vh] overflow-y-auto scrollbar-hide">
           {isCreate && (
             <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-slate-50 border-2 border-white shadow-inner">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm border"><Sparkles className="h-4 w-4" /></div>
                   <div className="text-start">
                      <Label className="font-black text-xs">{isRtl ? 'عميل جديد (أول زيارة)' : 'New Client?'}</Label>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{isRtl ? 'سيتم فتح ملف مالي وتجاري تلقائياً' : 'Automated file provisioning'}</p>
                   </div>
                </div>
                <Switch checked={isNewClient} onCheckedChange={setIsNewClient} />
             </div>
           )}

           <div className="space-y-4 animate-in fade-in duration-300">
              {isNewClient ? (
                 <div className="space-y-4 p-6 rounded-[2rem] border-2 border-primary/10 bg-primary/5 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم العميل الكامل' : 'Client Full Name'}</Label>
                       <Input value={formData.newClientName} onChange={e => setFormData({...formData, newClientName: e.target.value})} className="h-11 rounded-xl border-2 font-bold bg-white" placeholder="..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
                          <div className="relative">
                             <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                             <Input value={formData.newClientPhone} onChange={e => setFormData({...formData, newClientPhone: e.target.value})} className="h-11 rounded-xl border-2 font-bold ps-9 bg-white" placeholder="+965" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المحافظة' : 'Gov'}</Label>
                          <Popover open={govPopoverOpen} onOpenChange={setGovPopoverOpen}>
                             <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full h-11 justify-between border-2 bg-white font-bold rounded-xl px-4">
                                   <span className="truncate">{formData.newClientGovName || "..."}</span>
                                   <ChevronDown className="h-4 w-4 opacity-30" />
                                </Button>
                             </PopoverTrigger>
                             <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-[300px] p-0 rounded-2xl border-2 shadow-2xl bg-white" align="start">
                                <div className="p-3 border-b bg-slate-50">
                                   <div className="relative">
                                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                      <Input value={govSearch} onChange={e => setGovSearch(e.target.value)} placeholder={isRtl ? "ابحث..." : "Search..."} className="h-9 rounded-lg text-xs ps-9 border-2" />
                                   </div>
                                </div>
                                <ScrollArea className="h-48">
                                   <div className="p-2 space-y-1">
                                      {filteredGovs?.map((g: any) => (
                                        <div 
                                          key={g.id} 
                                          onClick={() => { setFormData({...formData, newClientGovId: g.id!, newClientGovName: isRtl ? g.name : g.nameEn}); setGovPopoverOpen(false); }}
                                          className="p-3 rounded-lg hover:bg-primary/5 cursor-pointer text-xs font-black text-slate-700 transition-colors border-b last:border-0 border-slate-50"
                                        >
                                           {isRtl ? g.name : g.nameEn}
                                        </div>
                                      ))}
                                   </div>
                                </ScrollArea>
                             </PopoverContent>
                          </Popover>
                       </div>
                    </div>
                 </div>
              ) : (
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اختر العميل المسجل' : 'Registered Client'}</Label>
                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                       <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-14 justify-between border-2 bg-slate-50/50 font-black rounded-xl px-6 text-sm">
                             <span className="truncate">{formData.clientName || (isRtl ? "البحث في قاعدة عملائك..." : "Search your clients...")}</span>
                             <ChevronDown className="h-5 w-5 opacity-30" />
                          </Button>
                       </PopoverTrigger>
                       <PopoverContent 
                         onOpenAutoFocus={(e) => e.preventDefault()} 
                         className="w-[400px] p-0 rounded-[2rem] border-2 shadow-3xl bg-white z-[9999]" 
                         align="start"
                       >
                          <div className="p-4 border-b bg-slate-50 rounded-t-[2rem]">
                             <div className="relative">
                                <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input 
                                  value={clientSearch} 
                                  onChange={e => setClientSearch(e.target.value)} 
                                  placeholder={isRtl ? "ابحث بالاسم أو رقم الملف..." : "Search by name or file..."} 
                                  className="h-12 rounded-xl text-sm ps-11 border-2 bg-white shadow-inner"
                                  autoFocus 
                                />
                             </div>
                          </div>
                          <ScrollArea className="h-64">
                             <div className="p-3 space-y-1">
                                {filteredClients.map((c: any) => (
                                  <div 
                                    key={c.id} 
                                    onClick={() => { 
                                      setFormData({...formData, clientId: c.id!, clientName: c.nameAr}); 
                                      setClientPopoverOpen(false); 
                                    }}
                                    className="p-4 rounded-2xl hover:bg-primary/5 cursor-pointer transition-all border-b last:border-0 border-slate-50 group flex flex-col text-start"
                                  >
                                     <span className="text-xs font-black text-slate-800 group-hover:text-primary transition-colors">{c.nameAr}</span>
                                     <span className="text-[9px] text-slate-400 font-mono mt-1">#{c.fileNumber}</span>
                                  </div>
                                ))}
                                {filteredClients.length === 0 && <div className="p-12 text-center text-[10px] text-slate-400 italic">لا توجد نتائج مطابقة</div>}
                             </div>
                          </ScrollArea>
                       </PopoverContent>
                    </Popover>
                 </div>
              )}
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'غرض الزيارة / العنوان' : 'Purpose / Title'}</Label>
              <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder={isRtl ? "مثلاً: معاينة موقع فيلا السالمية" : "e.g. Site Visit"} />
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات إضافية' : 'Notes'}</Label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full h-24 rounded-2xl border-2 bg-slate-50/50 p-4 text-xs font-bold resize-none shadow-inner" placeholder="..." />
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-[1.5rem] border-2 font-black text-lg bg-white shadow-sm">
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button onClick={handleSave} disabled={loading} className="flex-[2] h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
              {isRtl ? 'تثبيت الموعد' : 'Confirm Booking'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
