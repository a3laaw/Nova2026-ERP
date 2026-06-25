'use client';

import { useState, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Loader2, 
  LayoutGrid, 
  Boxes, 
  Hammer, 
  ListChecks,
  ChevronRight,
  Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceNode } from '@/types/reference';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (node: BOQReferenceNode) => void;
  className?: string;
}

/**
 * مكون منتقي بنود BOQ الموحد (Unified Reference Picker).
 * يعتمد حصراً على المرجع الشجري boqReferenceNodes.
 */
export function BOQMasterSelector({ onSelect, className }: Props) {
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // مستويات الاختيار (تصفية ديناميكية)
  const [selectedParentId, setSelectedParentId] = useState<string>("");

  // 1. جلب الجذور (Level 0)
  const rootsQuery = useMemo(() => 
    companyId && db ? query(
      collection(db, paths.boqReferenceNodes(companyId)),
      where('parentId', '==', null),
      orderBy('order')
    ) : null, [db, companyId]);

  // 2. جلب الأبناء للعقدة المختارة
  const childrenQuery = useMemo(() => 
    companyId && db && selectedParentId ? query(
      collection(db, paths.boqReferenceNodes(companyId)),
      where('parentId', '==', selectedParentId),
      orderBy('order')
    ) : null, [db, companyId, selectedParentId]);

  const { data: roots, loading: rootsLoading } = useCollection<BOQReferenceNode>(rootsQuery);
  const { data: children, loading: childrenLoading } = useCollection<BOQReferenceNode>(childrenQuery);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 items-end", className)}>
      
      {/* اختيار القسم (الجذور) */}
      <div className="space-y-2 text-start">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> {isRtl ? 'القسم الرئيسي' : 'Root Section'}
        </Label>
        <Select 
          value={selectedParentId} 
          onValueChange={setSelectedParentId}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50">
            <SelectValue placeholder={rootsLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {roots?.map(s => (
              <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3">
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* اختيار البند النهائي أو المجموعة الفرعية */}
      <div className="space-y-2 text-start">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <ListChecks className="h-3 w-3 text-primary" /> {isRtl ? 'البنود المتاحة' : 'Available Items'}
        </Label>
        <Select 
          disabled={!selectedParentId}
          onValueChange={(id) => {
            const node = children?.find(i => i.id === id);
            if (node) {
               if (node.isExecutable) {
                  onSelect(node);
               } else {
                  // إذا كانت مجموعة، ننتقل للتعمق فيها
                  setSelectedParentId(node.id!);
               }
            }
          }}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-black bg-primary/5 text-primary border-primary/20">
            <SelectValue placeholder={childrenLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {children?.map(node => (
              <SelectItem key={node.id} value={node.id!} className="font-black text-xs py-4 border-b last:border-0 border-slate-50">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center justify-between gap-4">
                      <span>{node.title}</span>
                      <Badge className={cn("text-[8px] border-0 px-1.5 h-4", node.isExecutable ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                         {node.isExecutable ? 'ITEM' : 'GROUP'}
                      </Badge>
                   </div>
                   {node.isExecutable && (
                     <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{node.unitName} ({node.unitSymbol})</span>
                        <span className="text-[8px] text-primary/60 font-black">Ref: {node.code}</span>
                     </div>
                   )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(rootsLoading || childrenLoading) && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl pointer-events-none">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
