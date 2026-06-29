'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Send, MessageSquare, MoreVertical, 
  Trash2, Loader2, Hammer, User,
  History, Clock, CheckCircle2, Zap
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

  // --- محرك الدمج والفرز الزمني السيادي ---
  const unifiedStream = useMemo(() => {
    const stream = [...(comments || [])].map(c => ({ ...c, streamType: 'comment' as const }));
    
    // إضافة السجلات الميدانية للتدفق
    if (externalLogs && externalLogs.length > 0) {
      stream.push(...externalLogs.map(l => ({ ...l, streamType: 'log' as const })));
    }

    return stream.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return timeA - timeB;
    });
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

      <div className={cn("flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide", compact ? "max-h-[500px]" : "max-h-[600px]")}>
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
                <div key={`log-${idx}`} className="flex justify-center my-6 animate-in fade-in zoom-in-95 duration-500">
                   <div className="bg-white border-2 border-slate-50 shadow-md rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 max-w-[90%] relative">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        isComplementary ? "bg-blue-50 text-blue-500" : "bg-primary/5 text-primary"
                      )}>
                        {isComplementary ? <Zap className="h-5 w-5" /> : <Hammer className="h-5 w-5" />}
                      </div>
                      <div className="text-start">
                         <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-slate-800 uppercase">{isRtl ? 'إنجاز ميداني:' : 'Progress Log:'}</span>
                            <Badge variant="outline" className="text-[8px] font-black border-slate-100 px-2 h-4 bg-slate-50">{boqItem?.referenceTitle || 'B.O.Q Item'}</Badge>
                            {!isComplementary && <Badge className="bg-emerald-500 text-white border-0 text-[8px] font-black h-4 px-2">{item.quantity} QTY</Badge>}
                            {isComplementary && <Badge className="bg-blue-600 text-white border-0 text-[8px] font-black h-4 px-2">COMPLEMENTARY</Badge>}
                         </div>
                         <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed italic">
                            "{item.notes || (isRtl ? 'تأكيد فني بدون ملاحظات' : 'Technical validation')}"
                         </p>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] font-black text-primary uppercase">Eng: {item.recordedBy?.slice(-4)}</span>
                            <span className="text-[8px] text-slate-300 font-bold">• {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: isRtl ? ar : enUS }) : '...'}</span>
                         </div>
                      </div>
                   </div>
                </div>
              );
            }

            const isMine = item.createdBy === user?.uid;
            return (
              <div key={`comm-${item.id}`} className={cn("flex gap-3 text-start animate-in fade-in slide-in-from-bottom-2 duration-300", isMine ? "flex-row-reverse" : "flex-row")}>
                 <Avatar className="h-8 w-8 rounded-xl shrink-0 border shadow-sm">
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
                      "p-3 rounded-2xl shadow-sm text-xs font-bold leading-relaxed relative group",
                      isMine ? "bg-[#e87c24] text-white rounded-te-none" : "bg-white border text-slate-700 rounded-ts-none"
                    )}>
                       <p className="whitespace-pre-wrap">{item.content}</p>
                       
                       <div className={cn(
                         "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
                         isMine ? "right-full mr-1" : "left-full ml-1"
                       )}>
                          <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-slate-300 hover:text-slate-600"><MoreVertical className="h-3 w-3" /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align={isMine ? "end" : "start"} className="rounded-xl border-2">
                                <DropdownMenuItem onClick={() => handleDelete(item.id!)} className="text-rose-600 font-bold gap-2 focus:bg-rose-50 cursor-pointer">
                                   <Trash2 className="h-3.5 w-3.5" /> {isRtl ? 'حذف' : 'Delete'}
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

      <Card className="border-2 border-slate-100 shadow-xl rounded-2xl overflow-hidden bg-white mt-auto">
        <CardContent className="p-3 flex items-end gap-2">
           <Textarea 
             value={content}
             onChange={e => setContent(e.target.value)}
             placeholder={isRtl ? "اكتب تعليقاً أو استفساراً فنياً..." : "Write a comment or query..."}
             className="min-h-[44px] max-h-[120px] rounded-xl border-0 focus-visible:ring-0 text-xs font-bold bg-slate-50/50 resize-none p-3"
           />
           <Button 
             onClick={handleSubmit} 
             disabled={loading || !content.trim()}
             size="icon" 
             className="h-11 w-11 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 shrink-0"
           >
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className={cn("h-5 w-5", isRtl && "rotate-180")} />}
           </Button>
        </CardContent>
      </Card>
    </div>
  );
}
