'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  format, 
  isSameDay, 
  parseISO, 
  addDays,
  eachDayOfInterval,
  subDays,
  parse,
  isBefore,
  startOfDay,
  differenceInDays,
  subMonths
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
  Workflow,
  Target,
  LayoutGrid,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ShieldAlert
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
import { Governorate } from '@/types/reference';
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// --- Helpers ---
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
  const [dialogData, setDialogData] = useState<{ mode: 'create' | 'edit'; appointment?: Appointment; slot?: string; engineer?: Employee } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const visibleDates = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(currentDate, 3),
      end: addDays(currentDate, 3)
    });
  }, [currentDate]);

  const apptsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(
      collection(db, paths.appointments(companyId)), 
      orderBy('start', 'asc')
    );
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
  
  const { data: approvedLeaves } = useCollection<LeaveRequest>(leavesQuery);
  const { data: approvedPermissions } = useCollection<PermissionRequest>(permsQuery);
  const { data: dailyAbsences } = useCollection<AttendanceRecord>(attendanceQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const activeAndRecentAppointments = useMemo(() => {
    const thirtyDaysAgo = subMonths(new Date(), 1);
    return (rawAppointments || []).filter(a => {
      if (a.status === 'scheduled') return true;
      const apptDate = parseISO(a.start);
      return !isBefore(apptDate, thirtyDaysAgo);
    });
  }, [rawAppointments]);

  const archEngineers = useMemo(() => {
    const list = (allEmployees || []).filter(e => e.departmentName?.includes('معماري') || e.departmentName?.includes('Arch'));
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

  const overdueMissions = useMemo(() => {
    const today = startOfDay(new Date());
    let list = activeAndRecentAppointments.filter(a => 
      a.status === 'scheduled' && 
      isBefore(parseISO(a.start), today)
    );

    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(a => a.engineerId === globalUser.employeeId);
    }

    return list.sort((a, b) => a.start.localeCompare(b.start));
  }, [activeAndRecentAppointments, isAdmin, globalUser?.employeeId]);

  const filteredAppointments = useMemo(() => {
    let list = activeAndRecentAppointments.filter(a => a.status !== 'cancelled' && isSameDay(parseISO(a.start), currentDate));
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(a => a.engineerId === globalUser.employeeId);
    }
    return list;
  }, [activeAndRecentAppointments, currentDate, isAdmin, globalUser?.employeeId]);

  const apptMeta = useMemo(() => computeMeta(activeAndRecentAppointments, clientsMap), [activeAndRecentAppointments, clientsMap]);

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
    <div className="space-y-10 animate-in fade-in duration-700 print:space-y-1 print:pt-0" dir={dir}>
      
      {overdueMissions.length > 0 && (
        <div className="animate-in slide-in-from-top-4 duration-500 print:hidden">
           <div className="flex items-center gap-3 mb-4 px-2">
              <ShieldAlert className="h-6 w-6 text-rose-500" />
              <h2 className="text-xl font-black font-headline text-rose-900">{isRtl ? 'مهمات بانتظار الإغلاق الفني' : 'Missions Awaiting Closure'}</h2>
              <Badge className="bg-rose-500 text-white font-black border-0 h-6 px-3 rounded-full shadow-lg shadow-rose-200">
                 {overdueMissions.length.toLocaleString('en-US')}
              </Badge>
           </div>
           
           <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1">
              {overdueMissions.map((mission) => {
                const daysLate = differenceInDays(startOfDay(new Date()), startOfDay(parseISO(mission.start)));
                return (
                  <Card 
                    key={mission.id} 
                    onClick={() => router.push(`/dashboard/appointments/${mission.id}`)}
                    className="min-w-[280px] border-2 border-rose-100 bg-rose-50/30 hover:bg-rose-50 hover:border-rose-300 transition-all cursor-pointer rounded-[1.5rem] shadow-sm group"
                  >
                     <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                           <div className="text-start">
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{isRtl ? 'متأخر منذ' : 'Late by'}</p>
                              <p className="text-sm font-black text-rose-600">{daysLate} {isRtl ? 'أيام' : 'Days'}</p>
                           </div>
                           <Badge variant="outline" className="bg-white border-rose-200 text-rose-500 text-[8px] font-black uppercase">OVERDUE</Badge>
                        </div>
                        
                        <div className="text-start space-y-1">
                           <h4 className="font-black text-xs text-slate-800 line-clamp-1">{mission.clientName}</h4>
                           <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                              <CalendarX className="h-3 w-3" /> {format(parseISO(mission.start), 'dd/MM/yyyy')}
                           </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-rose-100">
                           <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 rounded-lg ring-1 ring-white shadow-sm">
                                 <AvatarFallback className="bg-rose-100 text-rose-600 text-[8px] font-black">{mission.engineerName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="text-[9px] font-black text-slate-500 truncate max-w-[100px]">{mission.engineerName}</span>
                           </div>
                           <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm">
                              <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                           </div>
                        </div>
                     </CardContent>
                  </Card>
                );
              })}
           </div>
        </div>
      )}

      {/* Print-only Date Header - Compact */}
      <div className="hidden print:flex justify-between items-end border-b pb-1 mb-2">
         <p className="text-xs font-black uppercase tracking-widest text-primary">NovaFlow Architectural Radar</p>
         <p className="text-sm font-black">{format(currentDate, 'EEEE, d MMMM yyyy', { locale: isRtl ? ar : enUS })}</p>
      </div>

      <div className="flex flex-col items-center gap-6 print:hidden">
        <div className="flex items-center gap-6 w-full max-w-4xl justify-center">
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setCurrentDate(subDays(currentDate, 1))}
             className="h-10 w-10 rounded-full hover:bg-slate-100 transition-all text-slate-400 print:hidden"
           >
              <ChevronLeft className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>

           <div className="flex gap-4 overflow-x-auto py-2 px-2 scrollbar-hide">
              {visibleDates.map((date) => {
                const isSelected = isSameDay(date, currentDate);
                
                return (
                  <Card 
                    key={date.toISOString()}
                    onClick={() => setCurrentDate(date)}
                    className={cn(
                      "min-w-[80px] h-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 rounded-xl border-2 shadow-sm",
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
             className="h-10 w-10 rounded-full hover:bg-slate-100 transition-all text-slate-400 print:hidden"
           >
              <ChevronRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 print:gap-1">
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-slate-900 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-20 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">{isRtl ? 'إجمالي المواعيد' : 'Total Today'}</p>
               <h3 className="text-xl print:text-xs font-black text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.total.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-yellow-400 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-20 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">{isRtl ? 'زيارة أولى' : '1st Visits'}</p>
               <h3 className="text-xl print:text-xs font-black text-yellow-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.yellow.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-emerald-500 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-20 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">{isRtl ? 'متابعة' : 'Follow-ups'}</p>
               <h3 className="text-xl print:text-xs font-black text-emerald-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.green.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-blue-500 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-20 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">{isRtl ? 'متعاقدون' : 'Contracted'}</p>
               <h3 className="text-xl print:text-xs font-black text-blue-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.blue.toLocaleString('en-US')}</h3>
            </CardContent>
         </Card>
      </div>

      <div className="space-y-12 pb-20 print:pb-0 print:space-y-4">
         <GridSection 
           title={isRtl ? "الفترة الصباحية ☀️" : "Morning Session"} 
           slots={timeSlots.morning} 
           engineers={archEngineers} 
           gridMap={engineerAppointmentsMap} 
           meta={apptMeta} 
           onAction={handleAction}
           onDelete={setDeletingId}
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
           t={t}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة المسائية 🌆" : "Evening Session"} 
             slots={timeSlots.evening} 
             engineers={archEngineers} 
             gridMap={engineerAppointmentsMap} 
             meta={apptMeta} 
             onAction={handleAction}
             onDelete={setDeletingId}
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
             t={t}
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
          companyId={companyId!}
          userId={user.uid}
          userName={user.displayName || user.email || 'User'}
          db={db}
          rawAppointments={activeAndRecentAppointments}
          settings={settings}
          onDelete={confirmDelete}
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

function GridSection({ title, slots, engineers, gridMap, meta, onAction, onDelete, isRtl, clients, isAdmin, currentEngineerId, leaves, permissions, absences, dateStr, db, companyId, router, t }: any) {
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

  return (
    <div className="space-y-6 print:space-y-1">
       <div className="flex items-center gap-4 px-2 print:gap-1">
          <Badge className="bg-slate-900 text-white font-black px-6 py-1.5 rounded-full text-[10px] shadow-md uppercase tracking-widest print:px-2 print:py-0.5 print:text-[8px]">{title}</Badge>
          <div className="h-[1.5px] flex-1 bg-slate-200" />
       </div>

       <div className="overflow-x-auto rounded-xl shadow-xl border-4 border-white bg-white ring-1 ring-black/5 print:shadow-none print:border-0 print:ring-0">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-100/80 print:bg-white">
                   <th className="w-20 p-4 border-b-2 border-slate-200 font-black text-[9px] text-slate-500 uppercase tracking-[0.2em] bg-slate-100/50 print:bg-white print:p-1 print:border-b print:w-10">{isRtl ? 'الوقت' : 'Time'}</th>
                   {visibleEngineers.map((eng: Employee) => {
                      const engAppts = gridMap.get(eng.id!) || [];
                      const totalCount = engAppts.length;
                      let v1 = 0, follow = 0, cont = 0;
                      engAppts.forEach((a: Appointment) => {
                         const m = meta.get(a.id);
                         if (m?.color === '#facc15') v1++;
                         else if (m?.color === '#22c55e') follow++;
                         else if (m?.color === '#3b82f6') cont++;
                      });

                      return (
                        <th key={eng.id} className="p-4 border-b-2 border-slate-200 border-s-2 border-s-slate-100 text-start bg-white min-w-[280px] print:p-1 print:min-w-[120px] print:border-s print:border-b">
                           <div className="flex items-center gap-3 print:gap-1">
                              <Avatar className="h-12 w-12 rounded-xl border-2 border-white shadow-md ring-2 ring-primary/10 shrink-0 print:h-6 print:w-6 print:rounded-md">
                                 <AvatarImage src={`https://picsum.photos/seed/${eng.id}/100/100`} />
                                 <AvatarFallback className="bg-primary text-white font-black text-sm uppercase print:text-[8px]">
                                    {eng.fullName.charAt(0)}
                                 </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col text-start flex-1 min-w-0">
                                 <span className="font-black text-slate-900 text-sm leading-none truncate print:text-[9px]">{eng.fullName}</span>
                                 <div className="flex flex-wrap gap-1 mt-2 print:mt-1">
                                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 shadow-sm print:px-1 print:py-0">
                                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter print:text-[5px]">{t('engTotal')}</span>
                                       <span className="text-[10px] font-black text-slate-900 print:text-[8px]">{totalCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100 shadow-sm print:px-1 print:py-0">
                                       <span className="text-[7px] font-black text-yellow-600 uppercase tracking-tighter print:text-[5px]">{t('engNew')}</span>
                                       <span className="text-[10px] font-black text-yellow-900 print:text-[8px]">{v1}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shadow-sm print:px-1 print:py-0">
                                       <span className="text-[7px] font-black text-emerald-600 uppercase tracking-tighter print:text-[5px]">{t('engFollow')}</span>
                                       <span className="text-[10px] font-black text-emerald-900 print:text-[8px]">{follow}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 shadow-sm print:px-1 print:py-0">
                                       <span className="text-[7px] font-black text-blue-600 uppercase tracking-tighter print:text-[5px]">{t('engContracted')}</span>
                                       <span className="text-[10px] font-black text-blue-900 print:text-[8px]">{cont}</span>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </th>
                      );
                   })}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string, sIdx: number) => (
                  <tr key={slot} className={cn("group/row", sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/10 print:bg-white")}>
                     <td className="p-4 text-center border-b-2 border-slate-200 border-e-2 border-e-slate-200 font-mono font-black text-slate-500 bg-slate-100/50 text-[10px] print:bg-white print:p-1 print:border-b print:border-e">{slot}</td>
                     {visibleEngineers.map((eng: Employee) => {
                        const engAppts = gridMap.get(eng.id!) || [];
                        const appt = engAppts.find((a: any) => {
                           const start = format(parseISO(a.start), 'HH:mm');
                           const end = a.end ? format(parseISO(a.end), 'HH:mm') : start;
                           if (start === slot) return true;
                           if (a.type === 'busy_blocked') {
                              return slot >= start && slot < end;
                           }
                           return false;
                        });
                        
                        const block = getBlockedReason(eng.id!, slot);

                        if (block) {
                           return (
                             <td key={eng.id} className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 bg-slate-50/50 print:bg-white print:border-s print:border-b">
                                <div className="h-full flex items-center justify-center gap-2 text-[8px] font-black text-slate-300 uppercase italic opacity-60 print:text-[6px]">
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
                           const isCompleted = appt.status === 'completed';
                           const isStart = format(parseISO(appt.start), 'HH:mm') === slot;

                           return (
                             <td key={eng.id} className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 align-top relative print:p-0.5 print:border-s print:border-b">
                                <Card 
                                  onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}
                                  className={cn(
                                    "border-2 p-3 rounded-xl h-full shadow-lg relative group/card cursor-pointer transition-all hover:ring-4 hover:ring-primary/5 print:shadow-none print:ring-0 print:p-1 print:border print:rounded-md", 
                                    cardGradient(m?.color || '', isCompleted)
                                  )}
                                >
                                   {isStart && (
                                     <div className={cn("absolute top-1 z-10 print:hidden", isRtl ? "left-1" : "right-1")} onClick={e => e.stopPropagation()}>
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
                                                 <DropdownMenuItem onSelect={() => router.push(`/dashboard/appointments/${appt.id}`)} className="font-bold gap-2 py-2 text-[10px] cursor-pointer">
                                                    <MessageSquare className="h-3 w-3 text-primary" /> {isRtl ? 'غرفة العمليات' : 'War Room'}
                                                 </DropdownMenuItem>
                                                 <DropdownMenuItem onSelect={() => onAction('edit', eng, slot, appt)} className="font-bold gap-2 py-2 text-[10px] cursor-pointer">
                                                    <Edit3 className="h-3 w-3 text-blue-500" /> {isRtl ? 'تعديل البيانات' : 'Edit Details'}
                                                 </DropdownMenuItem>
                                                 <DropdownMenuSeparator />
                                                 <DropdownMenuItem onSelect={() => onDelete(appt.id!)} className="font-bold gap-2 py-2 text-[10px] text-rose-600 cursor-pointer hover:bg-rose-50">
                                                    <Trash2 className="h-3 w-3" /> {isRtl ? 'حذف الموعد نهائياً' : 'Delete Permanent'}
                                                 </DropdownMenuItem>
                                              </DropdownMenuContent>
                                           </DropdownMenuPortal>
                                        </DropdownMenu>
                                     </div>
                                   )}

                                   <div className={cn("text-start", isRtl ? "pr-1 pl-5" : "pl-1 pr-5")}>
                                      <div className="flex items-center gap-1.5">
                                         {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0 print:h-2 print:w-2" />}
                                         <p className={cn("font-black text-[10px] leading-tight mb-0.5 truncate print:text-[8px]", isCompleted && "text-emerald-900")}>
                                           {isBusy ? (isRtl ? `[مشغول: ${appt.notes || '...'}]` : `[BUSY: ${appt.notes || '...'}]`) : appt.clientName}
                                         </p>
                                      </div>
                                      {!isBusy && (
                                        <div className="flex items-center gap-1 text-[7px] font-black uppercase opacity-60 print:text-[6px]">
                                           <MapPin className="h-2 w-2 print:h-1.5 print:w-1.5" /> {appt.governorateName || '---'}
                                        </div>
                                      )}
                                      {appt.transactionNumber && (
                                        <div className="flex items-center gap-1 text-[7px] font-black text-primary mt-1 uppercase tracking-tighter print:mt-0.5 print:text-[6px]">
                                           <Workflow className="h-2.5 w-2.5 print:h-2 print:w-2" /> {appt.transactionNumber}
                                        </div>
                                      )}
                                   </div>
                                   
                                   {!isBusy ? (
                                     <div className="mt-2 flex items-center justify-between px-1 print:mt-1">
                                        <Badge className="bg-white/40 text-inherit border-0 font-black text-[7px] h-4 px-1.5 rounded shadow-sm print:h-3 print:px-1 print:text-[6px]">V {m?.visitCount}</Badge>
                                        {appt.transactionId && <LinkIcon className="h-2.5 w-2.5 opacity-30 text-inherit print:hidden" />}
                                     </div>
                                   ) : (
                                     <div className="mt-2 flex items-center justify-between px-1 text-[7px] font-black text-slate-500 uppercase tracking-tighter print:mt-1 print:text-[6px]">
                                        <span>Ends: {appt.end ? format(parseISO(appt.end), 'HH:mm') : '---'}</span>
                                        <Ban className="h-2.5 w-2.5 opacity-30 print:hidden" />
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
                            className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 group-hover/row:bg-primary/[0.03] transition-colors cursor-pointer print:bg-white print:border-s print:border-b"
                          >
                             <div className="h-10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity print:hidden">
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

function AppointmentManagerDialog({ isOpen, onClose, data, clients, governorates, companyId, userId, userName, db, rawAppointments, settings, onDelete }: any) {
  const { dir, lang, t } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [isBusyBlock, setIsBusyBlock] = useState(false);

  const [formData, setFormData] = useState({
    title: '', clientId: '', clientName: '', 
    newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', 
    transactionId: '', transactionNumber: '',
    date: '', time: '', notes: '',
    endTime: '' 
  });

  const [clientTransactions, setClientTransactions] = useState<any[]>([]);

  const targetEngineerId = data?.engineer?.id || data?.appointment?.engineerId;

  const isSelectedDateHoliday = useMemo(() => {
     if (!settings || !formData.date) return false;
     return WorkHoursEngine.isHoliday(parseISO(formData.date), settings);
  }, [settings, formData.date]);
  
  const filteredClients = useMemo(() => {
    let list = clients || [];
    if (targetEngineerId) {
      list = list.filter((c: any) => c.assignedEngineerId === targetEngineerId);
    }
    return list;
  }, [clients, targetEngineerId]);

  const availableSlots = useMemo(() => {
    if (!settings || !formData.date) return [];
    const res = WorkHoursEngine.buildDaySlots(parseISO(formData.date), settings, 'architectural');
    return [...res.morningSlots, ...res.eveningSlots];
  }, [settings, formData.date]);

  const availableEndTimes = useMemo(() => {
     if (!settings || !formData.date || !formData.time) return [];
     const res = WorkHoursEngine.buildDaySlots(parseISO(formData.date), settings, 'architectural');
     const allSlots = [...res.morningSlots, ...res.eveningSlots];
     return allSlots.filter(s => s > formData.time);
  }, [settings, formData.date, formData.time]);

  useEffect(() => {
    if (!isOpen) {
       setFormData({
         title: '', clientId: '', clientName: '', 
         newClientName: '', newClientPhone: '', newClientGovId: '', newClientGovName: '', 
         transactionId: '', transactionNumber: '',
         date: '', time: '', notes: '',
         endTime: ''
       });
       setIsNewClient(false);
       setIsBusyBlock(false);
       setClientTransactions([]);
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

  const fetchClientTransactions = async (cid: string) => {
    if (!db || !companyId) return;
    const q = query(collection(db, paths.transactions(companyId)), where('clientId', '==', cid));
    const snap = await getDocs(q);
    setClientTransactions(snap.docs.map(d => ({id: d.id, ...d.data()})));
  };

  const handleSave = async () => {
    if (!data || isSelectedDateHoliday) return;
    const isCreate = data.mode === 'create';
    const start = new Date(`${formData.date}T${formData.time}:00`).toISOString();
    const end = formData.endTime ? new Date(`${formData.date}T${formData.endTime}:00`).toISOString() : null;
    
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
          assignedEngineerId: targetEngineerId,
          assignedEngineerName: data.engineer?.fullName || data.appointment?.engineerName
        }, userId, userName);
        targetClientName = formData.newClientName;
      }

      const savePayload = {
        title: formData.title || (isBusyBlock ? (isRtl ? 'مشغول' : 'BUSY') : (isRtl ? 'موعد فني' : 'Appt')),
        clientId: targetClientId,
        clientName: targetClientName,
        transactionId: formData.transactionId,
        transactionNumber: formData.transactionNumber,
        engineerId: data.engineer?.id || data.appointment?.engineerId,
        engineerName: data.engineer?.fullName || data.appointment?.engineerName,
        type: apptType,
        start,
        end,
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

  const isEdit = data?.mode === 'edit';

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if(!v) onClose(); }}>
      <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg flex flex-col h-fit max-h-[90vh] z-[101]" dir={dir}>
        
        <div className="bg-slate-50/50 p-6 text-slate-900 text-start border-b shrink-0 relative">
           <DialogTitle className="text-lg font-black font-headline truncate flex items-center gap-3 text-slate-900">
              {isEdit ? <Edit3 className="h-5 w-5 text-primary" /> : <PlusCircle className="h-5 w-5 text-primary" />}
              {isEdit ? (isRtl ? 'تعديل بيانات الموعد' : 'Edit Appointment') : (isRtl ? 'حجز موعد جديد' : 'New Appointment')}
           </DialogTitle>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-start scrollbar-hide bg-white">
           
           <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] shadow-sm relative overflow-hidden animate-in zoom-in-95">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Clock className="h-20 w-20 text-primary" /></div>
              <div className="space-y-2 relative z-10">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ الموعد' : 'Appointment Date'}</Label>
                 <Input 
                   type="date" 
                   value={formData.date} 
                   onChange={e => setFormData({...formData, date: e.target.value})} 
                   className={cn(
                     "h-11 rounded-xl bg-white border-2 font-black text-lg focus:ring-2 shadow-sm",
                     isSelectedDateHoliday ? "border-rose-500 ring-rose-50" : "border-slate-200 text-slate-900"
                   )}
                 />
              </div>
              <div className="space-y-2 relative z-10">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'وقت البدء' : 'Start Time'}</Label>
                 <Select disabled={isSelectedDateHoliday} value={formData.time} onValueChange={v => setFormData({...formData, time: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-white border-2 border-slate-200 text-slate-900 font-black text-lg focus:ring-2 focus:ring-primary shadow-sm">
                       <SelectValue placeholder={isSelectedDateHoliday ? "---" : "..."} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border shadow-2xl z-[155]">
                      {availableSlots.map(slot => (
                         <SelectItem key={slot} value={slot} className="font-black py-3 border-b last:border-0 border-slate-50">{slot}</SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </div>

              {isSelectedDateHoliday && (
                 <div className="col-span-2 mt-2 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 animate-pulse">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-[10px] font-black uppercase">{isRtl ? 'عطلة رسمية: لا يمكن الحجز في هذا التاريخ' : 'Holiday: No bookings allowed'}</p>
                 </div>
              )}
           </div>

           {!isEdit && !isSelectedDateHoliday && (
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

           {isBusyBlock && !isSelectedDateHoliday && (
              <div className="p-6 bg-white border-2 border-dashed border-primary/20 rounded-[1.5rem] space-y-6 animate-in slide-in-from-top-4 duration-500 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5"><Ban className="h-20 w-20 text-primary" /></div>
                 <div className="flex items-center gap-3 border-b border-primary/10 pb-4 relative z-10">
                    <div className="p-2 bg-primary/10 rounded-lg"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                    <h5 className="font-black text-xs uppercase tracking-widest text-slate-900">{isRtl ? 'حظر / تجميد وقت المهندس' : 'Time Freeze'}</h5>
                 </div>
                 
                 <div className="space-y-4 relative z-10">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'سبب الانشغال / المهمة' : 'Freeze Reason / Task'}</Label>
                       <Input 
                         value={formData.notes} 
                         onChange={e => setFormData({...formData, notes: e.target.value})} 
                         className="h-12 rounded-xl bg-slate-50/50 border-2 border-slate-100 text-slate-900 font-bold" 
                         placeholder={isRtl ? "مثلاً: اجتماع داخلي، معاينة طارئة..." : "e.g. Internal Meeting..."}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'وقت الانتهاء المخطط' : 'Planned End Time'}</Label>
                       <Select value={formData.endTime} onValueChange={v => setFormData({...formData, endTime: v})}>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-2 border-slate-100 text-slate-900 font-black text-lg">
                             <SelectValue placeholder={isRtl ? "تحديد وقت الانتهاء..." : "Select End Time..."} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border shadow-2xl z-[155]">
                             {availableEndTimes.map(slot => (
                                <SelectItem key={slot} value={slot} className="font-black py-3 border-b last:border-0 border-slate-50">
                                   {slot}
                                </SelectItem>
                             ))}
                             {availableEndTimes.length === 0 && <div className="p-4 text-center text-xs font-bold text-slate-400 italic">No slots after start time</div>}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
              </div>
           )}

           {!isBusyBlock && !isSelectedDateHoliday && (
             <div className="space-y-4">
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
                         <Select value={formData.clientId} onValueChange={v => {
                           const c = filteredClients.find((x:any) => x.id === v);
                           setFormData({...formData, clientId: v, clientName: c?.nameAr || '', transactionId: '', transactionNumber: ''});
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
                                    {clientTransactions.length === 0 && (
                                       <div className="p-4 text-center text-[10px] font-bold text-slate-400 italic">لا يوجد مشاريع جارية</div>
                                    )}
                                 </SelectContent>
                              </Select>
                           </div>
                        </div>
                      )}
                   </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">غرض الموعد</Label>
                  <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-10 rounded-lg border-2 font-bold" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">توجيهات فنية للمهندس</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="min-h-[100px] rounded-xl border-2 bg-slate-50/30 p-4 text-xs font-bold" />
                </div>
             </div>
           )}
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t flex flex-row gap-3 shrink-0 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
           <div className="flex-1 flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold border-2 bg-white">
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              {isEdit && (
                <Button 
                  variant="ghost" 
                  onClick={() => onDelete(data.appointment?.id)} 
                  className="flex-1 h-12 rounded-xl font-black text-rose-600 bg-rose-50 border-2 border-rose-100 hover:bg-rose-100 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isBusyBlock ? (isRtl ? 'فك التجميد' : 'Unfreeze') : (isRtl ? 'حذف الموعد' : 'Delete')}
                </Button>
              )}
           </div>
           <Button 
             onClick={handleSave} 
             disabled={loading || isSelectedDateHoliday || (!isBusyBlock && !formData.clientId)} 
             className="flex-1 h-12 rounded-xl font-black gap-2 shadow-xl shadow-primary/20"
           >
              {loading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {isRtl ? 'حفظ التغييرات' : 'Confirm & Save'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
