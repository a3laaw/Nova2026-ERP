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
  User as UserIcon,
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
  Users,
  Target
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

/**
 * @fileOverview مكون رادار العمليات الميدانية (Construction Bookings View).
 * مخصص لمهندسي الموقع ويعتمد على توقيتات "العمل الميداني" (Field Work).
 */
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  // استعلام المواعيد للمنشأة بالكامل
  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start', 'asc')) : null, 
  [db, companyId]);

  // جلب المهندسين الميدانيين حصراً
  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);
  const { data: allEmployees, loading: empsLoading } = useCollection<Employee>(empsQuery);
  const { data: allClients } = useCollection<any>(clientsQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  // تصفية المهندسين الميدانيين (تنفيذ أو موقع)
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
    let list = (rawAppointments || []).filter(a => a.status !== 'cancelled' && isSameDay(parseISO(a.start), currentDate));
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

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
       document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  if (!mounted || apptsLoading || empsLoading || !settings) return <div className="h-[40vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-10" dir={dir}>
      
      {/* التحكم في التاريخ */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-6 w-full max-w-4xl justify-center bg-white p-2 rounded-2xl border shadow-sm print:hidden">
           <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))} className="h-10 w-10 rounded-full text-slate-400"><ChevronLeft className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
           
           <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span className="font-black text-lg text-slate-800 uppercase tracking-tighter">
                 {format(currentDate, 'EEEE, d MMM yyyy', { locale: isRtl ? ar : enUS })}
              </span>
           </div>

           <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} className="h-10 w-10 rounded-full text-slate-400"><ChevronRight className={cn("h-5 w-5", isRtl && "rotate-180")} /></Button>
        </div>
      </div>

      {/* عرض الرادار الميداني */}
      <div className="space-y-12 pb-20">
         <GridSection 
           title={isRtl ? "الفترة الميدانية الأولى ☀️" : "Morning Ops"} 
           slots={timeSlots.morning} 
           engineers={fieldEngineers} 
           grid={filteredAppointments} 
           onAction={handleAction}
           isRtl={isRtl}
           t={t}
           router={router}
         />
         {timeSlots.evening.length > 0 && (
           <GridSection 
             title={isRtl ? "الفترة الميدانية الثانية 🌆" : "Evening Ops"} 
             slots={timeSlots.evening} 
             engineers={fieldEngineers} 
             grid={filteredAppointments} 
             onAction={handleAction}
             isRtl={isRtl}
             t={t}
             router={router}
           />
         )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if(!v) setDialogOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-slate-50 p-6 border-b text-start">
               <DialogTitle className="text-lg font-black flex items-center gap-3">
                  <Hammer className="h-5 w-5 text-primary" />
                  {dialogData?.mode === 'edit' ? (isRtl ? 'تعديل موعد موقع' : 'Edit Site Booking') : (isRtl ? 'حجز موعد ميداني' : 'New Site Booking')}
               </DialogTitle>
            </div>
            <div className="p-8 space-y-6 text-start bg-white">
               <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-blue-800 leading-relaxed italic">
                     سيتم ربط هذا الموعد برادار العمليات الميدانية لتمكين المهندس من تسجيل الإنجاز الفني فور وصوله للموقع.
                  </p>
               </div>
               <p className="text-center py-10 text-slate-400 font-bold italic">نموذج الحجز الميداني المتقدم يكتمل في التحديث القادم...</p>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t">
               <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl h-11 px-8 font-bold">إلغاء</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}

function GridSection({ title, slots, engineers, grid, onAction, isRtl, t, router }: any) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4 px-2 print:hidden">
          <Badge className="bg-slate-900 text-white font-black px-6 py-1.5 rounded-full text-[10px] uppercase tracking-widest">{title}</Badge>
          <div className="h-[1.5px] flex-1 bg-slate-200" />
       </div>

       <div className="overflow-x-auto rounded-xl shadow-xl border-4 border-white bg-white ring-1 ring-black/5">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50">
                   <th className="w-20 p-4 border-b-2 border-slate-200 font-black text-[9px] text-slate-400 uppercase tracking-widest">{isRtl ? 'الوقت' : 'Time'}</th>
                   {engineers.map((eng: Employee) => (
                      <th key={eng.id} className="p-4 border-b-2 border-slate-200 border-s-2 border-s-slate-100 text-start bg-white min-w-[250px]">
                         <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 rounded-xl border-2 border-white shadow-md">
                               <AvatarImage src={`https://picsum.photos/seed/${eng.id}/100/100`} />
                               <AvatarFallback className="bg-primary text-white font-black text-xs uppercase">{eng.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="text-start">
                               <span className="font-black text-slate-900 text-xs leading-none">{eng.fullName}</span>
                               <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">{eng.jobTitle}</p>
                            </div>
                         </div>
                      </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string, sIdx: number) => (
                  <tr key={slot} className={cn("group/row", sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/10")}>
                     <td className="p-4 text-center border-b-2 border-slate-200 border-e-2 border-e-slate-200 font-mono font-black text-slate-500 bg-slate-50 text-[10px]">{slot}</td>
                     {engineers.map((eng: Employee) => {
                        const appt = grid.find((a: any) => {
                           const start = format(parseISO(a.start), 'HH:mm');
                           return start === slot && a.engineerId === eng.id;
                        });

                        if (appt) {
                           const isCompleted = appt.status === 'completed';
                           return (
                             <td key={eng.id} className="p-1 border-b-2 border-slate-200 border-s-2 border-s-slate-100 align-top">
                                <Card 
                                  onClick={() => router.push(`/dashboard/appointments/${appt.id}`)}
                                  className={cn(
                                    "border-2 p-3 rounded-xl h-full shadow-sm hover:shadow-lg transition-all cursor-pointer",
                                    isCompleted ? "bg-emerald-50/50 border-emerald-500/20" : "bg-primary/5 border-primary/20"
                                  )}
                                >
                                   <div className="text-start">
                                      <div className="flex items-center gap-1.5 mb-1">
                                         {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />}
                                         <p className="font-black text-[10px] leading-tight truncate">{appt.clientName}</p>
                                      </div>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                         <MapPin className="h-2 w-2 inline me-1" /> {appt.governorateName || 'Site'}
                                      </p>
                                      {appt.transactionNumber && (
                                        <div className="flex items-center gap-1 text-[7px] font-black text-primary mt-2 uppercase">
                                           <Workflow className="h-2.5 w-2.5" /> {appt.transactionNumber}
                                        </div>
                                      )}
                                   </div>
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
                                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
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
