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
    <div className="space-y-6 animate-in fade-in duration-700 print:space-y-1 print:pt-0" dir={dir}>
      
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
                    isActive ? "bg-[#1e1b4b] border-[#1e1b4b] shadow-xl shadow-indigo-900/20 scale-105" : "bg-white border-slate-100 hover:border-primary/20"
                  )}
                >
                  <p className={cn("text-[9px] font-black uppercase tracking-tighter", isActive ? "text-primary" : "text-slate-400")}>{format(d, 'EEEE', { locale: isRtl ? ar : enUS })}</p>
                  <p className={cn("text-xl font-black mt-0.5", isActive ? "text-white" : "text-slate-900")}>{format(d, 'd')}</p>
                  <p className={cn("text-[8px] font-bold uppercase", isActive ? "text-white/60" : "text-slate-400")}>{format(d, 'MMM')}</p>
                </Card>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} className="h-10 w-10 rounded-xl bg-white shadow-sm border-2 border-slate-100"><ChevronRight className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:gap-1">
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-slate-900 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'إجمالي اليوم' : 'Total'}</p>
               <h3 className="text-xl print:text-xs font-black text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredAppointments.length.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-yellow-400 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'قيد التنفيذ' : 'Active'}</p>
               <h3 className="text-xl print:text-xs font-black text-yellow-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredAppointments.filter(a => a.status === 'scheduled').length.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-emerald-500 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'مكتملة' : 'Done'}</p>
               <h3 className="text-xl print:text-xs font-black text-emerald-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredAppointments.filter(a => a.status === 'completed').length.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-blue-500 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'القوى الميدانية' : 'Staff'}</p>
               <h3 className="text-xl print:text-xs font-black text-blue-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{fieldEngineers.length.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
      </div>

      <div className="space-y-8 pb-10 print:pb-0 print:space-y-4">
         <GridSection 
           title={isRtl ? "الفترة الميدانية الأولى ☀️" : "Morning Session"} 
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
             title={isRtl ? "الفترة الميدانية الثانية 🌆" : "Evening Session"} 
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
                   {engineers.map((eng: Employee) => {
                      const engAppts = grid.filter((a: any) => a.engineerId === eng.id);
                      return (
                        <th key={eng.id} className="p-3 border-b border-slate-100 border-s border-s-slate-50 min-w-[180px] print:p-1 print:min-w-[100px]">
                           <div className="flex flex-col items-center text-center">
                              <Avatar className="h-10 w-10 rounded-2xl shrink-0 mb-2 border-2 border-white shadow-md ring-1 ring-slate-100">
                                 <AvatarImage src={`https://picsum.photos/seed/${eng.id}/40/40`} />
                                 <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{eng.fullName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="text-center w-full">
                                 <span className="font-black text-slate-800 text-[11px] leading-none block truncate">{eng.fullName}</span>
                                 <Badge className="bg-slate-100 text-slate-500 text-[7px] font-black h-4 px-1.5 border-0 mt-1.5 uppercase shadow-sm">{engAppts.length} TASKS</Badge>
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
                  const slotEnd = addMinutes(slotStart, settings?.fieldWork?.slotDurationMinutes || 60);

                  return (
                    <tr key={slot} className="group/row">
                       <td className="p-3 text-center border-b border-slate-50 border-e border-e-slate-50 font-mono font-black text-slate-300 text-[10px] bg-slate-50/20">{slot}</td>
                       {engineers.map((eng: Employee) => {
                          const appt = grid.find((a: any) => {
                             const apptStart = parseISO(a.start);
                             const apptEnd = a.end 
                               ? parseISO(a.end) 
                               : addMinutes(apptStart, settings?.fieldWork?.slotDurationMinutes || 60);
                             
                             return apptStart < slotEnd && slotStart < apptEnd && a.engineerId === eng.id;
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
                             const isCompleted = appt.status === 'completed';
                             const apptStart = parseISO(appt.start);
                             const isStartSlot = apptStart >= slotStart && apptStart < slotEnd;
                             const visitCount = visitCounts.get(appt.id);

                             return (
                               <td key={eng.id} className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 align-top">
                                  <div className="relative h-full">
                                    <Card 
                                      onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}
                                      className={cn(
                                        "p-2 rounded-xl h-full transition-all cursor-pointer min-h-[44px] shadow-sm",
                                        isCompleted ? "bg-emerald-50/50 border-emerald-500/20" : "bg-primary/5 border-primary/20"
                                      )}
                                    >
                                      <div className="text-start space-y-1 pr-6">
                                          {isStartSlot && (
                                            <>
                                              <div className="flex items-center gap-1.5">
                                                 {isCompleted ? (
                                                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                                                 ) : (
                                                    <Badge className="h-3.5 px-1 bg-black/5 text-[7px] font-black border-0">V{visitCount}</Badge>
                                                 )}
                                                 <p className={cn("font-black text-[9px] leading-tight truncate", isCompleted ? "text-emerald-900" : "text-slate-900")}>
                                                   {appt.clientName}
                                                 </p>
                                              </div>
                                              <div className="flex items-center gap-1 text-[7px] font-bold opacity-60">
                                                 <MapPin className="h-2.5 w-2.5" /> {appt.governorateName?.slice(0, 10)}
                                              </div>
                                            </>
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
                                              <Eye className="h-3.5 w-3.5" /> {isRtl ? 'فتح التقرير' : 'Open Report'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => onAction('edit', eng, slot, appt)}>
                                              <Edit3 className="h-3.5 w-3.5" /> {isRtl ? 'تعديل' : 'Edit'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="font-black text-xs gap-2 text-rose-600">
                                              <Trash2 className="h-3.5 w-3.5" /> {isRtl ? 'إلغاء الموعد' : 'Cancel'}
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
