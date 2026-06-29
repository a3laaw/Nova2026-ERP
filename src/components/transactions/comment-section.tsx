'use client';

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Send, MessageSquare, MoreVertical, 
  Trash2, Loader2, Hammer, User,
  History, Clock, Zap, Archive, FilterX
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentService } from '@/services/comment-service';
import { TransactionComment, CommentType } from '@/types/transaction';
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

interface Props {
  transactionId: string;
  path: string; 
  title?: string;
  compact?: boolean;
  externalLogs?: any[]; 
  boqItems?: any[];     
  filterStageId?: string | null; // This is the StageInstance.id
  onClearFilter?: () => void;
  selectedStageName?: string;
  technicalStageId?: string | null; // Needed to filter execution logs accurately
}

export function CommentSection({ 
  transactionId, 
  path, 
  title, 
  compact = false, 
  externalLogs = [], 
  boqItems = [],
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
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const commentsQuery = useMemo(() => 
    db ? query(collection(db, path), orderBy('createdAt', 'asc')) : null, 
  [db, path]);

  const { data: comments, loading: commentsLoading } = useCollection<TransactionComment>(commentsQuery);

  const commentService = useMemo(() => 
    db && globalUser?.companyId ? new CommentService(db, globalUser.companyId, permissions) : null, 
  [db, globalUser, permissions]);

  const unifiedStream = useMemo(() => {
    // 1. معالجة التعليقات حسب التبويب المختار وفلتر المرحلة
    const filteredComments = (comments || []).filter(c => {
      const matchArchive = activeTab === 'archived' ? c.isArchived === true : !c.isArchived;
      const matchStage = !filterStageId || c.stageInstanceId === filterStageId;
      return matchArchive && matchStage;
    }).map(c => ({ 
      ...c, 
      streamType: 'comment' as const,
      sortTime: c.createdAt?.toMillis?.() || (c.createdAt?.seconds ? c.createdAt.seconds * 1000 : Date.now())
    }));
    
    // 2. معالجة سجلات التنفيذ
    const filteredLogs = (externalLogs || []).filter(l => {
      if (activeTab === 'archived') return false; 
      // الفلترة تتم بمقارنة المعرف المرجعي للمرحلة (technicalStageId)
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
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
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

        {isAdmin && (
           <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100/50 rounded-xl p-1">
                 <TabsTrigger value="active" className="rounded-lg text-[10px] font-black data-[state=active]:bg-white">
                    {isRtl ? 'النشاط الحالي' : 'Active Activity'}
                 </TabsTrigger>
                 <TabsTrigger value="archived" className="rounded-lg text-[10px] font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white gap-2">
                    <Archive className="h-3 w-3" /> {isRtl ? 'الأرشيف' : 'Archive'}
                 </TabsTrigger>
              </TabsList>
           </Tabs>
        )}
      </div>

      {filterStageId && (
        <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-center gap-2 animate-in zoom-in-95">
           <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
           <span className="text-[10px] font-black text-primary uppercase">
              {isRtl ? 'تركيز على:' : 'Filtered to:'} {selectedStageName}
           </span>
        </div>
      )}

      {/* Unified Stream */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-hide max-h-[600px]">
        {commentsLoading ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div>
        ) : unifiedStream.length === 0 ? (
          <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center"><History className="h-8 w-8" /></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">{isRtl ? 'لا توجد حركات مسجلة' : 'No Activity Yet'}</p>
          </div>
        ) : (
          unifiedStream.map((item: any) => {
            const isLog = item.streamType === 'log';
            
            if (isLog) {
              const boqItem = boqItems?.find(i => i.id === item.boqItemId);
              const isComplementary = item.quantity === 0;

              return (
                <div key={`log-${item.id}`} className="flex justify-center animate-in fade-in duration-500">
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
              <div key={`comm-${item.id}`} className={cn("flex gap-3 text-start animate-in fade-in slide-in-from-bottom-2 duration-300", isMine ? "flex-row-reverse" : "flex-row")}>
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
                       
                       {!item.isArchived && (
                          <div className={cn("absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1", isMine ? "right-full mr-2" : "left-full ml-2")}>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-300 hover:text-slate-600 bg-white shadow-sm border"><MoreVertical className="h-3.5 w-3.5" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isMine ? "end" : "start"} className="rounded-xl border-2">
                                   <DropdownMenuItem onClick={() => handleDelete(item.id!)} className="text-rose-600 font-bold gap-2 focus:bg-rose-50 cursor-pointer text-xs">
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
          })
        )}
      </div>

      {/* Input Area */}
      <Card className="border-2 border-slate-100 shadow-2xl rounded-[2rem] overflow-hidden bg-white mt-auto ring-4 ring-black/[0.02]">
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
    </div>
  );
}
