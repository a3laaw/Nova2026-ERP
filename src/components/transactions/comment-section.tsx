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
  const { lang, dir, t, tSafe } = useLanguage();
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

  const allActiveItems = useMemo(() => {
    const filteredComments = (comments || [])
      .filter(c => !c.isArchived && (!filterStageId || c.stageInstanceId === filterStageId))
      .map(c => ({ 
        ...c, 
        streamType: 'comment' as const,
        sortTime: c.createdAt?.toMillis?.() || Date.now()
      }));
    
    if (onlyComments) {
      return filteredComments.sort((a, b) => b.sortTime - a.sortTime);
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

  const currentStream = activeTab === 'chat_archive' ? (comments || []).filter(c => c.isArchived) : allActiveItems;
  const totalPages = Math.ceil(currentStream.length / PAGE_SIZE) || 1;
  const paginatedStream = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return currentStream.slice(start, start + PAGE_SIZE);
  }, [currentStream, currentPage]);

  const handleSubmit = async () => {
    if (!commentService || !user || !content.trim()) return;
    setLoading(true);
    try {
      const officialName = globalUser?.fullName || user.displayName || tSafe('inline.unknown.engineer', 'مهندس غير معرف', 'Unknown Engineer');
      await commentService.addTransactionComment(transactionId, content, user.uid, officialName, filterStageId, selectedStageName, 'general', appointmentId);
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-start">
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col h-full">
        <div className="flex flex-col gap-4 print:hidden shrink-0">
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><MessageSquare className="h-5 w-5" /></div>
                <div>
                   <h3 className="text-sm font-black text-slate-800 leading-none">{title || t('inline.war.room')}</h3>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('common.status')}</p>
                </div>
             </div>
             {onClearFilter && filterStageId && (
                <Button onClick={onClearFilter} variant="ghost" size="sm" className="h-8 rounded-lg text-[9px] font-black gap-2 bg-slate-900 text-white hover:bg-slate-800 px-3 shadow-lg">
                  <X className="h-3 w-3" /> {t('inline.view.all')}
                </Button>
             )}
          </div>

          {!onlyComments && (
            <TabsList className={cn("grid w-full h-11 bg-slate-100/50 rounded-xl p-1 gap-1 mx-1", isAdmin ? "grid-cols-4" : "grid-cols-2")}>
                <TabsTrigger value="active" className="rounded-lg text-[10px] font-black transition-all">{t('inline.active')}</TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-lg text-[10px] font-black transition-all">{t('inline.timeline')}</TabsTrigger>
                {isAdmin && (
                  <>
                    <TabsTrigger value="chat_archive" className="rounded-lg text-[10px] font-black gap-1.5 transition-all"><Archive className="h-3 w-3" /> {t('inline.archive')}</TabsTrigger>
                    <TabsTrigger value="time_archive" className="rounded-lg text-[10px] font-black gap-1.5 transition-all"><Clock className="h-3 w-3" /> {t('inline.time')}</TabsTrigger>
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
                  <p className="text-xs font-black text-slate-400">{t('inline.awaiting.notes')}</p>
               </div>
            ) : (
              paginatedStream.map((item: any) => (
                  <StreamItem key={item.id || item.sortTime} item={item} isRtl={isRtl} user={user} boqItems={boqItems} />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="timeline" className="m-0 space-y-6 pb-24">
              {stages?.sort((a,b)=> (a.order||0) - (b.order||0)).map((stage, idx) => {
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
                            <div className="space-y-0.5"><p className="text-[7px] font-black text-slate-400 uppercase">{t('inline.start')}</p><p className="text-[8px] font-bold text-slate-600 truncate">{start ? start.toLocaleDateString(isRtl ? 'ar-KW' : 'en-US') : '---'}</p></div>
                            <div className="space-y-0.5"><p className="text-[7px] font-black text-slate-400 uppercase">{t('inline.end')}</p><p className="text-[8px] font-bold text-slate-600 truncate">{end ? end.toLocaleDateString(isRtl ? 'ar-KW' : 'en-US') : '---'}</p></div>
                          </div>
                      </div>
                    </div>
                );
              })}
          </TabsContent>
        </div>

        {activeTab === 'active' && (
          <div className="mt-auto pt-4 bg-white border-t border-slate-50 print:hidden shrink-0">
            <Card className="border-2 border-slate-100 shadow-2xl rounded-xl overflow-hidden bg-white ring-4 ring-black/[0.02]">
              <CardContent className="p-2 flex items-end gap-2">
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('inline.write.a.technical.note')} className="min-h-[44px] max-h-[150px] rounded-xl border-0 focus-visible:ring-0 text-xs font-bold bg-slate-50/50 resize-none p-4" />
                <Button onClick={handleSubmit} disabled={loading || !content.trim()} size="icon" className="h-11 w-11 rounded-xl bg-primary text-white shadow-xl shadow-primary/20 shrink-0 hover:scale-110 transition-transform">
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

function StreamItem({ item, isRtl, user, boqItems }: any) {
   const { t } = useLanguage();
   const isLog = item.streamType === 'log' || item.streamType === 'timeline_log';
   const displayName = item.userName || item.createdByName || t('inline.engineer');

   if (isLog) {
      const boqItem = boqItems?.find((i: any) => i.id === item.boqItemId);
      const isRevision = item.type === 'revision_logged';
      return (
         <div className="flex justify-center animate-in fade-in duration-500 px-1 text-start">
            <div className={cn(
              "border-2 shadow-md rounded-xl p-4 w-full relative transition-all",
              isRevision ? "bg-amber-50 border-amber-200" : "bg-emerald-50/30 border-emerald-100"
            )}>
               <div className="flex items-start gap-4">
                 <div className={cn(
                   "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                   isRevision ? "bg-white text-amber-600" : "bg-white text-emerald-600"
                 )}>
                   {isRevision ? <RotateCcw className="h-4 w-4" /> : <Hammer className="h-4 w-4" />}
                 </div>
                 <div className="text-start flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                       <Badge variant="outline" className="text-[8px] font-black border-slate-200 bg-white text-slate-600 px-2">
                          {isRevision ? t('inline.revision') : (boqItem?.referenceTitle || t('inline.progress'))}
                       </Badge>
                       {item.quantity > 0 && <Badge className="bg-emerald-600 text-white border-0 text-[8px] h-4 px-2">{item.quantity} QTY</Badge>}
                    </div>
                    <p className="text-[10px] font-black text-slate-800 leading-relaxed">{item.content}</p>
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
              <span className="text-[7px] font-bold text-slate-300">{item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}</span>
           </div>
           <div className={cn(
             "p-3 rounded-xl shadow-sm text-xs font-bold leading-relaxed",
             isMine ? "bg-[#e87c24] text-white rounded-te-none" : "bg-white border-2 border-slate-50 text-slate-700 rounded-ts-none"
           )}>
              <p className="whitespace-pre-wrap">{item.content}</p>
           </div>
        </div>
     </div>
   );
}