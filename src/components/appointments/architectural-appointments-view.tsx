'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  parse, 
  format, 
  isValid, 
  addMinutes, 
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
  X,
  Save,
  Trash2,
  Search,
  Target,
  ArrowRight,
  Globe,
  Hammer,
  User as UserIcon,
  ShieldCheck,
  Building2,
  Filter,
  Eye,
  AlertTriangle,
  MoreVertical,
  CalendarX,
  Plane,
  Timer,
  Ban,
  RotateCcw,
  MessageSquare,
  Link as LinkIcon,
  Workflow
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, updateDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { WorkHoursService } from '@/services/work-hours-service';
import { AppointmentService } from '@/services/appointment-service';
import { ClientService } from '@/services/client-service';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { Client } from '@/types/client';
import { Employee, LeaveRequest, PermissionRequest, AttendanceRecord } from '@/types/hr';
import { DayOfWeek, WorkHoursSettings } from '@/types/work-hours';
import { Governorate } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from 'next/navigation';

// --- Helpers ---
function getVisitColor(visitCount: number, status?: string, apptType?: string): string {
  if (apptType === 'busy_blocked') return '#475569'; // Slate-600
  if (visitCount === 1) return '#facc15'; 
  if (visitCount > 1 && status !== 'contracted') return '#22c55e'; 
  if (visitCount > 1 && status === 'contracted') return '#3b82f6'; 
  return '#9ca3af'; 
}

function cardGradient(color: string) {
  if (color === '#facc15') return "bg-yellow-50 border-yellow-200 text-yellow-900 shadow-xl shadow-yellow-100/50";
  if (color === '#22c55e') return "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xl shadow-emerald-100/50";
  if (color === '#3b82f6') return "bg-blue-50 border-blue-200 text-blue-900 shadow-xl shadow-blue-100/50";
  if (color === '#475569') return "bg-slate-100 border-slate-300 text-slate-600 grayscale opacity-80";
  return "bg-slate-50 border-slate-200 text-slate-900 shadow-xl shadow-slate-100/50";
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
      out.set(a.id!, { visitCount: vc, status: clientStatus, color: getVisitColor(vc, clientStatus, a.type) });
    });
  });
  return out;
}

export function ArchitecturalAppointmentsView() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ mode: 'create' | 'edit'; appointment?: Appointment; slot?: string; engineer?: Employee } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const visibleDates = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(currentDate, 2),
      end: addDays(currentDate, 2)
    });
  }, [currentDate]);

  // --- Data Queries ---
  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start')) : null, 
  [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), where('status', 'in', ['approved', 'on-leave', 'commenced'])) : null, 
  [db, companyId]);

  const permsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.permissionRequests(companyId)), where('date', '==', dateStr), where('status', '==', 'approved')) : null, 
  [db, companyId, dateStr]);

  const attendanceQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.attendance(companyId)), where('date', '==', dateStr), where('status', '==', 'absent')) : null, 
  [db, companyId, dateStr]);

  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);
  const { data: allEmployees, loading: empsLoading } = useCollection<Employee>(empsQuery);
  const { data: allClients, loading: clientsLoading } = useCollection<Client>(clientsQuery);
  const { data: governorates } = useCollection<Governorate>(govsQuery);
  
  const { data: approvedLeaves } = useCollection<LeaveRequest>(leavesQuery);
  const { data: approvedPermissions } = useCollection<PermissionRequest>(permsQuery);
  const { data: dailyAbsences } = useCollection<AttendanceRecord>(attendanceQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const archEngineers = useMemo(() => {
    const list = (allEmployees || []).filter(e => e.departmentName?.includes('معماري') || e.departmentName?.includes('Arch'));
    if (!isAdmin && globalUser?.employeeId) {
       return list.filter(e => e.id === globalUser.employeeId);
    }
    return list;
  }, [allEmployees, isAdmin, globalUser]);

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
    const dow = format(currentDate, 'EEEE') as any;
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
    archEngineers.forEach(eng => {
      const engMap = new Map<string, Appointment>();
      filteredAppointments.filter(a => a.engineerId === eng.id).forEach(a => {
        const time = format(parseISO(a.start), 'HH:mm');
        engMap.set(time, a);
      });
      map.set(eng.id!, engMap);
    });
    return map;
  }, [archEngineers, filteredAppointments]);

  const handleAction = (mode: 'create' | 'edit', eng?: Employee, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, engineer: eng, slot, appointment: appt });
    setDialogOpen(true);
  };

  if (!mounted || apptsLoading || empsLoading || clientsLoading || !settings) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-12 animate-in fade-in duration-700" dir={dir}>
      
      <div className="flex flex-col items-center gap-6 print:hidden">
        <h2 className="text-xl font-black text-primary uppercase tracking-widest">{isRtl ? 'رادار المواعيد المعماري' : 'Architectural Radar'}</h2>
        
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
           engineers={archEngineers} 
           grid={grid} 
           meta={apptMeta} 
           onAction={handleAction}
           isRtl={isRtl}
           clients={clientsMap}
           isAdmin={isAdmin}
           currentEngineerId={globalUser?.employeeId}
           leaves={approvedLeaves}
           permissions={approvedPermissions}
           absences={dailyAbsences}
           dateStr={dateStr}
           db={db}
           companyId={companyId}
           router={router}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة المسائية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={archEngineers} 
             grid={grid} 
             meta={apptMeta} 
             onAction={handleAction}
             isRtl={isRtl}
             clients={clientsMap}
             isAdmin={isAdmin}
             currentEngineerId={globalUser?.employeeId}
             leaves={approvedLeaves}
             permissions={approvedPermissions}
             absences={dailyAbsences}
             dateStr={dateStr}
             db={db}
             companyId={companyId}
             router={router}
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

function GridSection({ title, slots, engineers, grid, meta, onAction, isRtl, clients, isAdmin, currentEngineerId, leaves, permissions, absences, dateStr, db, companyId, router }: any) {
  if (slots.length === 0) return null;
  
  const visibleEngineers = isAdmin ? engineers : engineers.filter((e: any) => e.id === currentEngineerId);

  const getBlockedReason = (engId: string, slotTime: string) => {
     const leave = leaves?.find((l: any) => l.employeeId === engId && dateStr >= l.startDate && dateStr <= l.endDate);
     if (leave) return { type: 'leave', label: isRtl ? 'في إجازة' : 'On Leave' };

     const absence = absences?.find((a: any) => a.employeeId === engId);
     if (absence) return { type: 'absent', label: isRtl ? 'غائب اليوم' : 'Absent' };

     const perm = permissions?.find((p: any) => {
        if (p.userId !== engId) return false;
        const slot = parse(slotTime, 'HH:mm', new Date());
        const pStart = parse(p.startTime, 'HH:mm', new Date());
        const pEnd = parse(p.endTime, 'HH:mm', new Date());
        return slot >= pStart && slot < pEnd;
     });
     if (perm) return { type: 'permission', label: isRtl ? 'استئذان' : 'Permission' };

     return null;
  };

  const handleDeleteAppt = async (id: string) => {
     if (!confirm(isRtl ? "هل أنت متأكد من حذف الموعد نهائياً؟" : "Confirm permanent deletion?")) return;
     try {
        const service = new AppointmentService(db, companyId);
        await service.deleteAppointment(id);
        toast({ title: isRtl ? "تم الحذف بنجاح" : "Deleted successfully" });
     } catch (e) {
        toast({ variant: "destructive", title: isRtl ? "خطأ" : "Error" });
     }
  };

  const handleCancelAppt = async (id: string) => {
     try {
        const service = new AppointmentService(db, companyId);
        await service.updateStatus(id, 'cancelled', 'SYSTEM');
        toast({ title: isRtl ? "تم إلغاء الموعد" : "Appointment cancelled" });
     } catch (e) {
        toast({ variant: "destructive", title: isRtl ? "خطأ" : "Error" });
     }
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4 px-2">
          <Badge className="bg-slate-900 text-white font-black px-6 py-2 rounded-full text-xs shadow-lg uppercase tracking-widest">{title}</Badge>
          <div className="h-[1.5px] flex-1 bg-slate-200" />
       </div>

       <div className="overflow-x-auto rounded-[2.5rem] shadow-2xl border-4 border-white bg-white ring-1 ring-black/5">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-100/80">
                   <th className="w-24 p-6 border-b-2 border-slate-200 font-black text-[10px] text-slate-500 uppercase tracking-[0.2em] bg-slate-100/50">{isRtl ? 'الوقت' : 'Time'}</th>
                   {visibleEngineers.map((eng: Employee) => (
                     <th key={eng.id} className="p-6 border-b-2 border-slate-200 border-s-2 border-s-slate-100 text-start bg-white min-w-[220px]">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs uppercase shadow-md border-2 border-white">{eng.fullName.charAt(0)}</div>
                           <div className="flex flex-col text-start">
                              <span className="font-black text-slate-900 text-sm leading-none">{eng.fullName}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{eng.jobTitle}</span>
                           </div>
                        </div>
                     </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string, sIdx: number) => (
                  <tr key={slot} className={cn("group/row", sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/10")}>
                     <td className="p-6 text-center border-b-2 border-slate-200 border-e-2 border-e-slate-200 font-mono font-black text-slate-500 bg-slate-100/50 text-xs">{slot}</td>
                     {visibleEngineers.map((eng: Employee) => {
                        const appt = grid.get(eng.id)?.get(slot);
                        const block = getBlockedReason(eng.id!, slot);

                        if (block) {
                           return (
                             <td key={eng.id} className="p-2 border-b-2 border-slate-200 border-s-2 border-s-slate-100 bg-slate-50/50">
                                <div className="h-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-300 uppercase italic opacity-60">
                                   {block.type === 'leave' && <Plane className="h-3 w-3" />}
                                   {block.type === 'permission' && <Timer className="h-3 w-3" />}
                                   {block.type === 'absent' && <Ban className="h-3 w-3" />}
                                   {block.label}
                                </div>
                             </td>
                           );
                        }

                        if (appt) {
                           const m = meta.get(appt.id);
                           const client = clients.get(appt.clientId);
                           const isBusy = appt.type === 'busy_blocked';

                           return (
                             <td key={eng.id} className="p-2 border-b-2 border-slate-200 border-s-2 border-s-slate-100 align-top relative">
                                <Card 
                                  onClick={() => !isBusy && router.push(`/dashboard/appointments/${appt.id}`)}
                                  className={cn("border-2 p-4 rounded-2xl h-full shadow-lg relative group/card cursor-pointer transition-all hover:ring-4 hover:ring-primary/5", cardGradient(m?.color || ''))}
                                >
                                   <div className="flex justify-between items-start mb-2">
                                      <div className="text-start">
                                         <p className="font-black text-sm leading-tight mb-1">{isBusy ? (isRtl ? 'مشغول / مهام مكتبية' : 'Busy / Internal') : (appt.clientName || client?.nameAr)}</p>
                                         {!isBusy && (
                                           <div className="flex items-center gap-1.5 text-[8px] font-black uppercase opacity-60">
                                              <MapPin className="h-2.5 w-2.5" /> {client?.governorateName || '---'}
                                           </div>
                                         )}
                                      </div>
                                      
                                      <DropdownMenu>
                                         <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()} className="h-8 w-8 rounded-lg bg-white shadow-md border border-slate-200 hover:bg-slate-50 transition-all z-20">
                                               <MoreVertical className="h-4 w-4 text-slate-900" />
                                            </Button>
                                         </DropdownMenuTrigger>
                                         <DropdownMenuContent align="end" className="rounded-xl border-2 shadow-2xl z-[100] bg-white min-w-[180px]">
                                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'إجراءات الموعد' : 'Actions'}</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/appointments/${appt.id}`); }} className="font-bold gap-3 py-3 cursor-pointer">
                                               <MessageSquare className="h-4 w-4 text-primary" /> {isRtl ? 'غرفة العمليات (دردشة)' : 'War Room'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('edit', eng, slot, appt); }} className="font-bold gap-3 py-3 cursor-pointer">
                                               <Edit3 className="h-4 w-4 text-blue-500" /> {isRtl ? 'تعديل / إعادة جدولة' : 'Reschedule'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCancelAppt(appt.id!); }} className="font-bold gap-3 py-3 cursor-pointer">
                                               <CalendarX className="h-4 w-4 text-orange-500" /> {isRtl ? 'إلغاء الموعد' : 'Cancel'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteAppt(appt.id!); }} className="font-bold gap-3 py-3 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                                               <Trash2 className="h-4 w-4" /> {isRtl ? 'حذف نهائي' : 'Delete'}
                                            </DropdownMenuItem>
                                         </DropdownMenuContent>
                                      </DropdownMenu>
                                   </div>
                                   {!isBusy && (
                                     <div className="mt-auto flex items-center justify-between">
                                        <Badge className="bg-white/60 text-inherit border-0 font-black text-[8px] h-5 px-1.5 rounded-lg shadow-sm">VISIT {m?.visitCount}</Badge>
                                        {appt.transactionId && <LinkIcon className="h-3 w-3 opacity-30 text-inherit" />}
                                     </div>
                                   )}
                                </Card>
                             </td>
                           );
                        }
                        return (
                          <td 
                            key={eng.id} 
                            onClick={() => onAction('create', eng, slot)}
                            className="p-2 border-b-2 border-slate-200 border-s-2 border-s-slate-100 group-hover/row:bg-primary/[0.03] transition-colors cursor-pointer"
                          >
                             <div className="h-16 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                   <Plus className="h-4 w-4" />
                                </div>
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
  const { dir, isRtl, t } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [isBusyBlock, setIsBusyBlock] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);

  // حالات الربط الفني
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loadingTrans, setLoadingTrans] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    clientName: '',
    transactionId: '',
    transactionNumber: '',
    stageId: '',
    stageName: '',
    newClientName: '',
    newClientPhone: '',
    newClientGovId: '',
    newClientGovName: '',
    date: '',
    time: '',
    notes: ''
  });

  const targetEngineerId = data?.engineer?.id || data?.appointment?.engineerId;
  
  const filteredClients = useMemo(() => {
    let list = clients || [];
    if (targetEngineerId) {
      list = list.filter((c: any) => c.assignedEngineerId === targetEngineerId);
    }
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      list = list.filter((c: any) => 
        c.nameAr?.toLowerCase().includes(q) || 
        c.fileNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, targetEngineerId, clientSearch]);

  // جلب المشاريع عند اختيار العميل
  useEffect(() => {
    if (formData.clientId && db && companyId) {
      setLoadingTrans(true);
      getDocs(query(collection(db, paths.transactions(companyId)), where('clientId', '==', formData.clientId)))
        .then(snap => setTransactions(snap.docs.map(d => ({id: d.id, ...d.data()}))))
        .finally(() => setLoadingTrans(false));
    } else {
      setTransactions([]);
    }
  }, [formData.clientId, db, companyId]);

  // جلب المراحل عند اختيار المشروع
  useEffect(() => {
    if (formData.transactionId && db && companyId) {
      setLoadingStages(true);
      getDocs(query(collection(db, paths.transactionStages(companyId, formData.transactionId)), orderBy('order')))
        .then(snap => setStages(snap.docs.map(d => ({id: d.id, ...d.data()}))))
        .finally(() => setLoadingStages(false));
    } else {
      setStages([]);
    }
  }, [formData.transactionId, db, companyId]);

  useEffect(() => {
    if (!isOpen) {
       setFormData({
         title: '', clientId: '', clientName: '', transactionId: '', transactionNumber: '', stageId: '', stageName: '',
         newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', date: '', time: '', notes: ''
       });
       setIsNewClient(false);
       setIsBusyBlock(false);
       setClientSearch("");
       setShowClientList(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && data) {
      setFormData(prev => ({
        ...prev,
        title: data.appointment?.title || '',
        clientId: data.appointment?.clientId || '',
        clientName: data.appointment?.clientName || '',
        transactionId: data.appointment?.transactionId || '',
        transactionNumber: data.appointment?.transactionNumber || '',
        stageId: data.appointment?.stageId || '',
        stageName: data.appointment?.stageName || '',
        date: data.appointment ? format(parseISO(data.appointment.start), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        time: data.slot || (data.appointment ? format(parseISO(data.appointment.start), 'HH:mm') : '08:00'),
        notes: data.appointment?.notes || ''
      }));
      setIsBusyBlock(data.appointment?.type === 'busy_blocked');
    }
  }, [isOpen, data]);

  const handleSave = async () => {
    if (!data) return;
    const isCreate = data.mode === 'create';
    const start = new Date(`${formData.date}T${formData.time}:00`).toISOString();
    
    setLoading(true);
    try {
      const appService = new AppointmentService(db, companyId);
      const clientService = new ClientService(db, companyId);
      
      let targetClientId = formData.clientId;
      let targetClientName = formData.clientName;
      let apptType: any = 'client_meeting';

      if (isBusyBlock) {
         apptType = 'busy_blocked';
         targetClientId = 'SYSTEM_BLOCK';
         targetClientName = isRtl ? 'مشغول / داخلي' : 'BUSY / INTERNAL';
      } else if (isCreate && isNewClient) {
        const gov = governorates?.find((g: any) => g.id === formData.newClientGovId);
        const nextFileNum = await clientService.getNextFileNumber();
        
        targetClientId = await clientService.addClient({
          nameAr: formData.newClientName,
          mobile: formData.newClientPhone,
          governorateId: formData.newClientGovId,
          governorateName: gov ? (isRtl ? gov.name : gov.nameEn) : '',
          fileNumber: nextFileNum,
          status: 'new',
          assignedEngineerId: data.engineer.id,
          assignedEngineerName: data.engineer.fullName
        }, userId, userName);
        targetClientName = formData.newClientName;
      }

      const savePayload = {
        title: formData.title || (isBusyBlock ? (isRtl ? 'مشغول' : 'BUSY') : (isRtl ? 'موعد فني' : 'Appt')),
        clientId: targetClientId,
        clientName: targetClientName,
        transactionId: formData.transactionId,
        transactionNumber: formData.transactionNumber,
        stageId: formData.stageId,
        stageName: formData.stageName,
        engineerId: data.engineer?.id || data.appointment?.engineerId,
        engineerName: data.engineer?.fullName || data.appointment?.engineerName,
        type: apptType,
        start,
        status: 'scheduled' as AppointmentStatus,
        companyId,
        notes: formData.notes
      };

      if (isCreate) {
        await appService.createAppointment(savePayload, userId);
      } else if (data.appointment?.id) {
        await appService.updateAppointment(data.appointment.id, savePayload);
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
      <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl" dir={dir}>
        <div className="bg-slate-50 p-8 text-slate-900 text-start border-b shrink-0">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-xl border-2 border-primary/10">
                    {data?.mode === 'create' ? <Plus className="h-6 w-6" /> : <Edit3 className="h-6 w-6" />}
                 </div>
                 <div>
                    <DialogTitle className="text-xl font-black font-headline">
                       {data?.mode === 'create' ? (isRtl ? 'حجز موعد ميداني' : 'New Site Appointment') : (isRtl ? 'إعادة جدولة الموعد' : 'Reschedule')}
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

        <div className="p-8 space-y-8 text-start max-h-[70vh] overflow-y-auto scrollbar-hide">
           {data?.mode === 'create' && (
             <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border-2 border-white shadow-inner">
                   <Label className="font-black text-[10px] uppercase text-slate-500">{isRtl ? 'عميل جديد؟' : 'New Client?'}</Label>
                   <Switch checked={isNewClient} onCheckedChange={v => { setIsNewClient(v); if(v) setIsBusyBlock(false); }} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 text-white shadow-xl">
                   <Label className="font-black text-[10px] uppercase text-primary">{isRtl ? 'غلق الخانة (Busy)' : 'Block Slot'}</Label>
                   <Switch checked={isBusyBlock} onCheckedChange={v => { setIsBusyBlock(v); if(v) setIsNewClient(false); }} />
                </div>
             </div>
           )}

           {!isBusyBlock && (
             <div className="space-y-6">
                {isNewClient ? (
                   <div className="space-y-4 p-6 rounded-[2rem] border-2 border-primary/10 bg-primary/5 animate-in fade-in">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم العميل الكامل' : 'Client Full Name'}</Label>
                         <Input value={formData.newClientName} onChange={e => setFormData({...formData, newClientName: e.target.value})} className="h-11 rounded-xl border-2 font-bold bg-white" placeholder="..." />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
                            <Input value={formData.newClientPhone} onChange={e => setFormData({...formData, newClientPhone: e.target.value})} className="h-11 rounded-xl border-2 font-bold bg-white" placeholder="+965" />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المحافظة' : 'Gov'}</Label>
                            <Select value={formData.newClientGovId} onValueChange={v => {
                               const g = governorates?.find((x:any)=>x.id===v);
                               setFormData({...formData, newClientGovId: v, newClientGovName: isRtl?g.name:g.nameEn});
                            }}>
                               <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                               <SelectContent className="rounded-xl border-0 shadow-2xl">
                                  {governorates?.map((g: any) => <SelectItem key={g.id} value={g.id} className="font-bold text-xs">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اختيار العميل من محفظتك' : 'Select Assigned Client'}</Label>
                      <div className="relative">
                        <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                        <Input 
                          value={clientSearch}
                          onFocus={() => setShowClientList(true)}
                          onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
                          placeholder={isRtl ? "ابحث بالاسم أو رقم الملف..." : "Search by name or file..."}
                          className="h-14 rounded-2xl border-2 ps-12 font-black text-sm bg-white shadow-inner"
                        />
                      </div>
                      
                      {showClientList && (
                        <div className="mt-2 p-2 bg-white rounded-2xl border-2 border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 z-50 relative">
                           <ScrollArea className="h-40">
                              <div className="space-y-1 p-1">
                                 {filteredClients.map((c: any) => (
                                   <div 
                                     key={c.id} 
                                     onClick={() => { setFormData({...formData, clientId: c.id!, clientName: c.nameAr}); setClientSearch(c.nameAr); setShowClientList(false); }}
                                     className={cn(
                                       "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border-2",
                                       formData.clientId === c.id ? "bg-primary border-primary text-white shadow-lg" : "bg-white border-slate-50 hover:border-primary/20"
                                     )}
                                   >
                                      <div className="text-start">
                                         <p className="font-black text-xs">{c.nameAr}</p>
                                         <p className={cn("text-[8px] font-mono font-bold uppercase", formData.clientId === c.id ? "text-white/60" : "text-slate-400")}>#{c.fileNumber}</p>
                                      </div>
                                      {formData.clientId === c.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                                   </div>
                                 ))}
                                 {filteredClients.length === 0 && <div className="p-8 text-center text-[10px] text-slate-300 italic font-bold">لا يوجد نتائج</div>}
                              </div>
                           </ScrollArea>
                        </div>
                      )}
                   </div>
                )}

                {/* الربط الفني بالمشروع (The Pivot Link) */}
                {formData.clientId && !isNewClient && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner animate-in slide-in-from-top-2">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                            <Briefcase className="h-3 w-3" /> {isRtl ? 'ربط الموعد بمشروع' : 'Link to Project'}
                         </Label>
                         <Select value={formData.transactionId} onValueChange={v => {
                            const t = transactions.find(x => x.id === v);
                            setFormData({...formData, transactionId: v, transactionNumber: t?.transactionNumber || '', stageId: '', stageName: ''});
                         }}>
                            <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white shadow-sm">
                               {loadingTrans ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="..." />}
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-0 shadow-2xl">
                               {transactions.map(t => <SelectItem key={t.id} value={t.id!} className="font-bold text-xs">{t.subServiceName} - {t.transactionNumber}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>

                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                            <Workflow className="h-3 w-3" /> {isRtl ? 'المرحلة الفنية المستهدفة' : 'Technical Stage'}
                         </Label>
                         <Select disabled={!formData.transactionId} value={formData.stageId} onValueChange={v => {
                            const s = stages.find(x => x.id === v);
                            setFormData({...formData, stageId: v, stageName: s?.name || ''});
                         }}>
                            <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white shadow-sm">
                               {loadingStages ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="..." />}
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-0 shadow-2xl">
                               {stages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0">{s.name}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                   </div>
                )}
             </div>
           )}

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'مسمى الموعد / الغرض' : 'Appointment Title'}</Label>
              <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-12 rounded-xl border-2 font-black text-lg bg-slate-50/30 shadow-inner" placeholder={isRtl ? "مثلاً: معاينة رفع عداد..." : "e.g. Site Measurement..."} />
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات وتوجيهات' : 'Notes'}</Label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full h-24 rounded-2xl border-2 bg-slate-50/30 p-4 text-xs font-bold resize-none shadow-inner" placeholder="..." />
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-[1.5rem] border-2 font-black text-lg bg-white shadow-sm">
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button onClick={handleSave} disabled={loading || (!isBusyBlock && !formData.clientId)} className="flex-[2] h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
              {isRtl ? 'تثبيت وحفظ الموعد' : 'Confirm & Save'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
