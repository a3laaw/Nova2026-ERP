
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  format, 
  isSameDay, 
  parseISO, 
  addDays,
  subDays,
  parse,
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
  CalendarDays 
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);
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

  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);
  const { data: allEmployees, loading: empsLoading } = useCollection<Employee>(empsQuery);

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
    // الإنفاذ السيادي للفصل الراداري: استبعاد hall_meeting
    let list = (rawAppointments || []).filter(a => 
      a.status !== 'cancelled' && 
      a.type !== 'hall_meeting' && 
      isSameDay(parseISO(a.start), currentDate)
    );
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(a => a.engineerId === globalUser.employeeId);
    }
    return list;
  }, [rawAppointments, currentDate, isAdmin, globalUser?.employeeId]);

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
           onAction={handleAction}
           isRtl={isRtl}
           router={router}
           t={t}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة الميدانية الثانية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={fieldEngineers} 
             grid={filteredAppointments} 
             onAction={handleAction}
             isRtl={isRtl}
             router={router}
             t={t}
           />
         )}
      </div>
    </div>
  );
}

function GridSection({ title, slots, engineers, grid, onAction, isRtl, router, t }: any) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-4 print:space-y-1">
       <div className="flex items-center gap-3 px-1 print:gap-1">
          <Badge className="bg-slate-900 text-white font-black px-4 py-1 rounded-lg text-[9px] uppercase tracking-widest">{title}</Badge>
          <div className="h-[1px] flex-1 bg-slate-100" />
       </div>

       <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm print:border-0 print:shadow-none">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50/50 print:bg-white">
                   <th className="w-16 p-2 border-b border-slate-100 font-black text-[9px] text-slate-400 uppercase tracking-tighter bg-slate-50/50 print:p-1 print:w-10">Time</th>
                   {engineers.map((eng: Employee) => {
                      const engAppts = grid.filter((a: any) => a.engineerId === eng.id);
                      return (
                        <th key={eng.id} className="p-3 border-b border-slate-100 border-s border-s-slate-50 min-w-[180px] print:p-1 print:min-w-[100px]">
                           <div className="flex flex-col items-center text-center">
                              <Avatar className="h-8 w-8 rounded-lg shrink-0 mb-2">
                                 <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{eng.fullName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="text-center w-full">
                                 <span className="font-black text-slate-800 text-[11px] leading-none block truncate">{eng.fullName}</span>
                                 <Badge className="bg-slate-100 text-slate-500 text-[7px] font-black h-4 px-1 border-0 mt-1.5 uppercase">{engAppts.length} TASK</Badge>
                              </div>
                           </div>
                        </th>
                      );
                   })}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string) => (
                  <tr key={slot} className="group/row">
                     <td className="p-3 text-center border-b border-slate-50 border-e border-e-slate-50 font-mono font-black text-slate-300 text-[10px] bg-slate-50/20">{slot}</td>
                     {engineers.map((eng: Employee) => {
                        const appt = grid.find((a: any) => {
                           const start = format(parseISO(a.start), 'HH:mm');
                           return start === slot && a.engineerId === eng.id;
                        });

                        if (appt) {
                           const isCompleted = appt.status === 'completed';
                           return (
                             <td key={eng.id} className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 align-top">
                                <Card 
                                  onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}
                                  className={cn(
                                    "p-1.5 rounded-lg h-full transition-all cursor-pointer min-h-[40px]",
                                    isCompleted ? "bg-emerald-50/50 border-emerald-500/20" : "bg-primary/5 border-primary/20"
                                  )}
                                >
                                   <div className="text-start">
                                      <p className={cn("font-black text-[8px] leading-tight truncate", isCompleted && "text-emerald-900")}>
                                        {appt.clientName}
                                      </p>
                                   </div>
                                </Card>
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
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}

