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
import { Badge } from '@/components/ui/badge';

interface Props {
  onSelect: (node: BOQReferenceNode) => void;
  className?: string;
  activityTypeId?: string; 
  serviceId?: string;
}

/**
 * مكون منتقي بنود BOQ الشجري السيادي (Hierarchical Reference Selector).
 * يعتمد حصرياً على boqReferenceNodes.
 */
export function BOQReferenceSelector({ onSelect, className, activityTypeId, serviceId }: Props) {
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [selectedParentId, setSelectedParentId] = useState<string>("");

  // 1. جلب الجذور (Level 0)
  const rootsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(
      collection(db, paths.boqReferenceNodes(companyId)),
      where('parentId', '==', null),
      orderBy('order')
    );
  }, [db, companyId]);

  // 2. جلب الأبناء للعقدة المختارة
  const childrenQuery = useMemo(() => 
    companyId && db && selectedParentId ? query(
      collection(db, paths.boqReferenceNodes(companyId)),
      where('parentId', '==', selectedParentId),
      orderBy('order')
    ) : null, [db, companyId, selectedParentId]);

  const { data: roots, loading: rootsLoading } = useCollection<BOQReferenceNode>(rootsQuery);
  const { data: rawChildren, loading: childrenLoading } = useCollection<BOQReferenceNode>(childrenQuery);

  // فلترة الجذور حسب النشاط أو الخدمة المحددة (سياق القالب)
  const filteredRoots = useMemo(() => {
    if (!roots) return [];
    return roots.filter(r => {
      const matchAct = !activityTypeId || (r.allowedActivityTypeIds && r.allowedActivityTypeIds.includes(activityTypeId));
      const matchSrv = !serviceId || (r.allowedServiceIds && r.allowedServiceIds.includes(serviceId));
      return matchAct || matchSrv;
    });
  }, [roots, activityTypeId, serviceId]);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 items-end", className)}>
      
      <div className="space-y-2 text-start relative">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> {isRtl ? 'القسم المرجعي الرئيسي' : 'Root Reference Section'}
        </Label>
        <Select value={selectedParentId} onValueChange={setSelectedParentId}>
          <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50">
            <SelectValue placeholder={rootsLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {filteredRoots.map(s => (
              <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3">
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 text-start relative">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <ListChecks className="h-3 w-3 text-primary" /> {isRtl ? 'البنود والتعريفات المتاحة' : 'Available Work Items'}
        </Label>
        <Select 
          disabled={!selectedParentId}
          onValueChange={(id) => {
            const node = rawChildren?.find(i => i.id === id);
            if (node) {
               if (node.isExecutable) onSelect(node);
               else setSelectedParentId(node.id!);
            }
          }}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-black bg-primary/5 text-primary border-primary/20">
            <SelectValue placeholder={childrenLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {rawChildren?.map(node => (
              <SelectItem key={node.id} value={node.id!} className="font-black text-xs py-4 border-b last:border-0 border-slate-50">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center justify-between gap-4">
                      <span>{node.title}</span>
                      <Badge className={cn("text-[8px] border-0 px-1.5 h-4", node.isExecutable ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                         {node.isExecutable ? 'ITEM' : 'GROUP'}
                      </Badge>
                   </div>
                   {node.isExecutable && node.unitSymbol && (
                     <span className="text-[9px] text-slate-400 font-bold uppercase">{node.unitName} ({node.unitSymbol})</span>
                   )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(rootsLoading || childrenLoading) && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl pointer-events-none z-50">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
