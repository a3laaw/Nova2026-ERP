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
  RotateCcw
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

  const unifiedStream = useMemo(() => {
    const filteredComments = (comments || []).filter(c => {
      const matchArchive = activeTab === 'archived' ? c.isArchived === true : !c.isArchived;
      const matchStage = !filterStageId || c.stageInstanceId === filterStageId;
      return matchArchive && matchStage;
    }).map(c => ({ 
      ...c, 
      streamType: 'comment' as const,
      sortTime: c.createdAt?.toMillis?.() || (c.createdAt?.seconds ? c.createdAt.seconds * 1000 : Date.now())
    }));
    
    const filteredLogs = (externalLogs || []).filter(l => {
      if (activeTab === 'archived') return false; 
      return !technicalStageId || l.technicalStageId === technicalStageId;
    }).map(l => ({ 
      ...l, 
      streamType: 'log' as const,
      sortTime: l.createdAt?.toMillis?.() || (l.createdAt?.seconds ? l.createdAt.seconds * 1000 : Date.now())
    }));

    return [...filteredComments, ...filteredLogs].sort((a, b) => a.sortTime - b.sortTime);
  }, [comments, externalLogs, activeTab, filterStageId, technicalStageId]);

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
    <div className="flex flex-col h-full gap-4">
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col h-full gap-4">
        <div className="flex flex-col gap-4 print:hidden shrink-0">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-sm font-black flex items-center gap-2 text-slate-500 uppercase tracking-widest">
               <MessageSquare className="h-4 w-4 text-primary" /> {title || (isRtl ? 'غرفة عمليات المعاملة' : 'War Room')}
             </h3>
             {filterStageId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClearFilter}
                  className="h-8 rounded-lg text-[10px] font-black gap-2 bg-primary/5 text-primary"
                >
                   <FilterX className="h-3 w-3" /> {isRtl ? 'عرض الكل' : 'View All'}
                </Button>
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

        {filterStageId && activeTab !== 'timeline' && (
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-center gap-2 animate-in zoom-in-95 print:hidden shrink-0">
             <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
             <span className="text-[10px] font-black text-primary uppercase">
                {isRtl ? 'تركيز على:' : 'Filtered to:'} {selectedStageName}
             </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <TabsContent value="active" className="mt-0 space-y-6">
             {commentsLoading ? (
               <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div>
             ) : (
               unifiedStream.map((item: any) => (
                  <StreamItem key={item.id || item.sortTime} item={item} isRtl={isRtl} user={user} boqItems={boqItems} onDelete={handleDelete} />
               ))
             )}
          </TabsContent>

          <TabsContent value="archived" className="mt-0 space-y-6">
             {unifiedStream.map((item: any) => (
                <StreamItem key={item.id} item={item} isRtl={isRtl} user={user} boqItems={boqItems} />
             ))}
          </TabsContent>

          <TabsContent value="timeline" className="mt-0 space-y-6 text-start">
             <div className="flex justify-between items-center mb-6 print:hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تحليل مسار الإنجاز الزمني' : 'Operational Time Analysis'}</p>
                <Button size="sm" onClick={() => window.print()} variant="outline" className="h-8 rounded-lg text-[10px] font-black gap-2">
                   <Printer className="h-3 w-3" /> {isRtl ? 'طباعة السجل' : 'Print'}
                </Button>
             </div>

             <div className="space-y-4 print:space-y-8">
                {stages.sort((a,b)=> (a.order||0) - (b.order||0)).map((stage, idx) => {
                   const start = stage.startedAt?.toDate();
                   const end = stage.completedAt?.toDate();
                   
                   // رصد كافة المحاولات المؤرشفة لهذه المرحلة تحديداً
                   const archivedAttempts = (timelineEvents || []).filter(e => e.type === 'stage_reopen' && e.stageId === stage.id);
                   
                   let durationText = isRtl ? 'لم تبدأ' : 'Not Started';
                   let durationValue = "";
                   
                   if (start && end) {
                      const days = differenceInDays(end, start);
                      const hours = differenceInHours(end, start) % 24;
                      durationText = isRtl ? 'مدة المحاولة الحالية' : 'Current Attempt';
                      durationValue = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                   } else if (start && !end) {
                      const hoursNow = differenceInHours(new Date(), start);
                      durationText = isRtl ? 'قيد التنفيذ منذ' : 'Running for';
                      durationValue = `${hoursNow}h`;
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
                            <div className="flex items-center justify-between">
                               <h4 className="font-black text-xs text-slate-900">{stage.name}</h4>
                               {archivedAttempts.length > 0 && (
                                 <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 text-[7px] font-black uppercase px-2 h-4">
                                   {archivedAttempts.length} Re-Work
                                 </Badge>
                               )}
                            </div>
                            
                            {/* المحاولة الحالية (أو النشطة) */}
                            <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                               <div className="space-y-1">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'بدء المحاولة' : 'Attempt Start'}</p>
                                  <p className="text-[9px] font-bold text-slate-600">{start ? start.toLocaleString(isRtl ? 'ar-KW' : 'en-US') : '---'}</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'إغلاق المحاولة' : 'Attempt Finish'}</p>
                                  <p className="text-[9px] font-bold text-slate-600">{end ? end.toLocaleString(isRtl ? 'ar-KW' : 'en-US') : '---'}</p>
                               </div>
                            </div>

                            {start && (
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border text-primary">
                                 <Timer className="h-3 w-3" />
                                 <span className="text-[9px] font-black uppercase">{durationText}: {durationValue}</span>
                              </div>
                            )}

                            {/* سجل الأرشيف الزمني (المحاولات السابقة) */}
                            {archivedAttempts.length > 0 && (
                               <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                                  <p className="text-[8px] font-black text-rose-400 uppercase flex items-center gap-1 border-b border-rose-100 pb-1">
                                     <RotateCcw className="h-2.5 w-2.5" /> {isRtl ? 'تاريخ التراجع (محاولات مؤرشفة)' : 'Archived History (Undone)'}
                                  </p>
                                  {archivedAttempts.map((attempt: any, aIdx: number) => (
                                     <div key={aIdx} className="p-2.5 rounded-lg bg-rose-50/30 border border-rose-100/50 flex justify-between items-center group/attempt hover:bg-rose-50 transition-all">
                                        <div className="text-start">
                                           <p className="text-[9px] font-black text-rose-700">{isRtl ? 'المدة الضائعة:' : 'Duration:'} {attempt.durationText || '---'}</p>
                                           <div className="flex gap-2 mt-0.5 text-[7px] font-bold text-slate-400 uppercase">
                                              <span>Start: {attempt.previousStart ? attempt.previousStart.toDate().toLocaleDateString() : '---'}</span>
                                              <span>End: {attempt.previousEnd ? attempt.previousEnd.toDate().toLocaleDateString() : '---'}</span>
                                           </div>
                                        </div>
                                        <div className="text-end shrink-0">
                                           <Badge variant="ghost" className="text-[7px] font-mono text-rose-300">#{archivedAttempts.length - aIdx}</Badge>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>
                      </div>
                   );
                })}
             </div>
          </TabsContent>
        </div>

        {activeTab !== 'timeline' && (
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
    </div>
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