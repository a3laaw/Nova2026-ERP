
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  format, 
  isValid, 
  addMinutes, 
  isSameDay, 
  parseISO, 
  addDays,
  eachDayOfInterval,
  subDays,
  parse
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  CalendarDays, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Edit3,
  Loader2,
  CheckCircle2,
  MapPin,
  X,
  Save,
  Trash2,
  Search,
  User as UserIcon,
  ShieldCheck,
  Building2,
  CalendarX,
  Plane,
  Timer,
  Ban,
  MessageSquare,
  Link as LinkIcon,
  PlusCircle,
  MoreVertical,
  Zap,
  RotateCcw,
  Workflow
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, updateDoc, deleteDoc, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
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
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

// --- Helpers ---
function getVisitColor(visitCount: number, status?: string, apptType?: string): string {
  if (apptType === 'busy_blocked') return '#475569'; 
  if (visitCount === 1) return '#facc15'; 
  if (visitCount > 1 && status !== 'contracted') return '#22c55e'; 
  if (visitCount > 1 && status === 'contracted') return '#3b82f6'; 
  return '#9ca3af'; 
}

function cardGradient(color: string) {
  if (color === '#facc15') return "bg-yellow-50 border-yellow-200 text-yellow-900";
  if (color === '#22c55e') return "bg-emerald-50 border-emerald-200 text-emerald-900";
  if (color === '#3b82f6') return "bg-blue-50 border-blue-200 text-blue-900";
  if (color === '#475569') return "bg-slate-100 border-slate-300 text-slate-600 grayscale opacity-80";
  return "bg-slate-50 border-slate-200 text-slate-900";
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
    <div className="space-y-10 animate-in fade-in duration-700" dir={dir}>
      
      <div className="flex flex-col items-center gap-6 print:hidden">
        <div className="flex items-center gap-6 w-full max-w-4xl justify-center">
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setCurrentDate(subDays(currentDate, 1))}
             className="h-10 w-10 rounded-full hover:bg-slate-100 transition-all text-slate-400"
           >
              <ChevronLeft className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>

           <div className="flex gap-4 overflow-hidden py-2 px-2">
              {visibleDates.map((date) => {
                const isSelected = isSameDay(date, currentDate);
                return (
                  <Card 
                    key={date.toISOString()}
                    onClick={() => setCurrentDate(date)}
                    className={cn(
                      "min-w-[80px] h-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 rounded-[1.25rem] border-2 shadow-sm",
                      isSelected 
                        ? "bg-primary border-primary text-white scale-105 shadow-orange-500/20" 
                        : "bg-white border-transparent text-slate-400 hover:border-slate-100 hover:bg-slate-50"
                    )}
                  >
                     <span className={cn("text-[9px] font-black uppercase mb-0.5", isSelected ? "text-white/80" : "text-slate-400")}>
                        {format(date, 'EEEE', { locale: isRtl ? ar : enUS })}
                     </span>
                     <span className="text-2xl font-black font-headline">
                        {format(date, 'd')}
                     </span>
                  </Card>
                );
              })}
           </div>

           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => currentDate.getTime() < addDays(new Date(), 30).getTime() && setCurrentDate(addDays(currentDate, 1))}
             className="h-10 w-10 rounded-full hover:bg-slate-100 transition-all text-slate-400"
           >
              <ChevronRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:hidden">
         <Card className="border-0 shadow-lg rounded-2xl bg-white border-b-4 border-slate-900">
            <CardContent className="p-4 text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي المواعيد' : 'Total Appts'}</p>
               <h3 className="text-2xl font-black text-slate-900">{stats.total.toLocaleString(isRtl ? 'ar-KW' : 'en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl bg-white border-b-4 border-yellow-400">
            <CardContent className="p-4 text-start">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'زيارة أولى (جديد)' : '1st Visits'}</p>
               <h3 className="text-2xl font-black text-yellow-500">{stats.yellow.toLocaleString(isRtl ? 'ar-KW' : 'en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl bg-white border-b-4 border-emerald-500">
            <CardContent className="p-4 text-start">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'متابعة (تحت الدراسة)' : 'Follow-ups'}</p>
               <h3 className="text-2xl font-black text-emerald-600">{stats.green.toLocaleString(isRtl ? 'ar-KW' : 'en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl bg-white border-b-4 border-blue-500">
            <CardContent className="p-4 text-start">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'عملاء متعاقدون' : 'Contracted'}</p>
               <h3 className="text-2xl font-black text-blue-600">{stats.blue.toLocaleString(isRtl ? 'ar-KW' : 'en-US')}</h3>
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
          <Badge className="bg-slate-900 text-white font-black px-6 py-1.5 rounded-full text-[10px] shadow-md uppercase tracking-widest">{title}</Badge>
          <div className="h-[1.5px] flex-1 bg-slate-200" />
       </div>

       <div className="overflow-x-auto rounded-[1.5rem] shadow-xl border-4 border-white bg-white ring-1 ring-black/5">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-100/80">
                   <th className="w-20 p-4 border-b-2 border-slate-200 font-black text-[9px] text-slate-500 uppercase tracking-[0.2em] bg-slate-100/50">{isRtl ? 'الوقت' : 'Time'}</th>
                   {visibleEngineers.map((eng: Employee) => (
                     <th key={eng.id} className="p-4 border-b-2 border-slate-200 border-s-2 border-s-slate-100 text-start bg-white min-w-[200px]">
                        <div className="flex items-center gap-3">
                           <div className="h-9 w-9 rounded-lg bg-primary text-white flex items-center justify-center font-black text-xs uppercase shadow-sm border-2 border-white">{eng.fullName.charAt(0)}</div>
                           <div className="flex flex-col text-start">
                              <span className="font-black text-slate-900 text-xs leading-none">{eng.fullName}</span>
                              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{eng.jobTitle}</span>
                           </div>
                        </div>
                     </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string, sIdx: number) => (
                  <tr key={slot} className={cn("group/row", sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/10")}>
                     <td className="p-4 text-center border-b-2 border-slate-200 border-e-2 border-e-slate-200 font-mono font-black text-slate-500 bg-slate-100/50 text-[10px]">{slot}</td>
                     {visibleEngineers.map((eng: Employee) => {
                        const appt = grid.get(eng.id)?.get(slot);
                        const block = getBlockedReason(eng.id!, slot);

                        if (block) {
                           return (
                             <td key={eng.id} className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 bg-slate-50/50">
                                <div className="h-full flex items-center justify-center gap-2 text-[8px] font-black text-slate-300 uppercase italic opacity-60">
                                   {block.type === 'leave' && <Plane className="h-2.5 w-2.5" />}
                                   {block.type === 'permission' && <Timer className="h-2.5 w-2.5" />}
                                   {block.type === 'absent' && <Ban className="h-2.5 w-2.5" />}
                                   {block.label}
                                </div>
                           </td>
                           );
                        }

                        if (appt) {
                           const m = meta.get(appt.id);
                           const isBusy = appt.type === 'busy_blocked';

                           return (
                             <td key={eng.id} className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 align-top relative">
                                <Card 
                                  onClick={() => !isBusy && router.push(`/dashboard/appointments/${appt.id}`)}
                                  className={cn(
                                    "border-2 p-3 rounded-xl h-full shadow-lg relative group/card cursor-pointer transition-all hover:ring-4 hover:ring-primary/5", 
                                    cardGradient(m?.color || '')
                                  )}
                                >
                                   <div className={cn("absolute top-1 z-10", isRtl ? "left-1" : "right-1")} onClick={e => e.stopPropagation()}>
                                      <DropdownMenu>
                                         <DropdownMenuTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-6 w-6 rounded-full bg-white/80 hover:bg-white text-slate-900 border shadow-sm flex items-center justify-center"
                                            >
                                               <MoreVertical className="h-3 w-3" />
                                            </Button>
                                         </DropdownMenuTrigger>
                                         <DropdownMenuPortal>
                                            <DropdownMenuContent align={isRtl ? "start" : "end"} className="rounded-xl border-2 shadow-3xl bg-white min-w-[150px] z-[150]">
                                               <DropdownMenuItem onClick={() => router.push(`/dashboard/appointments/${appt.id}`)} className="font-bold gap-2 py-2 text-[10px]">
                                                  <MessageSquare className="h-3 w-3 text-primary" /> {isRtl ? 'غرفة العمليات' : 'War Room'}
                                               </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => onAction('edit', eng, slot, appt)} className="font-bold gap-2 py-2 text-[10px]">
                                                  <Edit3 className="h-3 w-3 text-blue-500" /> {isRtl ? 'تعديل' : 'Edit'}
                                               </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleCancelAppt(appt.id!)} className="font-bold gap-2 py-2 text-[10px]">
                                                  <CalendarX className="h-3 w-3 text-orange-500" /> {isRtl ? 'إلغاء' : 'Cancel'}
                                               </DropdownMenuItem>
                                               <DropdownMenuSeparator />
                                               <DropdownMenuItem onClick={() => handleDeleteAppt(appt.id!)} className="font-bold gap-2 py-2 text-[10px] text-rose-600">
                                                  <Trash2 className="h-3 w-3" /> {isRtl ? 'حذف' : 'Delete'}
                                               </DropdownMenuItem>
                                            </DropdownMenuContent>
                                         </DropdownMenuPortal>
                                      </DropdownMenu>
                                   </div>

                                   <div className={cn("text-start", isRtl ? "pr-1 pl-5" : "pl-1 pr-5")}>
                                      <p className="font-black text-[10px] leading-tight mb-0.5 truncate">{isBusy ? (isRtl ? 'مشغول' : 'Busy') : appt.clientName}</p>
                                      {!isBusy && (
                                        <div className="flex items-center gap-1 text-[7px] font-black uppercase opacity-60">
                                           <MapPin className="h-2 w-2" /> {appt.governorateName || '---'}
                                        </div>
                                      )}
                                      {appt.transactionNumber && (
                                        <div className="flex items-center gap-1 text-[6px] font-black text-primary mt-1 uppercase">
                                           <Workflow className="h-2 w-2" /> {appt.transactionNumber}
                                        </div>
                                      )}
                                   </div>
                                   
                                   {!isBusy && (
                                     <div className="mt-2 flex items-center justify-between px-1">
                                        <Badge className="bg-white/40 text-inherit border-0 font-black text-[7px] h-4 px-1.5 rounded shadow-sm">V {m?.visitCount}</Badge>
                                        {appt.transactionId && <LinkIcon className="h-2.5 w-2.5 opacity-30 text-inherit" />}
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
                            className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 group-hover/row:bg-primary/[0.03] transition-colors cursor-pointer"
                          >
                             <div className="h-10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                   <Plus className="h-3 w-3" />
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
  const { dir, lang, t } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [isBusyBlock, setIsBusyBlock] = useState(false);

  const [formData, setFormData] = useState({
    title: '', clientId: '', clientName: '', 
    newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', 
    transactionId: '', transactionNumber: '', stageId: '', stageName: '',
    date: '', time: '', notes: ''
  });

  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [transactionStages, setTransactionStages] = useState<any[]>([]);

  const targetEngineerId = data?.engineer?.id || data?.appointment?.engineerId;
  
  const filteredClients = useMemo(() => {
    let list = clients || [];
    if (targetEngineerId) {
      list = list.filter((c: any) => c.assignedEngineerId === targetEngineerId);
    }
    return list;
  }, [clients, targetEngineerId]);

  useEffect(() => {
    if (!isOpen) {
       setFormData({
         title: '', clientId: '', clientName: '', 
         newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', 
         transactionId: '', transactionNumber: '', stageId: '', stageName: '',
         date: '', time: '', notes: ''
       });
       setIsNewClient(false);
       setIsBusyBlock(false);
       setClientTransactions([]);
       setTransactionStages([]);
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
      
      if (data.appointment?.clientId) {
         fetchClientTransactions(data.appointment.clientId);
      }
      if (data.appointment?.transactionId) {
         fetchTransactionStages(data.appointment.transactionId);
      }
    }
  }, [isOpen, data]);

  const fetchClientTransactions = async (cid: string) => {
    if (!db || !companyId) return;
    const q = query(collection(db, paths.transactions(companyId)), where('clientId', '==', cid));
    const snap = await getDocs(q);
    setClientTransactions(snap.docs.map(d => ({id: d.id, ...d.data()})));
  };

  const fetchTransactionStages = async (tid: string) => {
    if (!db || !companyId) return;
    const q = query(collection(db, paths.transactionStages(companyId, tid)), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    setTransactionStages(snap.docs.map(d => ({id: d.id, ...d.data()})));
  };

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
      <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg flex flex-col h-fit max-h-[85vh] z-[101]" dir={dir}>
        
        <div className="bg-slate-50 p-6 text-slate-900 text-start border-b shrink-0 relative pr-12 pl-12">
           <DialogTitle className="text-lg font-black font-headline truncate flex items-center gap-3">
              {data?.mode === 'create' ? <PlusCircle className="h-5 w-5 text-primary" /> : <Edit3 className="h-5 w-5 text-primary" />}
              {data?.mode === 'create' ? (isRtl ? 'حجز موعد تصميم' : 'Book Design Appt') : (isRtl ? 'تعديل موعد' : 'Edit')}
           </DialogTitle>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-start scrollbar-hide">
           {data?.mode === 'create' && (
             <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                  isNewClient ? "bg-primary/5 border-primary/20" : "bg-white border-slate-100"
                )}>
                   <Label className="text-[10px] font-black text-slate-400">جديد؟</Label>
                   <Switch checked={isNewClient} onCheckedChange={v => { setIsNewClient(v); if(v) setIsBusyBlock(false); }} className="scale-75" />
                </div>
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                  isBusyBlock ? "bg-slate-900 text-white border-primary" : "bg-white border-slate-100"
                )}>
                   <Label className="text-[10px] font-black text-primary">Busy</Label>
                   <Switch checked={isBusyBlock} onCheckedChange={v => { setIsBusyBlock(v); if(v) setIsNewClient(false); }} className="scale-75" />
                </div>
             </div>
           )}

           {!isBusyBlock && (
             <div className="space-y-4">
                {isNewClient ? (
                   <div className="space-y-4 p-5 rounded-2xl border bg-slate-50/50 animate-in fade-in">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-slate-400">اسم العميل</Label>
                         <Input value={formData.newClientName} onChange={e => setFormData({...formData, newClientName: e.target.value})} className="h-10 rounded-lg border-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400">الهاتف</Label>
                            <Input value={formData.newClientPhone} onChange={e => setFormData({...formData, newClientPhone: e.target.value})} className="h-10 rounded-lg border-2" />
                         </div>
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400">المحافظة</Label>
                            <Select value={formData.newClientGovId} onValueChange={v => setFormData({...formData, newClientGovId: v})}>
                               <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                               <SelectContent className="rounded-xl border shadow-2xl z-[150]">
                                  {governorates?.map((g: any) => <SelectItem key={g.id} value={g.id} className="font-bold text-xs">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">اختيار العميل</Label>
                         <Select value={formData.clientId} onValueChange={v => {
                           const c = filteredClients.find((x:any) => x.id === v);
                           setFormData({...formData, clientId: v, clientName: c?.nameAr || '', transactionId: '', transactionNumber: '', stageId: '', stageName: ''});
                           if (v) fetchClientTransactions(v);
                         }}>
                            <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white">
                               <SelectValue placeholder={isRtl ? "تحديد العميل من القائمة..." : "Choose client..."} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border shadow-3xl max-h-[300px] z-[150]">
                               {filteredClients.map((c: any) => (
                                 <SelectItem key={c.id} value={c.id!} className="font-bold text-[11px] py-2">
                                    {c.nameAr}
                                 </SelectItem>
                               ))}
                            </SelectContent>
                         </Select>
                      </div>

                      {formData.clientId && (
                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                           <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-primary flex items-center gap-1"><Workflow className="h-2.5 w-2.5" /> ربط بالمشروع</Label>
                              <Select value={formData.transactionId} onValueChange={v => {
                                 const t = clientTransactions.find(x => x.id === v);
                                 setFormData({...formData, transactionId: v, transactionNumber: t?.transactionNumber || '', stageId: '', stageName: ''});
                                 if (v) fetchTransactionStages(v);
                              }}>
                                 <SelectTrigger className="h-10 rounded-lg border-2 font-bold text-[10px] bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                                 <SelectContent className="rounded-xl z-[151]">
                                    {clientTransactions.map(t => <SelectItem key={t.id} value={t.id} className="font-bold text-[10px]">{t.subServiceName} ({t.transactionNumber})</SelectItem>)}
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> المرحلة الفنية</Label>
                              <Select disabled={!formData.transactionId} value={formData.stageId} onValueChange={v => {
                                 const s = transactionStages.find(x => x.id === v);
                                 setFormData({...formData, stageId: v, stageName: s?.name || ''});
                              }}>
                                 <SelectTrigger className="h-10 rounded-lg border-2 font-bold text-[10px] bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                                 <SelectContent className="rounded-xl z-[151]">
                                    {transactionStages.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-[10px]">{s.name}</SelectItem>)}
                                 </SelectContent>
                              </Select>
                           </div>
                        </div>
                      )}
                   </div>
                )}
             </div>
           )}

           <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">غرض الموعد</Label>
              <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-10 rounded-lg border-2 font-bold" />
           </div>

           <div className="space-y-1.5">
              <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">توجيهات فنية</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="min-h-[100px] rounded-xl border-2 bg-slate-50/30 p-4 text-xs font-bold" />
           </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 shrink-0 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
           <Button variant="outline" onClick={onClose} className="flex-1 h-10 rounded-lg font-bold border-2 bg-white">
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button onClick={handleSave} disabled={loading || (!isBusyBlock && !formData.clientId)} className="flex-[2] h-10 rounded-lg font-black gap-2">
              {loading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {isRtl ? 'حفظ الموعد' : 'Confirm'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

