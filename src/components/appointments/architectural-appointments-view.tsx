'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  format, 
  isSameDay, 
  parseISO, 
  addDays, 
  subDays, 
  parse, 
  isBefore, 
  startOfDay,
  addMinutes
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
  Users, 
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
  Workflow, 
  Target, 
  LayoutGrid, 
  AlertTriangle, 
  AlertCircle, 
  ArrowRight, 
  ShieldAlert, 
  Eye,
  ShieldX,
  User,
  Search,
  Check,
  ChevronDown
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, updateDoc, deleteDoc, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { WorkHoursService } from '@/services/work-hours-service';
import * as WorkHoursEngine from '@/services/work-hours-engine';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { AppointmentService } from '@/services/appointment-service';
import { ClientService } from '@/services/client-service';
import { Employee, LeaveRequest, PermissionRequest, AttendanceRecord } from '@/types/hr';
import { DayOfWeek, WorkHoursSettings } from '@/types/work-hours';
import { Governorate, Department } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useRouter } from 'next/navigation';
import { StageInstance } from '@/types/transaction';

function getVisitColor(visitCount: number, status?: string, apptType?: string, apptStatus?: string): string {
  if (apptStatus === 'completed') return '#10b981'; 
  if (apptType === 'busy_blocked') return '#f57c00'; 
  if (visitCount === 1) return '#facc15'; 
  if (visitCount > 1 && status !== 'contracted') return '#22c55e'; 
  if (visitCount > 1 && status === 'contracted') return '#3b82f6'; 
  return '#9ca3af'; 
}

function cardGradient(color: string, isCompleted: boolean) {
  if (isCompleted) return "bg-emerald-50/50 border-emerald-500/30 text-emerald-900 shadow-sm ring-1 ring-emerald-500/10";
  if (color === '#facc15') return "bg-yellow-50 border-yellow-200 text-yellow-900 shadow-sm";
  if (color === '#22c55e') return "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm";
  if (color === '#3b82f6') return "bg-blue-50 border-blue-200 text-blue-900 shadow-sm";
  if (color === '#f57c00') return "bg-primary/5 border-primary/20 text-primary border-dashed shadow-none";
  return "bg-slate-50 border-slate-200 text-slate-900";
}

type ApptMeta = { visitCount: number; status: string; color: string };

function computeMeta(list: Appointment[], clients: Map<string, any>): Map<string, ApptMeta> {
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
      out.set(a.id!, { 
        visitCount: vc, 
        status: clientStatus, 
        color: getVisitColor(vc, clientStatus, a.type, a.status) 
      });
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
  const [dialogData, setDialogData] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const apptsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.appointments(companyId)), orderBy('start', 'asc'));
  }, [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);

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
  const { data: allClients, loading: clientsLoading } = useCollection<any>(clientsQuery);
  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: departments } = useCollection<Department>(deptsQuery);
  
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
    const list = (allEmployees || []).filter(e => 
      e.departmentName?.includes('معماري') || 
      e.departmentName?.includes('Arch') ||
      e.jobTitle?.includes('معماري') ||
      e.jobTitle?.includes('Arch')
    );
    
    if (!isAdmin && globalUser?.employeeId) {
       return list.filter(e => e.id === globalUser.employeeId);
    }
    return list;
  }, [allEmployees, isAdmin, globalUser]);

  const clientsMap = useMemo(() => {
    const m = new Map<string, any>();
    (allClients || []).forEach(c => { if (c.id) m.set(c.id, c); });
    return m;
  }, [allClients]);

  const filteredAppointments = useMemo(() => {
    let list = (rawAppointments || []).filter(a => 
      a.status !== 'cancelled' && 
      a.type !== 'hall_meeting' && 
      isSameDay(parseISO(a.start), currentDate)
    );
    const archIds = archEngineers.map(e => e.id);
    list = list.filter(a => archIds.includes(a.engineerId));
    return list;
  }, [rawAppointments, currentDate, archEngineers]);

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
    const result = WorkHoursEngine.buildDaySlots(currentDate, settings, 'architectural');
    return {
      morning: result.morningSlots,
      evening: result.eveningSlots
    };
  }, [settings, currentDate]);

  const engineerAppointmentsMap = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    archEngineers.forEach(eng => {
      map.set(eng.id!, filteredAppointments.filter(a => a.engineerId === eng.id));
    });
    return map;
  }, [archEngineers, filteredAppointments]);

  const handleAction = (mode: 'create' | 'edit', eng?: Employee, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, engineer: eng, slot, appointment: appt });
    setDialogOpen(true);
  };

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
       document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  const confirmDelete = async (id?: string) => {
     const targetId = id || deletingId;
     if (!targetId || !db || !companyId) return;
     const service = new AppointmentService(db, companyId);
     try {
        await service.deleteAppointment(targetId);
        toast({ title: isRtl ? "تم الحذف بنجاح" : "Deleted Successfully" });
        setDeletingId(null);
        setDialogOpen(false);
        forceThaw();
     } catch (e) {
        toast({ variant: "destructive", title: t('error') });
     }
  };

  if (!mounted || apptsLoading || empsLoading || clientsLoading || !settings || !user) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 print:space-y-1 print:pt-0" dir={dir}>
      
      <div className="flex justify-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))} className="h-10 w-10 rounded-xl bg-white shadow-sm border-2 border-slate-100 text-slate-400 hover:text-primary"><ChevronLeft className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
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
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} className="h-10 w-10 rounded-xl bg-white shadow-sm border-2 border-slate-100 text-slate-400 hover:text-primary"><ChevronRight className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:gap-1">
         {[
           { label: isRtl ? 'إجمالي اليوم' : 'Total', val: stats.total, color: 'text-slate-900', b: 'border-b-slate-900' },
           { label: isRtl ? 'زيارة أولى' : 'New', val: stats.yellow, color: 'text-yellow-600', b: 'border-b-yellow-400' },
           { label: isRtl ? 'متابعة' : 'Follow', val: stats.green, color: 'text-emerald-600', b: 'border-b-emerald-500' },
           { label: isRtl ? 'متعاقدون' : 'Contracted', val: stats.blue, color: 'text-blue-600', b: 'border-b-blue-500' },
         ].map((s, i) => (
           <Card key={i} className={cn("border-0 shadow-md rounded-xl bg-white border-b-4 print:shadow-none print:border-b-2", s.b)}>
              <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
                 <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{s.label}</p>
                 <h3 className={cn("text-xl print:text-xs font-black", s.color)} style={{ fontVariantNumeric: 'tabular-nums' }}>{s.val.toLocaleString('en-US')}</h3>
              </CardContent>
           </Card>
         ))}
      </div>

      <div className="space-y-8 pb-10 print:pb-0 print:space-y-4">
         <GridSection 
           title={isRtl ? "الفترة الصباحية ☀️" : "Morning Session"} 
           slots={timeSlots.morning} 
           engineers={archEngineers} 
           gridMap={engineerAppointmentsMap} 
           meta={apptMeta} 
           onAction={handleAction}
           onDelete={confirmDelete}
           isRtl={isRtl}
           isAdmin={isAdmin}
           currentEngineerId={globalUser?.employeeId}
           leaves={approvedLeaves}
           permissions={approvedPermissions}
           absences={dailyAbsences}
           dateStr={dateStr}
           router={router}
           t={t}
           settings={settings}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة المسائية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={archEngineers} 
             gridMap={engineerAppointmentsMap} 
             meta={apptMeta} 
             onAction={handleAction}
             onDelete={confirmDelete}
             isRtl={isRtl}
             isAdmin={isAdmin}
             currentEngineerId={globalUser?.employeeId}
             leaves={approvedLeaves}
             permissions={approvedPermissions}
             absences={dailyAbsences}
             dateStr={dateStr}
             router={router}
             t={t}
             settings={settings}
           />
         )}
      </div>

      {user && (
        <AppointmentManagerDialog 
          isOpen={dialogOpen} 
          onClose={() => { setDialogOpen(false); forceThaw(); }} 
          data={dialogData} 
          clients={allClients || []}
          governorates={governorates || []}
          departments={departments || []}
          companyId={companyId!}
          userId={user.uid}
          userName={user.displayName || user.email || 'User'}
          db={db}
          settings={settings}
          onDelete={confirmDelete}
          existingAppts={rawAppointments || []}
          employees={allEmployees || []}
          archEngineers={archEngineers}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if(!v) setDeletingId(null); forceThaw(); }}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <Trash2 className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{isRtl ? 'حذف الموعد نهائياً' : 'Permanent Deletion'}</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg">
                  {isRtl ? 'هل أنت متأكد؟ سيتم إزالة هذا الموعد من كافة التقارير والرادار الزمني ولا يمكن التراجع.' : 'Are you sure? This appointment will be removed from all reports and radar. Action cannot be undone.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white" onClick={() => { setDeletingId(null); forceThaw(); }}>إلغاء</AlertDialogCancel>
               <AlertDialogAction onClick={() => confirmDelete()} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl">
                  {isRtl ? 'نعم، احذف الموعد' : 'Confirm Delete'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GridSection({ title, slots, engineers, gridMap, meta, onAction, onDelete, isRtl, isAdmin, currentEngineerId, leaves, permissions, absences, dateStr, router, t, settings }: any) {
  if (slots.length === 0) return null;
  
  const visibleEngineers = isAdmin ? engineers : engineers.filter((e: any) => e.id === currentEngineerId);

  const getBlockedReason = (engId: string, slotTime: string) => {
     const leave = leaves?.find((l: any) => l.employeeId === engId && dateStr >= l.startDate && dateStr <= l.endDate);
     if (leave) return { type: 'leave', label: isRtl ? 'إجازة' : 'Leave' };

     const absence = absences?.find((a: any) => a.employeeId === engId);
     if (absence) return { type: 'absent', label: isRtl ? 'غائب' : 'Absent' };

     const perm = permissions?.find((p: any) => {
        if (p.userId !== engId) return false;
        const slot = parse(slotTime, 'HH:mm', new Date());
        const pStart = parse(p.startTime, 'HH:mm', new Date());
        const pEnd = parse(p.endTime, 'HH:mm', new Date());
        return slot >= pStart && slot < pEnd;
     });
     if (perm) return { type: 'permission', label: isRtl ? 'استئذان' : 'Perm' };

     return null;
  };

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
                   {visibleEngineers.map((eng: Employee) => {
                      const engAppts = gridMap.get(eng.id!) || [];
                      let v1 = 0, follow = 0, cont = 0;
                      engAppts.forEach((a: Appointment) => {
                         const m = meta.get(a.id);
                         if (m?.color === '#facc15') v1++;
                         else if (m?.color === '#22c55e') follow++;
                         else if (m?.color === '#3b82f6') cont++;
                      });

                      return (
                        <th key={eng.id} className="p-3 border-b border-slate-100 border-s border-s-slate-50 min-w-[180px] print:p-1">
                           <div className="flex flex-col items-center text-center">
                              <Avatar className="h-10 w-10 rounded-2xl shrink-0 print:h-6 print:w-6 mb-2 border-2 border-white shadow-md ring-1 ring-slate-100">
                                 <AvatarImage src={`https://picsum.photos/seed/${eng.id}/40/40`} />
                                 <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{eng.fullName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="text-center w-full">
                                 <span className="font-black text-slate-800 text-[11px] leading-none block truncate">{eng.fullName}</span>
                                 <div className="flex justify-center gap-1 mt-2">
                                    <Badge className="bg-yellow-50 text-yellow-600 text-[8px] font-black h-4 px-1.5 border-0 shadow-sm">{v1}</Badge>
                                    <Badge className="bg-emerald-50 text-emerald-600 text-[8px] font-black h-4 px-1.5 border-0 shadow-sm">{follow}</Badge>
                                    <Badge className="bg-blue-50 text-blue-600 text-[8px] font-black h-4 px-1.5 border-0 shadow-sm">{cont}</Badge>
                                 </div>
                              </div>
                           </div>
                        </th>
                      );
                   })}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string) => {
                  const slotStart = parse(`${dateStr} ${slot}`, 'yyyy-MM-dd HH:mm', new Date());
                  const slotEnd = addMinutes(slotStart, settings?.architectural?.slotDurationMinutes || 60);

                  return (
                    <tr key={slot} className="group/row">
                       <td className="p-3 text-center border-b border-slate-50 border-e border-e-slate-50 font-mono font-black text-slate-300 text-[10px] bg-slate-50/20">{slot}</td>
                       {visibleEngineers.map((eng: Employee) => {
                          const engAppts = gridMap.get(eng.id!) || [];
                          const appt = engAppts.find((a: any) => {
                             const apptStart = parseISO(a.start);
                             const apptEnd = a.end 
                               ? parseISO(a.end) 
                               : addMinutes(apptStart, settings?.architectural?.slotDurationMinutes || 60);
                             
                             return apptStart < slotEnd && slotStart < apptEnd;
                          });
                          
                          const block = getBlockedReason(eng.id!, slot);

                          if (block) {
                             return (
                               <td key={eng.id} className="p-0.5 border-b border-slate-50 border-s border-s-slate-50">
                                  <div className="h-full flex items-center justify-center gap-1.5 text-[8px] font-black text-slate-300 uppercase italic opacity-40">
                                     {block.label}
                                  </div>
                             </td>
                             );
                          }

                          if (appt) {
                             const m = meta.get(appt.id);
                             const isBusy = appt.type === 'busy_blocked';
                             const isCompleted = appt.status === 'completed';
                             const apptStart = parseISO(appt.start);
                             const isStartSlot = apptStart >= slotStart && apptStart < slotEnd;

                             return (
                               <td key={eng.id} className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 align-top">
                                  <div className="relative h-full">
                                    <Card 
                                      onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}
                                      className={cn(
                                        "p-2 rounded-xl h-full transition-all cursor-pointer print:p-1 min-h-[44px] shadow-sm", 
                                        cardGradient(m?.color || '', isCompleted)
                                      )}
                                    >
                                      <div className="text-start relative pr-6 space-y-1">
                                          {isStartSlot && (
                                            <div className="flex items-center gap-1.5">
                                              {isCompleted ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" /> : <Badge className="h-3.5 px-1 bg-black/5 text-[7px] font-black border-0">V{m?.visitCount}</Badge>}
                                              <p className={cn("font-black text-[9px] leading-tight truncate", isCompleted ? "text-emerald-900" : "text-slate-900")}>
                                                {isBusy ? (isRtl ? 'مشغول' : 'BUSY') : appt.clientName}
                                              </p>
                                            </div>
                                          )}
                                          {!isBusy && isStartSlot && (
                                            <div className="flex items-center gap-1 text-[7px] font-bold opacity-60">
                                              <MapPin className="h-2.5 w-2.5" /> {appt.governorateName?.slice(0, 10)}
                                            </div>
                                          )}
                                      </div>
                                    </Card>

                                    {isStartSlot && (
                                      <div className="absolute top-1 right-1 print:hidden" onClick={e => e.stopPropagation()}>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md hover:bg-black/5">
                                              <MoreVertical className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent className="rounded-xl border-2 shadow-2xl" align="end">
                                            <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}>
                                              <Eye className="h-3.5 w-3.5" /> {isRtl ? 'عرض الرادار' : 'View Radar'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => onAction('edit', eng, slot, appt)}>
                                              <Edit3 className="h-3.5 w-3.5" /> {isRtl ? 'تعديل Booking' : 'Edit Booking'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="font-black text-xs gap-2 text-rose-600" onClick={() => onDelete(appt.id)}>
                                              <Trash2 className="h-3.5 w-3.5" /> {isRtl ? 'حذف' : 'Delete'}
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    )}
                                  </div>
                               </td>
                             );
                          }
                          return (
                            <td 
                              key={eng.id} 
                              onClick={() => onAction('create', eng, slot)}
                              className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 group-hover/row:bg-primary/[0.02] cursor-pointer"
                            >
                               <div className="h-6 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <Plus className="h-3 w-3 text-primary/30" />
                                </div>
                            </td>
                          );
                       })}
                    </tr>
                  );
                })}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function AppointmentManagerDialog({ isOpen, onClose, data, clients, governorates, departments, companyId, userId, userName, db, settings, onDelete, existingAppts, employees, archEngineers }: any) {
  const { dir, lang, t } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [isBusyBlock, setIsBusyBlock] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [openClientPicker, setOpenClientPicker] = useState(false);

  const [formData, setFormData] = useState({
    title: '', clientId: '', clientName: '', departmentId: '', departmentName: '',
    newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', 
    transactionId: '', transactionNumber: '',
    date: '', time: '', notes: '',
    endTime: '' 
  });

  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [eligibilityBlocker, setEligibilityBlocker] = useState<string | null>(null);

  const targetEngineerId = data?.engineer?.id || data?.appointment?.engineerId;

  const filteredDepartments = useMemo(() => {
     return (departments || []).filter((d: any) => {
        const nAr = d.name || '';
        const nEn = d.nameEn || '';
        return nAr.includes('معماري') || nEn.toLowerCase().includes('arch');
     });
  }, [departments]);

  const isSelectedDateHoliday = useMemo(() => {
     if (!settings || !formData.date) return false;
     return WorkHoursEngine.isHoliday(parseISO(formData.date), settings);
  }, [settings, formData.date]);
  
  const filteredClients = useMemo(() => {
    let list = clients || [];
    if (targetEngineerId) {
      list = list.filter((c: any) => c.assignedEngineerId === targetEngineerId);
    }
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      list = list.filter((c: any) => c.nameAr?.toLowerCase().includes(q) || c.mobile?.includes(q) || c.fileNumber?.includes(q));
    }
    return list;
  }, [clients, targetEngineerId, clientSearch]);

  useEffect(() => {
    if (!isOpen) {
       setFormData({
         title: '', clientId: '', clientName: '', departmentId: '', departmentName: '',
         newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', 
         transactionId: '', transactionNumber: '',
         date: '', time: '', notes: '',
         endTime: ''
       });
       setIsNewClient(false);
       setIsBusyBlock(false);
       setClientTransactions([]);
       setEligibilityBlocker(null);
       setClientSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && data) {
      const startTime = data.slot || (data.appointment ? format(parseISO(data.appointment.start), 'HH:mm') : '08:00');
      
      setFormData(prev => ({
        ...prev,
        title: data.appointment?.title || '',
        clientId: data.appointment?.clientId || '',
        clientName: data.appointment?.clientName || '',
        departmentId: data.appointment?.departmentId || '',
        departmentName: data.appointment?.departmentName || '',
        transactionId: data.appointment?.transactionId || '',
        transactionNumber: data.appointment?.transactionNumber || '',
        date: data.appointment ? format(parseISO(data.appointment.start), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        time: startTime,
        notes: data.appointment?.notes || '',
        endTime: data.appointment?.end ? format(parseISO(data.appointment.end), 'HH:mm') : ''
      }));
      setIsBusyBlock(data.appointment?.type === 'busy_blocked');
      
      if (data.appointment?.clientId) {
         fetchClientTransactions(data.appointment.clientId);
      }
    }
  }, [isOpen, data]);

  const checkEligibility = async (transId: string, deptId: string) => {
    if (!db || !companyId || !transId || !deptId) {
      setEligibilityBlocker(null);
      return;
    }
    setEligibilityLoading(true);
    try {
      const stagesSnap = await getDocs(query(collection(db, paths.transactionStages(companyId, transId)), orderBy('order')));
      const allStages = stagesSnap.docs.map(d => d.data() as StageInstance);
      const deptStages = allStages.filter(s => s.allowedDepartmentIds?.includes(deptId));

      if (deptStages.length > 0) {
        const firstDeptOrder = deptStages[0].order;
        const previousIncomplete = allStages.find(s => s.order < firstDeptOrder && s.status !== 'completed');
        if (previousIncomplete) {
          setEligibilityBlocker(previousIncomplete.name);
        } else {
          setEligibilityBlocker(null);
        }
      } else {
        setEligibilityBlocker(null);
      }
    } finally {
      setEligibilityLoading(false);
    }
  };

  useEffect(() => {
    if (formData.transactionId && formData.departmentId) {
      checkEligibility(formData.transactionId, formData.departmentId);
    } else {
      setEligibilityBlocker(null);
    }
  }, [formData.transactionId, formData.departmentId]);

  const fetchClientTransactions = async (cid: string) => {
    if (!db || !companyId) return;
    const q = query(collection(db, paths.transactions(companyId)), where('clientId', '==', cid));
    const snap = await getDocs(q);
    const trans = snap.docs.map(d => ({id: d.id, ...d.data()}));
    setClientTransactions(trans);

    if (!formData.transactionId && trans.length === 1) {
       const t = trans[0];
       setFormData(prev => ({ ...prev, transactionId: t.id, transactionNumber: t.transactionNumber }));
    }
  };

  const handleSave = async () => {
    if (!data || isSelectedDateHoliday || eligibilityBlocker) return;
    
    const start = new Date(`${formData.date}T${formData.time}:00`);
    const duration = settings?.architectural?.slotDurationMinutes || 60;
    const end = formData.endTime 
      ? new Date(`${formData.date}T${formData.endTime}:00`)
      : addMinutes(start, duration);
    
    const targetClientId = isNewClient ? 'NEW_CLIENT' : formData.clientId;
    
    for (const appt of existingAppts) {
        if (appt.status === 'cancelled' || appt.id === data.appointment?.id) continue;
        
        const apptStart = new Date(appt.start);
        const apptEnd = appt.end 
          ? new Date(appt.end) 
          : addMinutes(apptStart, settings?.architectural?.slotDurationMinutes || 60);

        const isOverlapping = start < apptEnd && apptStart < end;

        if (isOverlapping) {
            if (appt.clientId === targetClientId && targetClientId !== 'NEW_CLIENT') {
               toast({ variant: "destructive", title: isRtl ? "تعارض للعميل" : "Client Conflict" });
               return;
            }

            const apptEngineers = [appt.engineerId, ...(appt.additionalEngineerIds || [])];
            if (apptEngineers.includes(targetEngineerId)) {
               toast({ variant: "destructive", title: isRtl ? "تعارض للمهندس" : "Engineer Conflict" });
               return;
            }
        }
    }

    setLoading(true);
    try {
      const appService = new AppointmentService(db, companyId);
      const clientService = new ClientService(db, companyId);
      
      let finalClientId = formData.clientId;
      let finalClientName = formData.clientName;
      let apptType: any = 'site_visit';

      if (isBusyBlock) {
         apptType = 'busy_blocked';
         finalClientId = 'SYSTEM_BLOCK';
         finalClientName = isRtl ? 'مشغول' : 'BUSY';
      } else if (data.mode === 'create' && isNewClient) {
        const gov = governorates?.find((g: any) => g.id === formData.newClientGovId);
        const nextFileNum = await clientService.getNextFileNumber();
        
        finalClientId = await clientService.addClient({
          nameAr: formData.newClientName,
          mobile: formData.newClientPhone,
          governorateId: formData.newClientGovId,
          governorateName: gov ? (isRtl ? gov.name : gov.nameEn) : '',
          fileNumber: nextFileNum,
          status: 'new',
          assignedEngineerId: targetEngineerId,
          assignedEngineerName: data.engineer?.fullName || data.appointment?.engineerName
        }, userId, userName);
        finalClientName = formData.newClientName;
      }

      const selectedDept = filteredDepartments.find((d: any) => d.id === formData.departmentId);

      const savePayload = {
        title: formData.title || (isBusyBlock ? (isRtl ? 'مشغول' : 'BUSY') : (isRtl ? 'زيارة ميدانية' : 'Site Visit')),
        clientId: finalClientId,
        clientName: finalClientName,
        departmentId: formData.departmentId,
        departmentName: selectedDept?.name || '',
        transactionId: formData.transactionId,
        transactionNumber: formData.transactionNumber,
        engineerId: targetEngineerId,
        engineerName: data.engineer?.fullName || data.appointment?.engineerName,
        type: apptType,
        start: start.toISOString(),
        end: end.toISOString(),
        status: 'scheduled' as AppointmentStatus,
        companyId,
        notes: formData.notes
      };

      if (data.mode === 'create') {
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

  const isEdit = data?.mode === 'edit';

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if(!v) onClose(); }}>
      <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg flex flex-col h-fit max-h-[90vh] z-[101]" dir={dir}>
        
        <div className="bg-slate-50/50 p-6 text-slate-900 text-start border-b shrink-0 relative">
           <DialogTitle className="text-lg font-black font-headline truncate flex items-center gap-3 text-slate-900">
              {isEdit ? <Edit3 className="h-5 w-5 text-primary" /> : <PlusCircle className="h-5 w-5 text-primary" />}
              {isEdit ? (isRtl ? 'تعديل بيانات الزيارة' : 'Edit Visit') : (isRtl ? 'حجز موعد ميداني جديد' : 'New Site Visit')}
           </DialogTitle>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-start scrollbar-hide bg-white">
           <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] shadow-sm relative overflow-hidden animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ الموعد المؤكد' : 'Confirmed Date'}</p>
                    <p className="text-xl font-black text-slate-900">{formData.date}</p>
                 </div>
                 <div className="text-end space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'وقت البدء' : 'Start Time'}</p>
                    <Badge className="bg-primary text-white font-black text-lg h-10 px-4 rounded-xl">{formData.time}</Badge>
                 </div>
              </div>
           </div>

           {!isEdit && (
             <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                  isNewClient ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-white border-slate-100"
                )}>
                   <Label className={cn("text-[10px] font-black uppercase tracking-tighter", isNewClient ? "text-primary" : "text-slate-400")}>{isRtl ? 'عميل جديد؟' : 'New Client?'}</Label>
                   <Switch checked={isNewClient} onCheckedChange={v => { setIsNewClient(v); if(v) setIsBusyBlock(false); }} className="scale-75" />
                </div>
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                  isBusyBlock ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-white border-slate-100"
                )}>
                   <Label className={cn("text-[10px] font-black uppercase tracking-tighter", isBusyBlock ? "text-primary" : "text-slate-400")}>TAGG/FREEZE</Label>
                   <Switch checked={isBusyBlock} onCheckedChange={v => { setIsBusyBlock(v); if(v) setIsNewClient(false); }} className="scale-75" />
                </div>
             </div>
           )}

           {!isBusyBlock && (
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" /> {isRtl ? 'القسم المختص بالزيارة' : 'Assign Department'}
                   </Label>
                   <Select value={formData.departmentId} onValueChange={v => setFormData({...formData, departmentId: v})}>
                      <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white">
                         <SelectValue placeholder={isRtl ? "تحديد التخصص المعماري..." : "Select arch specialty..."} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[150]">
                         {filteredDepartments?.map((d: any) => <SelectItem key={d.id} value={d.id!} className="font-bold text-xs">{isRtl ? d.name : d.nameEn}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>

                {isNewClient ? (
                   <div className="space-y-4 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/30 animate-in fade-in">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-slate-400">اسم العميل</Label>
                         <Input value={formData.newClientName} onChange={e => setFormData({...formData, newClientName: e.target.value})} className="h-10 rounded-lg border-2 font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400">الهاتف</Label>
                            <Input value={formData.newClientPhone} onChange={e => setFormData({...formData, newClientPhone: e.target.value})} className="h-10 rounded-lg border-2 font-bold" />
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
                         
                         <Popover open={openClientPicker} onOpenChange={setOpenClientPicker}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-11 rounded-xl border-2 font-bold justify-between bg-white px-4">
                                <span className="truncate">{formData.clientName || (isRtl ? "تحديد العميل..." : "Choose client...")}</span>
                                <ChevronDown className="h-4 w-4 opacity-30" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 rounded-2xl shadow-3xl border-2 z-[150]" align="start">
                               <div className="p-3 bg-slate-50 border-b">
                                  <div className="relative">
                                     <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                     <Input 
                                       placeholder={isRtl ? "بحث بالاسم أو الهاتف..." : "Search client..."}
                                       className="h-9 ps-9 rounded-lg border-2 bg-white text-xs font-bold"
                                       value={clientSearch}
                                       onChange={e => setClientSearch(e.target.value)}
                                     />
                                  </div>
                               </div>
                               <ScrollArea className="h-64">
                                  <div className="p-2 space-y-1">
                                     {filteredClients.map((c: any) => (
                                       <div 
                                         key={c.id} 
                                         onClick={() => {
                                           setFormData({...formData, clientId: c.id!, clientName: c.nameAr, transactionId: '', transactionNumber: ''});
                                           setOpenClientPicker(false);
                                           setClientSearch("");
                                           fetchClientTransactions(c.id!);
                                         }}
                                         className={cn(
                                           "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between",
                                           formData.clientId === c.id ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                                         )}
                                       >
                                          <div className="flex flex-col text-start">
                                             <span className="text-xs font-black">{c.nameAr}</span>
                                             <span className="text-[8px] font-mono text-slate-400 uppercase">{c.fileNumber} • {c.mobile}</span>
                                          </div>
                                          {formData.clientId === c.id && <Check className="h-3.5 w-3.5" />}
                                       </div>
                                     ))}
                                     {filteredClients.length === 0 && <div className="py-10 text-center text-[10px] text-slate-400 italic">No clients found.</div>}
                                  </div>
                               </ScrollArea>
                            </PopoverContent>
                         </Popover>
                      </div>

                      {formData.clientId && (
                        <div className="space-y-4 p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 animate-in slide-in-from-top-2">
                           <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-primary flex items-gap-1">
                                 <Workflow className="h-3 w-3" /> {isRtl ? 'ربط بالمسار الفني (المشروع)' : 'Link to Technical Path'}
                              </Label>
                              <Select value={formData.transactionId} onValueChange={v => {
                                 const t = clientTransactions.find(x => x.id === v);
                                 setFormData({...formData, transactionId: v, transactionNumber: t?.transactionNumber || ''});
                              }}>
                                 <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs bg-white shadow-sm">
                                    <SelectValue placeholder={isRtl ? "اختر المشروع المفتوح..." : "Select Project..."} />
                                 </SelectTrigger>
                                 <SelectContent className="rounded-xl z-[151]">
                                    {clientTransactions.map(t => (
                                       <SelectItem key={t.id} value={t.id} className="font-bold text-[11px] py-3">
                                          <div className="flex flex-col text-start">
                                             <span>{t.subServiceName}</span>
                                             <span className="text-[8px] text-slate-400 uppercase">#{t.transactionNumber}</span>
                                          </div>
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>

                           {eligibilityBlocker && (
                              <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-xl flex items-start gap-3 animate-in shake-in duration-300">
                                 <ShieldX className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                                 <div className="text-start">
                                    <p className="text-[10px] font-black text-rose-900 uppercase">قيد تسلسلي (Locked)</p>
                                    <p className="text-[9px] font-bold text-rose-700 leading-relaxed">
                                       {isRtl 
                                         ? `لا يمكن بدء أعمال هذا القسم قبل إنجاز مرحلة "${eligibilityBlocker}" السابقة.` 
                                         : `Cannot start work until "${eligibilityBlocker}" is completed.`}
                                    </p>
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
             </div>
           )}
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t flex flex-row gap-3 shrink-0 shadow-lg">
           <div className="flex-1 flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold border-2 bg-white">
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              {isEdit && (
                <Button 
                  variant="ghost" 
                  onClick={() => onDelete(data.appointment?.id)} 
                  className="flex-1 h-12 rounded-xl font-black text-rose-600 bg-rose-50 border-2 border-rose-100 gap-2 shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  {isRtl ? 'حذف' : 'Delete'}
                </Button>
              )}
           </div>
           <Button 
             onClick={handleSave} 
             disabled={loading || isSelectedDateHoliday || (!isBusyBlock && !formData.clientId) || !!eligibilityBlocker || eligibilityLoading} 
             className="flex-1 h-12 rounded-xl font-black gap-2 shadow-xl shadow-primary/20"
           >
              {loading || eligibilityLoading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {isRtl ? 'تأكيد' : 'Confirm'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
