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
  RotateCcw, FileText, LayoutGrid
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentService } from '@/services/comment-service';
import { TransactionComment, CommentType, StageInstance } from '@/types/transaction';
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
  const [activeTab, setActiveTab] = useState<'active' | 'timeline' | 'chat_archive' | 'time_archive'>('active');

  // ذكاء التوجيه: عند اختيار مرحلة من الخارج، ننتقل تلقائياً لتبويب النشاط
  useEffect(() => {
    if (filterStageId) {
      setActiveTab('active');
    }
  }, [filterStageId]);

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

  const archivedChat = useMemo(() => {
    return (comments || []).filter(c => c.isArchived === true && (!filterStageId || c.stageInstanceId === filterStageId));
  }, [comments, filterStageId]);

  const archivedTime = useMemo(() => {
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
        user.displayName || user.email || 'User',
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
    <div className="flex flex-col h-full bg-white">
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col h-full">
        <div className="flex flex-col gap-4 print:hidden shrink-0 px-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black flex items-center gap-2 text-slate-500 uppercase tracking-widest">
              <MessageSquare className="h-4 w-4 text-primary" /> {title || (isRtl ? 'غرفة العمليات' : 'War Room')}
            </h3>
            {filterStageId && (
                <button onClick={onClearFilter} className="h-7 rounded-lg text-[9px] font-black gap-2 bg-primary/10 text-primary px-3 flex items-center shadow-sm">
                  <FilterX className="h-3 w-3" /> {isRtl ? 'عرض الكل' : 'Clear Filter'}
                </button>
            )}
          </div>

          <TabsList className={cn("grid w-full h-10 bg-slate-100/50 rounded-xl p-1", isAdmin ? "grid-cols-4" : "grid-cols-2")}>
              <TabsTrigger value="active" className="rounded-lg text-[9px] font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">
                {isRtl ? 'النشاط' : 'Active'}
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg text-[9px] font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">
                {isRtl ? 'الزمني' : 'Timeline'}
              </TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="chat_archive" className="rounded-lg text-[9px] font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white gap-1.5">
                    <Archive className="h-2.5 w-2.5" /> {isRtl ? 'الدردشة' : 'Chat Arc'}
                  </TabsTrigger>
                  <TabsTrigger value="time_archive" className="rounded-lg text-[9px] font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white gap-1.5">
                    <Clock className="h-2.5 w-2.5" /> {isRtl ? 'الوقت' : 'Time Arc'}
                  </TabsTrigger>
                </>
              )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 px-1 scrollbar-hide">
          <TabsContent value="active" className="m-0 space-y-6 pb-20">
            {commentsLoading ? (
              <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div>
            ) : (
              activeStream.map((item: any) => (
                  <StreamItem key={item.id || item.sortTime} item={item} isRtl={isRtl} user={user} boqItems={boqItems} onDelete={handleDelete} />
              ))
            )}
            {!activeStream.length && !commentsLoading && (
              <div className="py-20 text-center flex flex-col items-center gap-3 opacity-20">
                  <MessageSquare className="h-10 w-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{isRtl ? 'لا يوجد نشاط مسجل' : 'No Activity'}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat_archive" className="m-0 space-y-6 text-start">
            <div className="space-y-6 pb-20">
                {archivedChat.map((item) => (
                  <StreamItem key={item.id} item={{...item, streamType: 'comment'}} isRtl={isRtl} user={user} boqItems={boqItems} />
                ))}
                {!archivedChat.length && <p className="text-[10px] text-slate-300 font-bold italic py-20 text-center">لا توجد نقاشات مؤرشفة.</p>}
            </div>
          </TabsContent>

          <TabsContent value="time_archive" className="m-0 space-y-4 text-start">
            <div className="space-y-4 pb-20">
              {archivedTime.map((event, idx) => (
                  <div key={idx} className="p-5 rounded-[1.5rem] bg-rose-50/20 border-2 border-dashed border-rose-100 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-start mb-3">
                        <div className="h-8 w-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm"><RotateCcw className="h-4 w-4" /></div>
                        <Badge className="bg-rose-600 text-white border-0 text-[8px] font-black uppercase">{event.durationText || 'Canceled'}</Badge>
                    </div>
                    <p className="text-xs font-black text-slate-800 leading-tight">{event.content}</p>
                    <div className="grid grid-cols-1 gap-2 mt-4 text-[7px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="bg-white/50 p-2 rounded-lg border border-rose-50 flex justify-between items-center">
                           <span>START:</span>
                           <span>{event.previousStart?.toDate().toLocaleString()}</span>
                        </div>
                        <div className="bg-white/50 p-2 rounded-lg border border-rose-50 flex justify-between items-center">
                           <span>END:</span>
                           <span>{event.previousEnd?.toDate().toLocaleString()}</span>
                        </div>
                    </div>
                  </div>
              ))}
              {!archivedTime.length && <p className="text-[10px] text-slate-300 font-bold italic py-20 text-center">لا توجد سجلات زمنية مؤرشفة.</p>}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="m-0 space-y-6 text-start">
            <div className="space-y-4 pb-20 print:space-y-8">
                {stages.sort((a,b)=> (a.order||0) - (b.order||0)).map((stage, idx) => {
                  const start = stage.startedAt?.toDate();
                  const end = stage.completedAt?.toDate();
                  let durationValue = "";
                  if (start && end) {
                      const days = differenceInDays(end, start);
                      const hours = differenceInHours(end, start) % 24;
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
                            <h4 className="font-black text-[11px] text-slate-900">{stage.name}</h4>
                            <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                              <div className="space-y-0.5"><p className="text-[7px] font-black text-slate-400 uppercase">Start</p><p className="text-[8px] font-bold text-slate-600 truncate">{start ? start.toLocaleDateString() : '---'}</p></div>
                              <div className="space-y-0.5"><p className="text-[7px] font-black text-slate-400 uppercase">End</p><p className="text-[8px] font-bold text-slate-600 truncate">{end ? end.toLocaleDateString() : '---'}</p></div>
                            </div>
                            {durationValue && <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0 text-[8px] font-black">Time: {durationValue}</Badge>}
                        </div>
                      </div>
                  );
                })}
            </div>
          </TabsContent>
        </div>

        {activeTab === 'active' && (
          <div className="mt-auto pt-4 bg-white border-t border-slate-50 print:hidden shrink-0">
            <Card className="border-2 border-slate-100 shadow-2xl rounded-[1.5rem] overflow-hidden bg-white ring-4 ring-black/[0.02]">
              <CardContent className="p-2 flex items-end gap-2">
                <Textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={isRtl ? (filterStageId ? `اكتب ملاحظة في مرحلة ${selectedStageName}...` : "اكتب تعليقاً عاماً...") : "Write a comment..."}
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

function StreamItem({ item, isRtl, user, boqItems, onDelete }: any) {
   const isLog = item.streamType === 'log';
   const displayName = item.createdByName || item.recordedByName || (isRtl ? 'مستخدم' : 'User');

   if (isLog) {
      const boqItem = boqItems?.find((i: any) => i.id === item.boqItemId);
      const isComplementary = item.quantity === 0;
      return (
         <div className="flex justify-center animate-in fade-in duration-500">
            <div className={cn(
              "border-2 shadow-md rounded-[1.25rem] p-4 w-full md:w-[95%] relative transition-all",
              isComplementary ? "bg-blue-50/50 border-blue-100" : "bg-emerald-50/30 border-emerald-100"
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
                       <Badge variant="outline" className="text-[8px] font-black border-slate-200 bg-white text-slate-600 px-2 truncate">
                          {boqItem?.referenceTitle || (isRtl ? 'بند مجهول' : 'Unknown Item')}
                       </Badge>
                       {!isComplementary && <Badge className="bg-emerald-600 text-white border-0 text-[8px] h-4 px-2">{item.quantity} QTY</Badge>}
                    </div>
                    {item.notes && <p className="text-[10px] font-bold text-slate-600 italic">"{item.notes}"</p>}
                    <div className="flex items-center gap-3 mt-2 text-[7px] font-black text-slate-400 uppercase">
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
           <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">{displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex flex-col space-y-1 max-w-[85%]", isMine ? "items-end" : "items-start")}>
           <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] font-black text-slate-700">{displayName}</span>
              <span className="text-[7px] font-bold text-slate-300">
                 {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}
              </span>
           </div>
           <div className={cn(
             "p-3 rounded-[1.25rem] shadow-sm text-xs font-bold leading-relaxed relative group transition-all",
             isMine ? "bg-[#e87c24] text-white rounded-te-none" : "bg-white border-2 border-slate-50 text-slate-700 rounded-ts-none",
             item.isArchived && "opacity-60 grayscale border-dashed border-slate-300"
           )}>
              {item.stageName && (
                 <div className="mb-1.5">
                    <Badge variant="secondary" className="bg-white/10 text-[7px] font-black uppercase text-inherit border-white/10">
                       {item.stageName}
                    </Badge>
                 </div>
              )}
              <p className="whitespace-pre-wrap">{item.content}</p>
              
              {!item.isArchived && onDelete && (
                 <div className={cn("absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1", isMine ? "right-full mr-1.5" : "left-full ml-1.5")}>
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-slate-300 hover:text-slate-600 bg-white shadow-sm border"><MoreVertical className="h-3 w-3" /></Button>
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
