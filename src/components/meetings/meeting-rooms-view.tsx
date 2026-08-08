'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  format, isSameDay, parseISO, addDays, subDays, parse, addMinutes
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Landmark, Clock, Plus, ChevronLeft, ChevronRight, 
  Edit3, Loader2, CheckCircle2, MapPin, X, Save, 
  Trash2, Users, ShieldCheck, PlusCircle, Workflow,
  Target, Info, AlertCircle, Play, UserPlus, Briefcase,
  ArrowRight,
  Eye,
  MoreVertical,
  ShieldX,
  ChevronDown,
  LayoutGrid,
  Activity
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, serverTimestamp, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { WorkHoursService } from '@/services/work-hours-service';
import * as WorkHoursEngine from '@/services/work-hours-engine';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { MeetingRoom, Department, ActivityType } from '@/types/reference';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { AppointmentService } from '@/services/appointment-service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { StageInstance } from '@/types/transaction';

export function MeetingRoomsView() {
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const roomsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.meetingRooms(companyId)), orderBy('order')) : null, 
  [db, companyId]);
  const { data: allRooms, loading: roomsLoading } = useCollection<MeetingRoom>(roomsQuery);

  const apptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start', 'asc')) : null, 
  [db, companyId]);
  const { data: rawAppointments, loading: apptsLoading } = useCollection<Appointment>(apptsQuery);

  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId))) : null, [db, companyId]);
  const actTypesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  
  const { data: departments } = useCollection<Department>(deptsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: clients } = useCollection<any>(clientsQuery);
  const { data: activityTypes } = useCollection<ActivityType>(actTypesQuery);

  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const filteredAppointments = useMemo(() => {
    return (rawAppointments || []).filter(a => 
      a.status !== 'cancelled' && 
      a.type === 'hall_meeting' &&
      isSameDay(parseISO(a.start), currentDate)
    );
  }, [rawAppointments, currentDate]);

  const timeSlots = useMemo(() => {
    if (!settings) return { morning: [], evening: [] };
    const result = WorkHoursEngine.buildDaySlots(currentDate, settings, 'meetingRooms');
    return { morning: result.morningSlots, evening: result.eveningSlots };
  }, [settings, currentDate]);

  const handleAction = (mode: 'create' | 'edit', room?: MeetingRoom, slot?: string, appt?: Appointment) => {
    setDialogData({ mode, room, slot, appointment: appt });
    setDialogOpen(true);
  };

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
       document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  const confirmDelete = (id?: string) => {
    const targetId = id || deletingId;
    if (!targetId || !db || !companyId) return;
    
    const docRef = doc(db, paths.appointments(companyId), targetId);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: isRtl ? "تم الحذف بنجاح" : "Deleted Successfully" });
        setDeletingId(null);
        setDialogOpen(false);
        forceThaw();
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  if (!mounted || apptsLoading || roomsLoading || !settings) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

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
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} className="h-10 w-10 rounded-xl bg-white shadow-sm border-2 border-slate-100"><ChevronRight className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 print:gap-1">
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-slate-900 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'إجمالي اجتماعات اليوم' : 'Daily Meetings'}</p>
               <h3 className="text-xl print:text-xs font-black text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredAppointments.length}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-blue-400 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'إشغال القاعات' : 'Room Occupancy'}</p>
               <h3 className="text-xl print:text-xs font-black text-blue-600">{Math.round((filteredAppointments.length / (allRooms.length * 8 || 1)) * 100)}%</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-orange-500 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'قيد التنفيذ' : 'In Progress'}</p>
               <h3 className="text-xl print:text-xs font-black text-orange-600">{filteredAppointments.filter(a => a.status === 'scheduled').length}</h3>
            </CardContent>
         </Card>
         <Card className="border-0 shadow-md rounded-xl bg-white border-b-4 border-b-emerald-500 print:shadow-none print:border-b-2">
            <CardContent className="p-3 print:p-1 flex flex-col items-center justify-center text-center h-16 print:h-12">
               <p className="text-[8px] print:text-[6px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'قاعات مفعلة' : 'Active Halls'}</p>
               <h3 className="text-xl print:text-xs font-black text-emerald-600">{allRooms.length}</h3>
            </CardContent>
         </Card>
      </div>

      <div className="space-y-8 pb-10 print:pb-0 print:space-y-4">
         <HallGridSection 
           title={isRtl ? "فترة الدوام الرسمي 🏛️" : "Halls Schedule"} 
           slots={timeSlots.morning} 
           rooms={allRooms} 
           appts={filteredAppointments}
           onAction={handleAction}
           onDelete={(id: string) => setDeletingId(id)}
           isRtl={isRtl}
           t={t}
           settings={settings}
           dateStr={dateStr}
           router={router}
           isAdmin={isAdmin}
         />
      </div>

      {user && (
        <HallBookingDialog 
          isOpen={dialogOpen}
          onClose={() => { setDialogOpen(false); forceThaw(); }}
          data={dialogData}
          companyId={companyId!}
          db={db}
          clients={clients || []}
          employees={employees || []}
          departments={departments || []}
          rooms={allRooms}
          activityTypes={activityTypes || []}
          existingAppts={rawAppointments || []}
          isRtl={isRtl}
          t={t}
          onDelete={(id: string) => setDeletingId(id)}
          dir={dir}
          settings={settings}
          isAdmin={isAdmin}
          officialUserName={globalUser?.fullName || user.displayName || 'Admin'}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if(!v) setDeletingId(null); forceThaw(); }}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <Trash2 className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{isRtl ? 'حذف حجز القاعة' : 'Cancel Hall Booking'}</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {isRtl ? 'هل أنت متأكد؟ سيتم إزالة هذا الاجتماع من رادار القاعات نهائياً. لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This meeting will be permanently removed from the halls radar. This cannot be undone.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white" onClick={() => { setDeletingId(null); forceThaw(); }}>إلغاء</AlertDialogCancel>
               <AlertDialogAction onClick={() => confirmDelete()} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl">
                  {isRtl ? 'نعم، احذف الحجز' : 'Confirm Delete'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HallGridSection({ title, slots, rooms, appts, onAction, onDelete, isRtl, t, settings, dateStr, router, isAdmin }: any) {
  if (slots.length === 0) return null;

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
                   <th className="w-16 p-2 border-b border-slate-100 font-black text-[9px] text-slate-400 uppercase tracking-tighter bg-slate-50/50 print:p-1 print:w-10">{isRtl ? 'الوقت' : 'Time'}</th>
                   {rooms.map((room: MeetingRoom) => (
                      <th key={room.id} className="p-3 border-b border-slate-100 border-s border-s-slate-50 min-w-[120px] print:p-1">
                         <div className="flex flex-col items-center text-center">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2 shrink-0"><Landmark className="h-4 w-4" /></div>
                            <span className="font-black text-slate-800 text-[11px] leading-none block truncate">{isRtl ? room.name : room.nameEn}</span>
                         </div>
                      </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {slots.map((slot: string) => {
                  const slotStart = parse(`${dateStr} ${slot}`, 'yyyy-MM-dd HH:mm', new Date());
                  const slotEnd = addMinutes(slotStart, settings?.meetingRooms?.slotDurationMinutes || 60);

                  return (
                    <tr key={slot} className="group/row">
                       <td className="p-3 text-center border-b border-slate-50 border-e border-e-slate-50 font-mono font-black text-slate-300 text-[10px] bg-slate-50/20">{slot}</td>
                       {rooms.map((room: MeetingRoom) => {
                          const appt = appts.find((a: any) => {
                             const apptStart = parseISO(a.start);
                             const apptEnd = a.end 
                               ? parseISO(a.end) 
                               : addMinutes(apptStart, settings?.meetingRooms?.slotDurationMinutes || 60);
                             
                             return apptStart < slotEnd && slotStart < apptEnd && a.hallId === room.id;
                          });

                          if (appt) {
                             const isCompleted = appt.status === 'completed';
                             const apptStart = parseISO(appt.start);
                             const isStartSlot = apptStart >= slotStart && apptStart < slotEnd;

                             return (
                               <td key={room.id} className="p-0.5 border-b border-slate-50 border-s border-s-slate-50 align-top">
                                  <div className="relative h-full">
                                    <Card 
                                      onClick={() => router.push('/dashboard/appointments/' + appt.id)}
                                      className={cn(
                                        "p-1.5 rounded-lg h-full transition-all cursor-pointer min-h-[44px] border-2 hover:shadow-lg",
                                        isCompleted ? "bg-emerald-50/50 border-emerald-500/20" : "bg-white shadow-sm"
                                      )}
                                      style={{ borderInlineStartColor: appt.departmentColor || '#FFA000', borderInlineStartWidth: '6px' }}
                                    >
                                      <div className="text-start space-y-0.5 pr-6">
                                          {isStartSlot && (
                                            <>
                                              <p className="font-black text-[9px] leading-tight truncate text-slate-900">{appt.clientName}</p>
                                              <div className="flex items-center gap-1 text-[7px] font-bold text-slate-400">
                                                <Users className="h-2.5 w-2.5" /> {appt.engineerName}
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
                                            <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => router.push('/dashboard/appointments/' + appt.id)}>
                                              <Eye className="h-3.5 w-3.5" /> {isRtl ? 'عرض الرادار الفني' : 'View Tech Radar'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => onAction('edit', room, slot, appt)}>
                                              <Edit3 className="h-3.5 w-3.5" /> {isRtl ? 'تعديل بيانات الحجز' : 'Edit Booking'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="font-black text-xs gap-2 text-rose-600" onClick={() => onDelete(appt.id)}>
                                              <Trash2 className="h-3.5 w-3.5" /> {isRtl ? 'حذف وإلغاء الحجز' : 'Cancel Booking'}
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
                              key={room.id} 
                              onClick={() => onAction('create', room, slot)}
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

function HallBookingDialog({ isOpen, onClose, data, companyId, db, clients, employees, departments, rooms, activityTypes, existingAppts, isRtl, t, onDelete, dir, settings, isAdmin, officialUserName }: any) {
  const [loading, setLoading] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '', clientId: '', clientName: '', departmentId: '', departmentName: '', departmentColor: '',
    activityTypeId: '', activityTypeName: '',
    engineerId: '', engineerName: '', additionalEngineerIds: [] as string[],
    date: '', time: '', notes: '', endTime: '', transactionId: '', transactionNumber: ''
  });

  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [eligibilityBlocker, setEligibilityBlocker] = useState<string | null>(null);

  const isEdit = data?.mode === 'edit';

  const filteredDepartments = useMemo(() => {
    return (departments || []).filter((d: any) => {
       const nAr = d.name || '';
       const nEn = d.nameEn || '';
       const isArch = nAr.includes('معماري') || nEn.toLowerCase().includes('arch');
       return !isArch;
    });
  }, [departments]);

  const specializedEngineers = useMemo(() => {
    if (!formData.departmentId) return employees;
    return employees.filter((e: any) => e.departmentId === formData.departmentId);
  }, [employees, formData.departmentId]);

  useEffect(() => {
    if (isOpen && data) {
       if (isEdit && data.appointment) {
          const appt = data.appointment;
          setFormData({
             title: appt.title || '',
             clientId: appt.clientId || '',
             clientName: appt.clientName || '',
             departmentId: appt.departmentId || '',
             departmentName: appt.departmentName || '',
             departmentColor: appt.departmentColor || '',
             activityTypeId: appt.activityTypeId || '',
             activityTypeName: appt.activityTypeName || '',
             engineerId: appt.engineerId || '',
             engineerName: appt.engineerName || '',
             additionalEngineerIds: appt.additionalEngineerIds || [],
             date: format(parseISO(appt.start), 'yyyy-MM-dd'),
             time: format(parseISO(appt.start), 'HH:mm'),
             endTime: appt.end ? format(parseISO(appt.end), 'HH:mm') : '',
             notes: appt.notes || '',
             transactionId: appt.transactionId || '',
             transactionNumber: appt.transactionNumber || ''
          });
          if (appt.clientId) fetchClientTransactions(appt.clientId, appt.activityTypeId);
       } else if (data.room) {
          const startTime = data.slot || '08:00';
          const start = parse(startTime, 'HH:mm', new Date());
          const duration = settings?.meetingRooms?.slotDurationMinutes || 60;
          const endTime = format(addMinutes(start, duration), 'HH:mm');

          setFormData(prev => ({
            ...prev,
            date: format(new Date(), 'yyyy-MM-dd'),
            time: startTime,
            endTime: endTime,
            engineerId: '', additionalEngineerIds: [],
            clientId: '', departmentId: '', transactionId: '', transactionNumber: '',
            activityTypeId: '', activityTypeName: ''
          }));
       }
    }
  }, [isOpen, data, isEdit, settings]);

  const fetchClientTransactions = async (cid: string, actId?: string) => {
    if (!db || !companyId) return;
    const transPath = paths.transactions(companyId);
    let q = query(collection(db, transPath), where('clientId', '==', cid));
    
    getDocs(q)
      .then(snap => {
        let trans = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (actId) {
          trans = trans.filter((t: any) => t.activityTypeId === actId);
        }
        setClientTransactions(trans);
        if (trans.length === 1) {
          const t = trans[0];
          setFormData(prev => ({ ...prev, transactionId: t.id, transactionNumber: t.transactionNumber }));
        } else {
          setFormData(prev => ({ ...prev, transactionId: '', transactionNumber: '' }));
        }
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: transPath,
          operation: 'list'
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
      });
  };

  const handleActivityChange = (v: string) => {
     const act = activityTypes.find((a: any) => a.id === v);
     setFormData(prev => ({ ...prev, activityTypeId: v, activityTypeName: act?.name || '' }));
     if (formData.clientId) {
        fetchClientTransactions(formData.clientId, v);
     }
  };

  const checkEligibility = async (transId: string, deptId: string) => {
    if (!db || !companyId || !transId || !deptId) {
      setEligibilityBlocker(null);
      return;
    }
    setEligibilityLoading(true);
    const stagesPath = paths.transactionStages(companyId, transId);
    getDocs(query(collection(db, stagesPath), orderBy('order')))
      .then(snap => {
        const allStages = snap.docs.map(d => d.data() as StageInstance);
        const deptStages = allStages.filter(s => s.allowedDepartmentIds?.includes(deptId));

        if (deptStages.length > 0) {
          const firstDeptOrder = deptStages[0].order;
          const previousIncomplete = allStages.find(s => s.order < firstDeptOrder && s.status !== 'completed');
          setEligibilityBlocker(previousIncomplete ? previousIncomplete.name : null);
        } else {
          setEligibilityBlocker(null);
        }
        setEligibilityLoading(false);
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: stagesPath,
          operation: 'list'
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setEligibilityLoading(false);
      });
  };

  useEffect(() => {
    if (formData.transactionId && formData.departmentId) {
      checkEligibility(formData.transactionId, formData.departmentId);
    } else {
      setEligibilityBlocker(null);
    }
  }, [formData.transactionId, formData.departmentId]);

  const handleSave = () => {
    if (!db || !companyId || !formData.clientId || !formData.engineerId || !data || eligibilityBlocker) return;

    const start = new Date(`${formData.date}T${formData.time}:00`);
    const duration = settings?.meetingRooms?.slotDurationMinutes || 60;
    const end = formData.endTime 
      ? new Date(`${formData.date}T${formData.endTime}:00`)
      : addMinutes(start, duration);
    
    if (!isAdmin && start < new Date()) {
       toast({ variant: "destructive", title: isRtl ? "تنبيه: لا يمكن الحجز في وقت سابق" : "Alert: Cannot book in the past" });
       return;
    }

    const targetEngineers = [formData.engineerId, ...formData.additionalEngineerIds];
    
    for (const appt of existingAppts) {
        if (appt.status === 'cancelled' || appt.id === data.appointment?.id) continue;
        const apptStart = new Date(appt.start);
        const apptEnd = appt.end ? new Date(appt.end) : addMinutes(apptStart, settings?.meetingRooms?.slotDurationMinutes || 60);
        const isOverlapping = start < apptEnd && apptStart < end;

        if (isOverlapping) {
            if (appt.hallId === data.room?.id) { toast({ variant: "destructive", title: isRtl ? "القاعة مشغولة" : "Hall Busy" }); return; }
            if (appt.clientId === formData.clientId) { toast({ variant: "destructive", title: isRtl ? "تعارض للعميل" : "Client Conflict" }); return; }
            const apptEngineers = [appt.engineerId, ...(appt.additionalEngineerIds || [])];
            const overlappingEng = targetEngineers.find(id => apptEngineers.includes(id));
            if (overlappingEng) { toast({ variant: "destructive", title: isRtl ? "تعارض للمهندس" : "Engineer Conflict" }); return; }
        }
    }

    setLoading(true);
    const client = clients.find((c: any) => c.id === formData.clientId);
    const dept = departments.find((d: any) => d.id === formData.departmentId);
    const eng = employees.find((e: any) => e.id === formData.engineerId);
    const addEngNames = formData.additionalEngineerIds.map((id: string) => employees.find((e: any) => e.id === id)?.fullName || '');

    const payload: any = {
      title: formData.title || (isRtl ? 'اجتماع فني' : 'Professional Meeting'),
      clientId: formData.clientId,
      clientName: client?.nameAr || '',
      departmentId: formData.departmentId,
      departmentName: dept?.name || '',
      departmentColor: dept?.color || '#FFA000',
      activityTypeId: formData.activityTypeId,
      activityTypeName: formData.activityTypeName,
      engineerId: formData.engineerId,
      engineerName: eng?.fullName || '',
      additionalEngineerIds: formData.additionalEngineerIds,
      additionalEngineerNames: addEngNames,
      notes: formData.notes,
      start: start.toISOString(),
      end: end.toISOString(),
      transactionId: formData.transactionId,
      transactionNumber: formData.transactionNumber,
      updatedAt: serverTimestamp(),
      recordedByName: officialUserName 
    };

    const apptsPath = paths.appointments(companyId);
    
    if (isEdit) {
      const docRef = doc(db, apptsPath, data.appointment.id);
      updateDoc(docRef, payload)
        .then(() => {
          toast({ title: t('saved') });
          onClose();
        })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: payload
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          setLoading(false);
        });
    } else {
      const newDocData = {
        ...payload,
        companyId,
        type: 'hall_meeting',
        status: 'scheduled' as AppointmentStatus,
        hallId: data.room.id,
        hallName: data.room.name,
        createdAt: serverTimestamp(),
        createdBy: officialUserName 
      };
      addDoc(collection(db, apptsPath), newDocData)
        .then(() => {
          toast({ title: t('saved') });
          onClose();
        })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: apptsPath,
            operation: 'create',
            requestResourceData: newDocData
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          setLoading(false);
        });
    }
  };

  if (!isOpen || !data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl text-start" dir={dir}>
        <div className="bg-primary/5 p-8 border-b flex items-center justify-between shrink-0 relative">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm"><Landmark className="h-6 w-6" /></div>
              <div>
                 <DialogTitle className="text-2xl font-black font-headline">
                    {isEdit ? (isRtl ? 'تعديل حجز القاعة' : 'Edit Booking') : (isRtl ? 'حجز قاعة اجتماع' : 'Room Booking')}
                 </DialogTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {isRtl ? `القاعة: ${data.room?.name || data.appointment?.hallName}` : `Room: ${data.room?.nameEn || data.appointment?.hallName}`}
                 </p>
              </div>
           </div>
           <Badge className="bg-slate-900 text-white font-black h-8 px-4 rounded-xl text-lg">{formData.time}</Badge>
        </div>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide bg-white">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'العميل المالك' : 'Client'}</Label>
                 <Select value={formData.clientId} onValueChange={v => {
                   const c = clients.find((x:any) => x.id === v);
                   setFormData({...formData, clientId: v, clientName: c?.nameAr || '', transactionId: '', transactionNumber: '', activityTypeId: '', activityTypeName: ''});
                   if (v) fetchClientTransactions(v);
                 }}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {clients.map((c: any) => <SelectItem key={c.id} value={c.id} className="font-bold">{c.nameAr}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1">
                    <Activity className="h-3 w-3" /> {isRtl ? 'نوع نشاط الاجتماع' : 'Meeting Activity'}
                 </Label>
                 <Select disabled={!formData.clientId} value={formData.activityTypeId} onValueChange={handleActivityChange}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white">
                       <SelectValue placeholder={isRtl ? "تحديد التخصص..." : "Select specialty..."} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {activityTypes.map((act: any) => (
                         <SelectItem key={act.id} value={act.id} className="font-bold">
                            {isRtl ? act.name : act.nameEn}
                         </SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
           </div>

           {formData.clientId && formData.activityTypeId && (
             <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black uppercase text-primary flex items-center gap-1.5">
                      <Workflow className="h-3 w-3" /> {isRtl ? `ربط بالمعاملة المفتوحة (${formData.activityTypeName})` : `Link to ${formData.activityTypeName} Project`}
                   </Label>
                   <Select value={formData.transactionId} onValueChange={v => {
                      const t = clientTransactions.find(x => x.id === v);
                      setFormData({...formData, transactionId: v, transactionNumber: t?.transactionNumber || ''});
                   }}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs bg-white shadow-sm">
                         <SelectValue placeholder={clientTransactions.length === 0 ? (isRtl ? "لا يوجد معاملات لهذا التخصص" : "No projects for this specialty") : "..."} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[161]">
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
                         <p className="text-[10px] font-black text-rose-900 uppercase">قيد تسلسلي (Sequence Locked)</p>
                         <p className="text-[9px] font-bold text-rose-700 leading-relaxed">
                            {isRtl 
                              ? `لا يمكن حجز هذا الاجتماع للقسم المختار قبل إنجاز مرحلة "${eligibilityBlocker}" السابقة.` 
                              : `Cannot book for this department until "${eligibilityBlocker}" is completed.`}
                         </p>
                      </div>
                   </div>
                )}
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'القسم المسؤول' : 'Department'}</Label>
                 <Select value={formData.departmentId} onValueChange={v => {
                    const d = departments.find((x:any) => x.id === v);
                    setFormData({...formData, departmentId: v, departmentName: d?.name || '', departmentColor: d?.color || '#FFA000', engineerId: ''});
                 }}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {filteredDepartments.map((d: any) => (
                         <SelectItem key={d.id} value={d.id} className="font-bold">
                            <div className="flex items-center gap-2">
                               <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color || '#ccc' }} />
                               {isRtl ? d.name : d.nameEn}
                            </div>
                         </SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>

              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-primary flex items-center gap-2">
                   <Briefcase className="h-4 w-4" /> {isRtl ? 'المهندس المسؤول' : 'Lead Engineer'}
                 </Label>
                 <Select value={formData.engineerId} onValueChange={v => setFormData({...formData, engineerId: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-black">
                       <SelectValue placeholder="..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl z-[160]">
                       {specializedEngineers.map((e: any) => <SelectItem key={e.id} value={e.id} className="font-bold">{e.fullName}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
           </div>

           <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'مهندسين مشاركين' : 'Supporting Team'}</Label>
              <ScrollArea className="h-32 rounded-xl bg-slate-50/50 border-2 p-3 shadow-inner">
                 <div className="grid grid-cols-2 gap-2">
                    {employees.filter((e: any) => e.id !== formData.engineerId).map((e: any) => (
                      <div key={e.id} className="flex items-center space-x-2 space-x-reverse">
                         <Checkbox id={`eng-${e.id}`} checked={formData.additionalEngineerIds.includes(e.id)} onCheckedChange={(checked) => {
                            const ids = checked ? [...formData.additionalEngineerIds, e.id] : formData.additionalEngineerIds.filter((id: string) => id !== e.id);
                            setFormData({...formData, additionalEngineerIds: ids});
                         }} />
                         <label htmlFor={`eng-${e.id}`} className="text-[10px] font-bold cursor-pointer text-slate-600">{e.fullName}</label>
                      </div>
                    ))}
                 </div>
              </ScrollArea>
           </div>

           <div className="space-y-1.5">
             <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">غرض الموعد</Label>
             <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-12 rounded-xl border-2 font-bold bg-slate-50/30" />
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0 shadow-lg">
           <div className="flex-1 flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-[1.5rem] font-bold border-2 bg-white text-slate-900">
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              {isEdit && (
                <Button variant="ghost" onClick={() => onDelete(data?.appointment?.id)} className="flex-1 h-14 rounded-[1.5rem] font-black text-rose-600 bg-rose-50 border-2 border-rose-100 gap-2"><Trash2 className="h-4 w-4" />{isRtl ? 'حذف' : 'Delete'}</Button>
              )}
           </div>
           <Button 
             onClick={handleSave} 
             disabled={loading || eligibilityLoading || !formData.clientId || !formData.activityTypeId || !formData.engineerId || !!eligibilityBlocker} 
             className="flex-1 h-14 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 gap-3 border-b-8 border-orange-700 hover:scale-105 transition-all"
           >
              {loading || eligibilityLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
              {isRtl ? 'تأكيد الحجز' : 'Confirm'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}