'use client';

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Send, MessageSquare, MoreVertical, 
  Trash2, Loader2, Hammer, User,
  History, Clock, Zap, Archive, FilterX,
  Calendar, Printer, CheckCircle2, Timer,
  RotateCcw, FileText
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentService } from '@/services/comment-service';
import { TransactionComment, CommentType, StageInstance, TransactionTimelineEvent } from '@/types/transaction';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInHours, differenceInDays } from 'date-fns';
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
}

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
  technicalStageId
}: Props) {
  const { user, globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'timeline'>('active');

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

  // التدفق النشط (التعليقات غير المؤرشفة + سجلات الإنجاز الميداني)
  const activeStream = useMemo(() => {
    const filteredComments = (comments || []).filter(c => !c.isArchived && (!filterStageId || c.stageInstanceId === filterStageId)).map(c => ({ 
      ...c, 
      streamType: 'comment' as const,
      sortTime: c.createdAt?.toMillis?.() || Date.now()
    }));
    
    const filteredLogs = (externalLogs || []).filter(l => !technicalStageId || l.technicalStageId === technicalStageId).map(l => ({ 
      ...l, 
      streamType: 'log' as const,
      sortTime: l.createdAt?.toMillis?.() || Date.now()
    }));

    return [...filteredComments, ...filteredLogs].sort((a, b) => a.sortTime - b.sortTime);
  }, [comments, externalLogs, filterStageId, technicalStageId]);

  // الأرشيف النصي (التعليقات المؤرشفة فقط)
  const archivedComments = useMemo(() => {
    return (comments || []).filter(c => c.isArchived === true && (!filterStageId || c.stageInstanceId === filterStageId));
  }, [comments, filterStageId]);

  // الأرشيف الزمني (سجلات التراجع والمدد الضائعة)
  const archivedTimeEvents = useMemo(() => {
    return (timelineEvents || []).filter(e => e.type === 'stage_reopen' && (!filterStageId || e.stageId === filterStageId));
  }, [timelineEvents, filterStageId]);

  const handleSubmit = async () => {
    if (!commentService || !user || !content.trim()) return;
    setLoading(true);
    try {
      await commentService.addTransactionComment(
        transactionId, 
        content, 
        user.uid, 
        user.displayName || 'User',
        filterStageId,
        selectedStageName
      );
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try { await commentService?.deleteComment(path, commentId); } catch(e) {}
  };

  return (
    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col h-full gap-4">
      <div className="flex flex-col gap-4 print:hidden shrink-0">
        <div className="flex items-center justify-between px-1">
           <h3 className="text-sm font-black flex items-center gap-2 text-slate-500 uppercase tracking-widest">
             <MessageSquare className="h-4 w-4 text-primary" /> {title || (isRtl ? 'غرفة عمليات المعاملة' : 'War Room')}
           </h3>
           {filterStageId && (
              <button onClick={onClearFilter} className="h-8 rounded-lg text-[10px] font-black gap-2 bg-primary/5 text-primary px-3 flex items-center">
                 <FilterX className="h-3 w-3" /> {isRtl ? 'عرض الكل' : 'View All'}
              </button>
           )}
        </div>

        <TabsList className={cn("grid w-full h-11 bg-slate-100/50 rounded-xl p-1", isAdmin ? "grid-cols-3" : "grid-cols-1")}>
            <TabsTrigger value="active" className="rounded-lg text-[10px] font-black data-[state=active]:bg-white">
               {isRtl ? 'النشاط' : 'Activity'}
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="timeline" className="rounded-lg text-[10px] font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white gap-2">
                   <Clock className="h-3 w-3" /> {isRtl ? 'الزمني' : 'Timeline'}
                </TabsTrigger>
                <TabsTrigger value="archived" className="rounded-lg text-[10px] font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white gap-2">
                   <Archive className="h-3 w-3" /> {isRtl ? 'الأرشيف' : 'Archive'}
                </TabsTrigger>
              </>
            )}
         </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
        <TabsContent value="active" className="mt-0 space-y-6">
           {commentsLoading ? (
             <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div>
           ) : (
             activeStream.map((item: any) => (
                <StreamItem key={item.id || item.sortTime} item={item} isRtl={isRtl} user={user} boqItems={boqItems} onDelete={handleDelete} />
             ))
           )}
        </TabsContent>

        <TabsContent value="archived" className="mt-0 space-y-10 text-start">
           <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                 <MessageSquare className="h-3 w-3" /> {isRtl ? 'النقاشات الميدانية المؤرشفة' : 'Archived Discussions'}
              </h4>
              <div className="space-y-6">
                 {archivedComments.map((item) => (
                    <StreamItem key={item.id} item={{...item, streamType: 'comment'}} isRtl={isRtl} user={user} boqItems={boqItems} />
                 ))}
                 {!archivedComments.length && <p className="text-[10px] text-slate-300 font-bold italic py-10 text-center">لا توجد تعليقات مؤرشفة.</p>}
              </div>
           </div>

           <div className="space-y-6">
              <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest border-b border-rose-100 pb-2 flex items-center gap-2">
                 <RotateCcw className="h-3 w-3" /> {isRtl ? 'أرشيف المحاولات الزمنية' : 'Archived Time Attempts'}
              </h4>
              <div className="space-y-3">
                 {archivedTimeEvents.map((event, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-rose-50/30 border border-rose-100 flex justify-between items-center group">
                       <div className="text-start">
                          <p className="text-[9px] font-black text-rose-700">{event.content}</p>
                          <div className="flex gap-4 mt-1 text-[7px] font-bold text-slate-400 uppercase">
                             <span>Start: {event.previousStart?.toDate().toLocaleDateString()}</span>
                             <span>End: {event.previousEnd?.toDate().toLocaleDateString()}</span>
                          </div>
                       </div>
                       <Badge variant="ghost" className="text-[8px] font-mono text-rose-300">Attempt Archive</Badge>
                    </div>
                 ))}
                 {!archivedTimeEvents.length && <p className="text-[10px] text-slate-300 font-bold italic py-10 text-center">لا توجد سجلات زمنية مؤرشفة.</p>}
              </div>
           </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 space-y-6 text-start">
           <div className="space-y-4 print:space-y-8">
              {stages.sort((a,b)=> (a.order||0) - (b.order||0)).map((stage, idx) => {
                 const start = stage.startedAt?.toDate();
                 const end = stage.completedAt?.toDate();
                 
                 let durationText = isRtl ? 'لم تبدأ' : 'Not Started';
                 let durationValue = "";
                 
                 if (start && end) {
                    const days = differenceInDays(end, start);
                    const hours = differenceInHours(end, start) % 24;
                    durationText = isRtl ? 'مدة التنفيذ' : 'Execution Time';
                    durationValue = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                 }

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
                          <h4 className="font-black text-xs text-slate-900">{stage.name}</h4>
                          <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                             <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Start</p>
                                <p className="text-[9px] font-bold text-slate-600">{start ? start.toLocaleString() : '---'}</p>
                             </div>
                             <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase">End</p>
                                <p className="text-[9px] font-bold text-slate-600">{end ? end.toLocaleString() : '---'}</p>
                             </div>
                          </div>
                          {durationValue && (
                             <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0 text-[8px] font-black">{durationText}: {durationValue}</Badge>
                          )}
                       </div>
                    </div>
                 );
              })}
           </div>
        </TabsContent>
      </div>

      {activeTab === 'active' && (
        <Card className="border-2 border-slate-100 shadow-2xl rounded-[2rem] overflow-hidden bg-white mt-auto ring-4 ring-black/[0.02] print:hidden shrink-0">
          <CardContent className="p-3 flex items-end gap-2">
             <Textarea 
               value={content}
               onChange={e => setContent(e.target.value)}
               placeholder={isRtl ? (filterStageId ? `اكتب ملاحظة في مرحلة ${selectedStageName}...` : "اكتب تعليقاً عاماً...") : "Write a comment..."}
               className="min-h-[44px] max-h-[150px] rounded-2xl border-0 focus-visible:ring-0 text-sm font-bold bg-slate-50/50 resize-none p-4"
             />
             <Button 
               onClick={handleSubmit} 
               disabled={loading || !content.trim()}
               size="icon" 
               className="h-12 w-12 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 shrink-0 hover:scale-110 transition-transform"
             >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className={cn("h-6 w-6", isRtl && "rotate-180")} />}
             </Button>
          </CardContent>
        </Card>
      )}
    </Tabs>
  );
}

function StreamItem({ item, isRtl, user, boqItems, onDelete }: any) {
   const isLog = item.streamType === 'log';
   if (isLog) {
      const boqItem = boqItems?.find((i: any) => i.id === item.boqItemId);
      const isComplementary = item.quantity === 0;
      return (
         <div className="flex justify-center animate-in fade-in duration-500">
            <div className={cn(
              "border-2 shadow-md rounded-[1.5rem] p-4 w-full md:w-[95%] relative transition-all",
              isComplementary ? "bg-blue-50/50 border-blue-100" : "bg-emerald-50/30 border-emerald-100"
            )}>
               <div className="flex items-start gap-4">
                 <div className={cn(
                   "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                   isComplementary ? "bg-white text-blue-500" : "bg-white text-emerald-600"
                 )}>
                   {isComplementary ? <Zap className="h-5 w-5" /> : <Hammer className="h-5 w-5" />}
                 </div>
                 <div className="text-start flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                       <Badge variant="outline" className="text-[8px] font-black border-slate-200 bg-white text-slate-600 px-2 truncate">
                          {boqItem?.referenceTitle || (isRtl ? 'بند مجهول' : 'Unknown Item')}
                       </Badge>
                       {!isComplementary && <Badge className="bg-emerald-600 text-white border-0 text-[8px] h-4 px-2">{item.quantity} QTY</Badge>}
                    </div>
                    {item.notes && <p className="text-xs font-bold text-slate-600 italic">"{item.notes}"</p>}
                    <div className="flex items-center gap-3 mt-2 text-[8px] font-black text-slate-400 uppercase">
                       <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" /> {item.recordedByName}</span>
                       <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}</span>
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
        <Avatar className="h-9 w-9 rounded-2xl shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-100">
           <AvatarImage src={`https://picsum.photos/seed/${item.createdBy}/40/40`} />
           <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">{item.createdByName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex flex-col space-y-1 max-w-[85%]", isMine ? "items-end" : "items-start")}>
           <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-black text-slate-700">{item.createdByName}</span>
              <span className="text-[8px] font-bold text-slate-300">
                 {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}
              </span>
           </div>
           <div className={cn(
             "p-4 rounded-[1.5rem] shadow-sm text-sm font-bold leading-relaxed relative group transition-all",
             isMine ? "bg-[#e87c24] text-white rounded-te-none" : "bg-white border-2 border-slate-50 text-slate-700 rounded-ts-none",
             item.isArchived && "opacity-60 grayscale border-dashed border-slate-300"
           )}>
              {item.stageName && (
                 <div className="mb-2">
                    <Badge variant="secondary" className="bg-white/10 text-[7px] font-black uppercase text-inherit border-white/20">
                       PHASE: {item.stageName}
                    </Badge>
                 </div>
              )}
              <p className="whitespace-pre-wrap">{item.content}</p>
              
              {!item.isArchived && onDelete && (
                 <div className={cn("absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1", isMine ? "right-full mr-2" : "left-full ml-2")}>
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-300 hover:text-slate-600 bg-white shadow-sm border"><MoreVertical className="h-3.5 w-3.5" /></Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align={isMine ? "end" : "start"} className="rounded-xl border-2">
                          <DropdownMenuItem onClick={() => onDelete(item.id!)} className="text-rose-600 font-bold gap-2 focus:bg-rose-50 cursor-pointer text-xs">
                             <Trash2 className="h-4 w-4" /> {isRtl ? 'حذف التعليق' : 'Delete'}
                          </DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
              )}
           </div>
        </div>
     </div>
   );
}