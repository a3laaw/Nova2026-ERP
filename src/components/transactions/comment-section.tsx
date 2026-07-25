'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Send, MessageSquare, MoreVertical, 
  Trash2, Loader2, Hammer, User,
  History, Clock, Zap, Archive, FilterX,
  Calendar, Printer, CheckCircle2, Timer,
  RotateCcw, FileText, LayoutGrid, X,
  Target, Pencil, Check, ChevronLeft, ChevronRight,
  Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentService } from '@/services/comment-service';
import { TransactionComment, CommentType, StageInstance } from '@/types/transaction';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { paths } from '@/firebase/multi-tenant';
import { toast } from '@/hooks/use-toast';

interface Props {
  transactionId: string;
  path: string; 
  title?: string;
  externalLogs?: any[]; 
  boqItems?: any[];     
  stages?: StageInstance[];
  filterStageId?: string | null;
  onClearFilter?: () => void;
  selectedStageName?: string;
  technicalStageId?: string | null;
  activeTabOverride?: 'active' | 'timeline' | 'chat_archive' | 'time_archive';
  appointmentId?: string; 
  onlyComments?: boolean; 
}

const PAGE_SIZE = 10;

export function CommentSection({ 
  transactionId, 
  path, 
  title, 
  externalLogs = [], 
  boqItems = [],
  stages = [],
  filterStageId = null,
  onClearFilter,
  selectedStageName,
  technicalStageId,
  activeTabOverride,
  appointmentId,
  onlyComments = false
}: Props) {
  const { user, globalUser } = useAuthContext();
  const { lang, dir, t: translate } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'timeline' | 'chat_archive' | 'time_archive'>('active');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  // إعادة تعيين الصفحة عند تغيير التبويب أو الفلتر
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterStageId]);

  const commentsQuery = useMemo(() => 
    db ? query(collection(db, path), orderBy('createdAt', 'asc')) : null, 
  [db, path]);

  const timelineQuery = useMemo(() => 
    db && globalUser?.companyId ? query(collection(db, paths.transactionTimeline(globalUser.companyId, transactionId)), orderBy('createdAt', 'asc')) : null, 
  [db, globalUser, transactionId]);

  const { data: comments, loading: commentsLoading } = useCollection<TransactionComment>(commentsQuery);
  const { data: timelineEvents } = useCollection<any>(timelineQuery);

  const commentService = useMemo(() => 
    db && globalUser?.companyId ? new CommentService(db, globalUser.companyId, permissions) : null, 
  [db, globalUser, permissions]);

  // تجهيز مصفوفات البيانات الكاملة
  const allActiveItems = useMemo(() => {
    const filteredComments = (comments || [])
      .filter(c => !c.isArchived && (!filterStageId || c.stageInstanceId === filterStageId))
      .map(c => ({ 
        ...c, 
        streamType: 'comment' as const,
        sortTime: c.createdAt?.toMillis?.() || Date.now()
      }));
    
    if (onlyComments) {
      return filteredComments.sort((a, b) => b.sortTime - a.sortTime); // الأحدث أولاً
    }

    const filteredTimeline = (timelineEvents || [])
      .filter(e => !e.isArchived && (e.type === 'numeric_update' || e.type === 'stage_start' || e.type === 'stage_complete' || e.type === 'revision_logged') && (!technicalStageId || e.technicalStageId === technicalStageId || e.stageId === filterStageId))
      .map(e => ({
        ...e,
        streamType: 'timeline_log' as const,
        sortTime: e.createdAt?.toMillis?.() || Date.now()
      }));

    return [...filteredComments, ...filteredTimeline].sort((a, b) => b.sortTime - a.sortTime);
  }, [comments, timelineEvents, filterStageId, technicalStageId, onlyComments]);

  const allArchivedItems = useMemo(() => {
    return (comments || []).filter(c => c.isArchived).map(c => ({
      ...c,
      streamType: 'comment' as const,
      sortTime: c.createdAt?.toMillis?.() || Date.now()
    })).sort((a, b) => b.sortTime - a.sortTime);
  }, [comments]);

  // حساب الصفحات
  const currentStream = activeTab === 'chat_archive' ? allArchivedItems : allActiveItems;
  const totalPages = Math.ceil(currentStream.length / PAGE_SIZE) || 1;
  const paginatedStream = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return currentStream.slice(start, start + PAGE_SIZE);
  }, [currentStream, currentPage]);

  const handleSubmit = async () => {
    if (!commentService || !user || !content.trim()) return;
    setLoading(true);
    try {
      await commentService.addTransactionComment(
        transactionId, 
        content, 
        user.uid, 
        globalUser?.username || user.displayName || user.email || 'User',
        filterStageId,
        selectedStageName,
        'general',
        appointmentId
      );
      setContent("");
      setCurrentPage(1); // العودة للصفحة الأولى لمشاهدة التعليق الجديد
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!commentService || !confirm(isRtl ? 'حذف هذا التعليق؟' : 'Delete comment?')) return;
    try {
      await commentService.deleteComment(path, commentId);
      toast({ title: translate('deleted') });
    } catch (e) {
      toast({ variant: "destructive", title: translate('error') });
    }
  };

  const handleUpdate = async (commentId: string, newContent: string) => {
    if (!commentService) return;
    try {
      await commentService.updateComment(path, commentId, newContent);
      toast({ title: translate('saved') });
    } catch (e) {
      toast({ variant: "destructive", title: translate('error') });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-start">
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col h-full">
        <div className="flex flex-col gap-4 print:hidden shrink-0">
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                   <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                   <h3 className="text-sm font-black text-slate-800 leading-none">{title || (isRtl ? 'غرفة العمليات' : 'War Room')}</h3>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Sovereign Control Center</p>
                </div>
             </div>
             {onClearFilter && filterStageId && (
                <Button onClick={onClearFilter} variant="ghost" size="sm" className="h-8 rounded-lg text-[9px] font-black gap-2 bg-slate-900 text-white hover:bg-slate-800 px-3 shadow-lg">
                  <X className="h-3 w-3" /> {isRtl ? 'عرض الكل' : 'View All'}
                </Button>
             )}
          </div>

          {!onlyComments && (
            <TabsList className={cn("grid w-full h-11 bg-slate-100/50 rounded-xl p-1 gap-1 mx-1", isAdmin ? "grid-cols-4" : "grid-cols-2")}>
                <TabsTrigger value="active" className="rounded-lg text-[10px] font-black transition-all">
                  {isRtl ? 'النشاط' : 'Active'}
                </TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-lg text-[10px] font-black transition-all">
                  {isRtl ? 'الزمني' : 'Timeline'}
                </TabsTrigger>
                {isAdmin && (
                  <>
                    <TabsTrigger value="chat_archive" className="rounded-lg text-[10px] font-black gap-1.5 transition-all">
                      <Archive className="h-3 w-3" /> {isRtl ? 'الأرشيف' : 'Archive'}
                    </TabsTrigger>
                    <TabsTrigger value="time_archive" className="rounded-lg text-[10px] font-black gap-1.5 transition-all">
                      <Clock className="h-3 w-3" /> {isRtl ? 'تتبع الوقت' : 'Time Arc'}
                    </TabsTrigger>
                  </>
                )}
            </TabsList>
          )}
        </div>

        <div className="flex-1 overflow-y-auto mt-6 px-1 scrollbar-hide">
          <TabsContent value="active" className="m-0 space-y-6 pb-24">
            {commentsLoading ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div>
            ) : paginatedStream.length === 0 ? (
               <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                  <Zap className="h-12 w-12 text-slate-200" />
                  <p className="text-xs font-black text-slate-400">{isRtl ? 'بانتظار الملاحظات الفنية' : 'Awaiting notes...'}</p>
               </div>
            ) : (
              <>
                {paginatedStream.map((item: any) => (
                    <StreamItem key={item.id || item.sortTime} item={item} isRtl={isRtl} user={user} boqItems={boqItems} onDelete={handleDelete} onUpdate={handleUpdate} isAdmin={isAdmin} />
                ))}
                {totalPages > 1 && (
                  <PaginationControl 
                    current={currentPage} 
                    total={totalPages} 
                    onPageChange={setCurrentPage} 
                    isRtl={isRtl} 
                  />
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="chat_archive" className="m-0 space-y-6 pb-24">
             <div className="px-2 py-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-2 mb-4">
                <Info className="h-4 w-4 text-amber-600" />
                <p className="text-[10px] font-bold text-amber-800">{isRtl ? 'تظهر هنا السجلات التي تم استبعادها نتيجة التراجع عن المراحل.' : 'Historical logs from reverted stages.'}</p>
             </div>
             {paginatedStream.map((item: any) => (
                <StreamItem key={item.id} item={item} isRtl={isRtl} user={user} boqItems={boqItems} isArchiveView={true} />
             ))}
             {allArchivedItems.length === 0 && <div className="py-20 text-center text-[10px] text-slate-300 italic font-bold">لا يوجد سجلات مؤرشفة.</div>}
             {totalPages > 1 && (
                <PaginationControl current={currentPage} total={totalPages} onPageChange={setCurrentPage} isRtl={isRtl} />
             )}
          </TabsContent>

          {!onlyComments && (
            <TabsContent value="timeline" className="m-0 space-y-6 pb-24">
                {stages.sort((a,b)=> (a.order||0) - (b.order||0)).map((stage, idx) => {
                  const start = stage.startedAt?.toDate();
                  const end = stage.completedAt?.toDate();
                  return (
                      <div key={stage.id} className="relative ps-8 pb-8 last:pb-0 group/timeline">
                        <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-slate-100 group-last/timeline:hidden" />
                        <div className={cn(
                          "absolute left-0 top-0 h-6 w-6 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10",
                          stage.status === 'completed' ? "bg-emerald-500" : stage.status === 'in-progress' ? "bg-blue-500" : "bg-slate-200"
                        )}>
                            {stage.status === 'completed' ? <CheckCircle2 className="h-3 w-3 text-white" /> : <span className="text-[8px] font-black text-white">{idx+1}</span>}
                        </div>
                        <div className="space-y-2 text-start">
                            <h4 className="font-black text-[11px] text-slate-900">{stage.name}</h4>
                            <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                              <div className="space-y-0.5"><p className="text-[7px] font-black text-slate-400 uppercase">Start</p><p className="text-[8px] font-bold text-slate-600 truncate">{start ? start.toLocaleDateString(isRtl ? 'ar-KW' : 'en-US') : '---'}</p></div>
                              <div className="space-y-0.5"><p className="text-[7px] font-black text-slate-400 uppercase">End</p><p className="text-[8px] font-bold text-slate-600 truncate">{end ? end.toLocaleDateString(isRtl ? 'ar-KW' : 'en-US') : '---'}</p></div>
                            </div>
                        </div>
                      </div>
                  );
                })}
            </TabsContent>
          )}
        </div>

        {activeTab === 'active' && (
          <div className="mt-auto pt-4 bg-white border-t border-slate-50 print:hidden shrink-0">
            <Card className="border-2 border-slate-100 shadow-2xl rounded-[1.5rem] overflow-hidden bg-white ring-4 ring-black/[0.02]">
              <CardContent className="p-2 flex items-end gap-2">
                <Textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={isRtl ? "اكتب تعليقاً في سجل الزيارة..." : "Write a visit note..."}
                  className="min-h-[44px] max-h-[150px] rounded-xl border-0 focus-visible:ring-0 text-xs font-bold bg-slate-50/50 resize-none p-4"
                />
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || !content.trim()}
                  size="icon" 
                  className="h-11 w-11 rounded-xl bg-primary text-white shadow-xl shadow-primary/20 shrink-0 hover:scale-110 transition-transform"
                >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className={cn("h-5 w-5", isRtl && "rotate-180")} />}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  );
}

function PaginationControl({ current, total, onPageChange, isRtl }: any) {
  return (
    <div className="flex items-center justify-center gap-2 pt-6 pb-4">
      <Button 
        variant="outline" 
        size="icon" 
        className="h-8 w-8 rounded-lg border-slate-100" 
        disabled={current === 1}
        onClick={() => onPageChange(current - 1)}
      >
        <ChevronLeft className={cn("h-4 w-4", isRtl && "rotate-180")} />
      </Button>
      
      <div className="flex items-center gap-1.5 px-4 h-8 rounded-full bg-slate-50 border border-slate-100">
         <span className="text-[10px] font-black text-primary">{current.toLocaleString('en-US')}</span>
         <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">of</span>
         <span className="text-[10px] font-black text-slate-600">{total.toLocaleString('en-US')}</span>
      </div>

      <Button 
        variant="outline" 
        size="icon" 
        className="h-8 w-8 rounded-lg border-slate-100" 
        disabled={current === total}
        onClick={() => onPageChange(current + 1)}
      >
        <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
      </Button>
    </div>
  );
}

function StreamItem({ item, isRtl, user, boqItems, onDelete, onUpdate, isAdmin, isArchiveView = false }: any) {
   const [isEditing, setIsEditing] = useState(false);
   const [editContent, setEditContent] = useState(item.content);

   const isLog = item.streamType === 'log' || item.streamType === 'timeline_log';
   const displayName = item.userName || item.createdByName || item.recordedByName || (isRtl ? 'مستخدم' : 'User');

   if (isLog) {
      const boqItem = boqItems?.find((i: any) => i.id === item.boqItemId);
      const isComplementary = item.quantity === 0;
      return (
         <div className="flex justify-center animate-in fade-in duration-500 px-1 text-start">
            <div className={cn(
              "border-2 shadow-md rounded-[1.25rem] p-4 w-full relative transition-all",
              isComplementary ? "bg-blue-50/50 border-blue-100" : "bg-emerald-50/30 border-emerald-100",
              (item.isArchived || isArchiveView) && "opacity-60 grayscale border-dashed border-slate-300"
            )}>
               <div className="flex items-start gap-4">
                 <div className={cn(
                   "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                   isComplementary ? "bg-white text-blue-500" : "bg-white text-emerald-600"
                 )}>
                   {isComplementary ? <Zap className="h-4 w-4" /> : <Hammer className="h-4 w-4" />}
                 </div>
                 <div className="text-start flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                       <Badge variant="outline" className="text-[8px] font-black border-slate-200 bg-white text-slate-600 px-2 truncate max-w-[140px]">
                          {boqItem?.referenceTitle || (isRtl ? 'تحديث إنجاز' : 'Progress Update')}
                       </Badge>
                       {item.quantity > 0 && <Badge className="bg-emerald-600 text-white border-0 text-[8px] h-4 px-2">{item.quantity.toLocaleString('en-US')} QTY</Badge>}
                    </div>
                    <div className="space-y-1 mt-1">
                        <p className="text-[10px] font-black text-slate-800">{item.content}</p>
                        {item.notes && <p className="text-[10px] font-bold text-slate-500 italic border-s-2 border-primary/20 ps-2 py-0.5">"{item.notes}"</p>}
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-black/[0.03] text-[7px] font-black text-slate-400 uppercase">
                       <span className="flex items-center gap-1"><User className="h-2 w-2" /> {displayName}</span>
                       <span className="flex items-center gap-1"><Clock className="h-2 w-2" /> {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}</span>
                    </div>
                 </div>
               </div>
            </div>
         </div>
      );
   }

   const isMine = item.createdBy === user?.uid;
   return (
     <div className={cn("flex gap-3 text-start animate-in fade-in slide-in-from-bottom-2 duration-300", isMine ? "flex-row-reverse" : "flex-row")}>
        <Avatar className="h-8 w-8 rounded-xl shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-100">
           <AvatarImage src={`https://picsum.photos/seed/${item.createdBy}/40/40`} />
           <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">{displayName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex flex-col space-y-1 max-w-[85%]", isMine ? "items-end" : "items-start")}>
           <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] font-black text-slate-700">{displayName}</span>
              <span className="text-[7px] font-bold text-slate-300">
                 {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}
              </span>
              {item.isEdited && <Badge variant="ghost" className="h-3 p-0 text-[6px] font-bold text-slate-300 italic">(edited)</Badge>}
           </div>
           
           <div className={cn(
             "p-3 rounded-[1.25rem] shadow-sm text-xs font-bold leading-relaxed relative group transition-all",
             isMine ? "bg-[#e87c24] text-white rounded-te-none" : "bg-white border-2 border-slate-50 text-slate-700 rounded-ts-none",
             isArchiveView && "opacity-50"
           )}>
              {item.stageName && (
                 <div className="mb-1.5">
                    <Badge variant="secondary" className="bg-white/10 text-[7px] font-black uppercase text-inherit border-white/10">
                       {item.stageName}
                    </Badge>
                 </div>
              )}
              
              {isEditing ? (
                 <div className="space-y-2 min-w-[200px]">
                    <Textarea 
                      value={editContent} 
                      onChange={e => setEditContent(e.target.value)}
                      className="bg-white text-slate-900 border-0 h-10 min-h-[40px] text-xs" 
                    />
                    <div className="flex justify-end gap-1">
                       <Button size="icon" className="h-6 w-6 rounded-md bg-emerald-500" onClick={() => { onUpdate(item.id, editContent); setIsEditing(false); }}><Check className="h-3 w-3" /></Button>
                       <Button size="icon" className="h-6 w-6 rounded-md bg-rose-500" onClick={() => setIsEditing(false)}><X className="h-3 w-3" /></Button>
                    </div>
                 </div>
              ) : (
                 <p className="whitespace-pre-wrap">{item.content}</p>
              )}

              {!isArchiveView && !isEditing && (isMine || isAdmin) && (
                <div className={cn(
                  "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                  isRtl ? (isMine ? "right-full mr-1" : "left-full ml-1") : (isMine ? "left-full ml-1" : "right-full mr-1")
                )}>
                   {isMine && (
                     <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-blue-500" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-3 w-3" />
                     </Button>
                   )}
                   <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-3 w-3" />
                   </Button>
                </div>
              )}
           </div>
        </div>
     </div>
   );
}
