'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Send, MessageSquare, MoreVertical, 
  Trash2, Loader2, Hammer, User,
  History, Clock, CheckCircle2, Zap,
  Info
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

interface Props {
  transactionId: string;
  stageInstanceId?: string | null;
  path: string; 
  title?: string;
  compact?: boolean;
  externalLogs?: any[]; // سجلات الإنجاز الميداني المراد دمجها
  boqItems?: any[];     // لترجمة مسميات البنود في السجلات
}

export function CommentSection({ transactionId, stageInstanceId, path, title, compact = false, externalLogs = [], boqItems = [] }: Props) {
  const { user, globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const commentsQuery = useMemo(() => 
    db ? query(collection(db, path), orderBy('createdAt', 'asc')) : null, 
  [db, path]);

  const { data: comments, loading: commentsLoading } = useCollection<TransactionComment>(commentsQuery);

  const commentService = useMemo(() => 
    db && globalUser?.companyId ? new CommentService(db, globalUser.companyId, permissions) : null, 
  [db, globalUser, permissions]);

  /**
   * محرك الدمج والفرز الزمني السيادي (Sovereign Unified Stream Engine)
   */
  const unifiedStream = useMemo(() => {
    // 1. تحضير التعليقات
    const commentItems = (comments || []).map(c => ({ 
      ...c, 
      streamType: 'comment' as const,
      sortTime: c.createdAt?.toMillis?.() || c.createdAt?.seconds * 1000 || Date.now()
    }));
    
    // 2. تحضير السجلات الميدانية
    const logItems = (externalLogs || []).map(l => ({ 
      ...l, 
      streamType: 'log' as const,
      sortTime: l.createdAt?.toMillis?.() || l.createdAt?.seconds * 1000 || Date.now()
    }));

    // 3. الدمج والفرز النهائي
    return [...commentItems, ...logItems].sort((a, b) => a.sortTime - b.sortTime);
  }, [comments, externalLogs]);

  const handleSubmit = async () => {
    if (!commentService || !user || !content.trim()) return;
    setLoading(true);
    try {
      if (stageInstanceId) {
        await commentService.addStageComment(transactionId, stageInstanceId, content, user.uid, user.displayName || 'User');
      } else {
        await commentService.addTransactionComment(transactionId, content, user.uid, user.displayName || 'User');
      }
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!commentService) return;
    await commentService.deleteComment(path, commentId);
  };

  return (
    <div className={cn("flex flex-col h-full", compact ? "gap-4" : "gap-6")}>
      {!compact && title && (
        <h3 className="text-sm font-black flex items-center gap-2 text-slate-500 uppercase tracking-widest px-1">
          <MessageSquare className="h-4 w-4 text-primary" /> {title}
        </h3>
      )}

      <div className={cn("flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-hide", compact ? "max-h-[500px]" : "max-h-[600px]")}>
        {commentsLoading ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div>
        ) : unifiedStream.length === 0 ? (
          <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center"><History className="h-8 w-8" /></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">{isRtl ? 'لا توجد حركات مسجلة' : 'No Activity Yet'}</p>
          </div>
        ) : (
          unifiedStream.map((item: any, idx: number) => {
            const isLog = item.streamType === 'log';
            
            if (isLog) {
              const boqItem = boqItems?.find(i => i.id === item.boqItemId);
              const isComplementary = item.quantity === 0;

              return (
                <div key={`log-${idx}`} className="flex justify-center animate-in fade-in zoom-in-95 duration-500">
                   <div className={cn(
                     "border-2 shadow-md rounded-[1.5rem] p-5 flex flex-col md:flex-row items-center gap-4 w-full md:w-[95%] relative transition-all hover:shadow-lg",
                     isComplementary ? "bg-blue-50/50 border-blue-100" : "bg-emerald-50/30 border-emerald-100"
                   )}>
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border",
                        isComplementary ? "bg-white text-blue-500 border-blue-100" : "bg-white text-emerald-600 border-emerald-100"
                      )}>
                        {isComplementary ? <Zap className="h-6 w-6" /> : <Hammer className="h-6 w-6" />}
                      </div>
                      <div className="text-start flex-1">
                         <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">
                               {isRtl ? 'إجراء ميداني:' : 'Progress Update:'}
                            </span>
                            <Badge variant="outline" className="text-[9px] font-black border-slate-200 px-3 h-5 bg-white text-slate-600">
                               {boqItem?.referenceTitle || (isRtl ? 'بند غير محدد' : 'Unknown Item')}
                            </Badge>
                            {!isComplementary && (
                               <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-black h-5 px-3">
                                  {item.quantity} QTY
                               </Badge>
                            )}
                            {isComplementary && (
                               <Badge className="bg-blue-600 text-white border-0 text-[10px] font-black h-5 px-3">
                                  COMPLEMENTARY
                               </Badge>
                            )}
                         </div>
                         
                         {item.notes && (
                            <p className="text-xs font-bold text-slate-600 bg-white/50 p-2 rounded-lg border border-dashed border-slate-200 mt-2 leading-relaxed">
                               "{item.notes}"
                            </p>
                         )}
                         
                         <div className="flex items-center gap-3 mt-2 border-t border-slate-100 pt-2">
                            <div className="flex items-center gap-1.5">
                               <User className="h-3 w-3 text-slate-300" />
                               <span className="text-[9px] font-black text-slate-400 uppercase">
                                  {item.recordedBy === user?.uid ? (isRtl ? 'بواسطتك' : 'By You') : (isRtl ? 'بواسطة المهندس' : `By ${item.recordedBy?.slice(-4)}`)}
                               </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                               <Clock className="h-3 w-3 text-slate-300" />
                               <span className="text-[9px] text-slate-400 font-bold">
                                  {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : (isRtl ? 'الآن' : 'just now')}
                               </span>
                            </div>
                         </div>
                      </div>
                      <div className="absolute -top-2 -right-2">
                         <Badge className="bg-white border-2 border-slate-100 text-slate-300 h-6 w-6 p-0 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm">
                            LOG
                         </Badge>
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
                          {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : (isRtl ? 'الآن' : 'just now')}
                       </span>
                    </div>
                    <div className={cn(
                      "p-4 rounded-[1.5rem] shadow-sm text-sm font-bold leading-relaxed relative group transition-all",
                      isMine ? "bg-[#e87c24] text-white rounded-te-none" : "bg-white border-2 border-slate-50 text-slate-700 rounded-ts-none"
                    )}>
                       <p className="whitespace-pre-wrap">{item.content}</p>
                       
                       <div className={cn(
                         "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                         isMine ? "right-full mr-2" : "left-full ml-2"
                       )}>
                          <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-300 hover:text-slate-600 bg-white shadow-sm border"><MoreVertical className="h-3.5 w-3.5" /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align={isMine ? "end" : "start"} className="rounded-xl border-2">
                                <DropdownMenuItem onClick={() => handleDelete(item.id!)} className="text-rose-600 font-bold gap-2 focus:bg-rose-50 cursor-pointer">
                                   <Trash2 className="h-4 w-4" /> {isRtl ? 'حذف التعليق' : 'Delete Comment'}
                                </DropdownMenuItem>
                             </DropdownMenuContent>
                          </DropdownMenu>
                       </div>
                    </div>
                 </div>
              </div>
            );
          })
        )}
      </div>

      <Card className="border-2 border-slate-100 shadow-2xl rounded-[2rem] overflow-hidden bg-white mt-auto ring-4 ring-black/[0.02]">
        <CardContent className="p-3 flex items-end gap-2">
           <Textarea 
             value={content}
             onChange={e => setContent(e.target.value)}
             placeholder={isRtl ? "اكتب تعليقاً أو استفساراً فنياً..." : "Write a comment or query..."}
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
