
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  format, 
  isSameDay, 
  parseISO, 
  addDays,
  subDays,
  parse,
  addMinutes
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Hammer, 
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
  ShieldCheck, 
  CalendarX, 
  Plane, 
  Timer, 
  Ban, 
  MessageSquare, 
  Link as LinkIcon, 
  PlusCircle, 
  MoreVertical, 
  Workflow, 
  ShieldAlert, 
  Sun, 
  MoonStar, 
  HardHat, 
  Target, 
  CalendarDays,
  Eye
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, serverTimestamp } from 'firebase/firestore';
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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';

export function ConstructionBookingsView() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [settings, setSettings] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start', 'asc')) : null, 
  [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
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
  const { data: allClients } = useCollection<any>(clientsQuery);
  const { data: approvedLeaves } = useCollection<LeaveRequest>(leavesQuery);
  const { data: approvedPermissions } = useCollection<PermissionRequest>(permsQuery);
  const { data: dailyAbsences } = useCollection<AttendanceRecord>(attendanceQuery);

  const clientsMap = useMemo(() => {
    const m = new Map<string, any>();
    (allClients || []).forEach(c => { if (c.id) m.set(c.id, c); });
    return m;
  }, [allClients]);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const fieldEngineers = useMemo(() => {
    const list = (allEmployees || []).filter(e => 
      e.jobTitle?.includes('موقع') || 
      e.jobTitle?.includes('تنفيذ') || 
      e.departmentName?.includes('مقاولات') ||
      e.departmentName?.includes('Construction')
    );
    if (!isAdmin && globalUser?.employeeId) {
       return list.filter(e => e.id === globalUser.employeeId);
    }
    return list;
  }, [allEmployees, isAdmin, globalUser]);

  const filteredAppointments = useMemo(() => {
    let list = (rawAppointments || []).filter(a => 
      a.status !== 'cancelled' && 
      a.type !== 'hall_meeting' && 
      isSameDay(parseISO(a.start), currentDate)
    );
    
    const fieldIds = fieldEngineers.map(e => e.id);
    list = list.filter(a => fieldIds.includes(a.engineerId));

    return list;
  }, [rawAppointments, currentDate, fieldEngineers]);

  const computeMeta = (list: Appointment[]) => {
    const byClient = new Map<string, Appointment[]>();
    list.forEach(a => {
      if (!a.clientId || !a.id) return;
      const arr = byClient.get(a.clientId) || [];
      arr.push(a);
      byClient.set(a.clientId, arr);
    });
    const out = new Map<string, number>();
    byClient.forEach((arr) => {
      const sorted = [...arr].sort((x, y) => (x.start || '').localeCompare(y.start || ''));
      sorted.forEach((a, i) => { out.set(a.id!, i + 1); });
    });
    return out;
  };

  const apptVisitCounts = useMemo(() => computeMeta(rawAppointments || []), [rawAppointments]);

  const timeSlots = useMemo(() => {
    if (!settings) return { morning: [], evening: [] };
    const result = WorkHoursEngine.buildDaySlots(currentDate, settings, 'fieldWork');
    return {
      morning: result.morningSlots,
      evening: result.eveningSlots
    };
  }, [settings, currentDate]);

  const handleAction = (mode: 'create' | 'edit', eng?: Employee, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, engineer: eng, slot, appointment: appt });
    setDialogOpen(true);
  };

  if (!mounted || apptsLoading || empsLoading || !settings) return <div className="h-[40vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-700 print:space-y-1 print:pt-0" dir={dir}>
      
      <div className="flex justify-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))} className="h-9 w-9 rounded-md border text-slate-400"><ChevronLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} /></Button>
          <div className="flex gap-2">
            {[-1, 0, 1].map((offset) => {
              const d = addDays(currentDate, offset);
              const isActive = offset === 0;
              return (
                <Card 
                  key={offset}
                  onClick={() => setCurrentDate(d)}
                  className={cn(
                    "cursor-pointer transition-all border rounded-lg w-20 h-16 flex flex-col items-center justify-center text-center",
                    isActive ? "bg-primary border-primary shadow-md scale-105" : "bg-white border-slate-200 hover:border-primary/40"
                  )}
                >
                  <p className={cn("text-[8px] font-bold uppercase tracking-tight", isActive ? "text-white" : "text-slate-400")}>{format(d, 'EEEE', { locale: isRtl ? ar : enUS })}</p>
                  <p className={cn("text-lg font-bold", isActive ? "text-white" : "text-slate-900")}>{format(d, 'd')}</p>
                </Card>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} className="h-9 w-9 rounded-md border text-slate-400"><ChevronRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 print:gap-1">
         <Card className="rounded-lg shadow-sm border-slate-100 bg-white border-b-4 border-b-slate-500">
            <CardContent className="p-3 flex flex-col items-center justify-center h-14">
               <p className="text-[9px] font-bold text-slate-400 uppercase">{isRtl ? 'إجمالي اليوم' : 'Total'}</p>
               <h3 className="text-lg font-bold text-slate-900">{filteredAppointments.length}</h3>
            </CardContent>
         </Card>
         <Card className="rounded-lg shadow-sm border-slate-100 bg-white border-b-4 border-b-yellow-500">
            <CardContent className="p-3 flex flex-col items-center justify-center h-14">
               <p className="text-[9px] font-bold text-slate-400 uppercase">{isRtl ? 'قيد التنفيذ' : 'Active'}</p>
               <h3 className="text-lg font-bold text-yellow-600">{filteredAppointments.filter(a => a.status === 'scheduled').length}</h3>
            </CardContent>
         </Card>
         <Card className="rounded-lg shadow-sm border-slate-100 bg-white border-b-4 border-b-emerald-500">
            <CardContent className="p-3 flex flex-col items-center justify-center h-14">
               <p className="text-[9px] font-bold text-slate-400 uppercase">{isRtl ? 'مكتملة' : 'Done'}</p>
               <h3 className="text-lg font-bold text-emerald-600">{filteredAppointments.filter(a => a.status === 'completed').length}</h3>
            </CardContent>
         </Card>
         <Card className="rounded-lg shadow-sm border-slate-100 bg-white border-b-4 border-b-blue-500">
            <CardContent className="p-3 flex flex-col items-center justify-center h-14">
               <p className="text-[9px] font-bold text-slate-400 uppercase">{isRtl ? 'المهندسين' : 'Engineers'}</p>
               <h3 className="text-lg font-bold text-blue-600">{fieldEngineers.length}</h3>
            </CardContent>
         </Card>
      </div>

      <div className="space-y-6 pb-10">
         <GridSection 
           title={isRtl ? "الفترة الصباحية ☀️" : "Morning Session"} 
           slots={timeSlots.morning} 
           engineers={fieldEngineers} 
           grid={filteredAppointments} 
           visitCounts={apptVisitCounts}
           onAction={handleAction}
           isRtl={isRtl}
           router={router}
           t={t}
           settings={settings}
           dateStr={dateStr}
           leaves={approvedLeaves}
           permissions={approvedPermissions}
           absences={dailyAbsences}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة المسائية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={fieldEngineers} 
             grid={filteredAppointments} 
             visitCounts={apptVisitCounts}
             onAction={handleAction}
             isRtl={isRtl}
             router={router}
             t={t}
             settings={settings}
             dateStr={dateStr}
             leaves={approvedLeaves}
             permissions={approvedPermissions}
             absences={dailyAbsences}
           />
         )}
      </div>
    </div>
  );
}

function GridSection({ title, slots, engineers, grid, visitCounts, onAction, isRtl, router, t, settings, dateStr, leaves, permissions, absences }: any) {
  if (slots.length === 0) return null;

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
    <div className="space-y-2">
       <div className="flex items-center gap-2 px-1">
          <Badge className="bg-slate-800 text-white font-bold text-[9px] uppercase px-3">{title}</Badge>
          <div className="h-px flex-1 bg-slate-100" />
       </div>

       <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm scrollbar-hide">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50/50">
                   <th className="w-14 p-2 border-b font-bold text-[10px] text-slate-400">Time</th>
                   {engineers.map((eng: Employee) => (
                      <th key={eng.id} className="p-2 border-b border-s min-w-[150px]">
                         <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 rounded-md">
                               <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">{eng.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-[11px] text-slate-700 truncate">{eng.fullName}</span>
                         </div>
                      </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string) => {
                  const slotStart = parse(`${dateStr} ${slot}`, 'yyyy-MM-dd HH:mm', new Date());
                  const slotEnd = addMinutes(slotStart, settings?.fieldWork?.slotDurationMinutes || 60);

                  return (
                    <tr key={slot} className="group">
                       <td className="p-2 text-center border-b border-e font-mono font-bold text-slate-300 text-[10px] bg-slate-50/20">{slot}</td>
                       {engineers.map((eng: Employee) => {
                          const appt = grid.find((a: any) => {
                             const apptStart = parseISO(a.start);
                             const apptEnd = a.end ? parseISO(a.end) : addMinutes(apptStart, settings?.fieldWork?.slotDurationMinutes || 60);
                             return apptStart < slotEnd && slotStart < apptEnd && a.engineerId === eng.id;
                          });

                          const block = getBlockedReason(eng.id!, slot);
                          if (block) return <td key={eng.id} className="p-1 border-b border-s bg-slate-50/30 text-[8px] font-bold text-slate-300 text-center uppercase italic">{block.label}</td>;

                          if (appt) {
                             const isCompleted = appt.status === 'completed';
                             const isStartSlot = parseISO(appt.start) >= slotStart && parseISO(appt.start) < slotEnd;
                             return (
                               <td key={eng.id} className="p-0.5 border-b border-s align-top">
                                  <div 
                                    onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}
                                    className={cn(
                                      "p-1.5 rounded-md h-full transition-all cursor-pointer min-h-[36px] border",
                                      isCompleted ? "bg-emerald-50/30 border-emerald-500/20" : "bg-primary/5 border-primary/20"
                                    )}
                                  >
                                      {isStartSlot && (
                                         <p className={cn("font-bold text-[9px] truncate", isCompleted ? "text-emerald-700" : "text-slate-800")}>
                                            {appt.clientName}
                                         </p>
                                      )}
                                  </div>
                               </td>
                             );
                          }
                          return <td key={eng.id} className="p-0.5 border-b border-s hover:bg-slate-50/50 cursor-pointer" onClick={() => onAction('create', eng, slot)} />
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
