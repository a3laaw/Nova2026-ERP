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
  ChevronLeft,
  Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { BOQWorkItemMasterNode } from '@/types/reference';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (node: BOQWorkItemMasterNode) => void;
  className?: string;
}

/**
 * مكون منتقي بنود BOQ المتدرج (Sovereign Cascading Selector)
 * يقوم بالتصفية الرأسية: القسم -> الفئة -> العنصر -> البند
 */
export function BOQMasterSelector({ onSelect, className }: Props) {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // حالات الاختيار لكل مستوى
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");

  // 1. جلب الأقسام (Level 0)
  const sectionsQuery = useMemo(() => 
    companyId && db ? query(
      collection(db, paths.boqWorkItemsMaster(companyId)),
      where('nodeType', '==', 'section'),
      orderBy('order')
    ) : null, [db, companyId]);

  // 2. جلب الفئات (Level 1) بناءً على القسم المختار
  const categoriesQuery = useMemo(() => 
    companyId && db && selectedSectionId ? query(
      collection(db, paths.boqWorkItemsMaster(companyId)),
      where('parentId', '==', selectedSectionId),
      orderBy('order')
    ) : null, [db, companyId, selectedSectionId]);

  // 3. جلب العناصر (Level 2) بناءً على الفئة المختارة
  const componentsQuery = useMemo(() => 
    companyId && db && selectedCategoryId ? query(
      collection(db, paths.boqWorkItemsMaster(companyId)),
      where('parentId', '==', selectedCategoryId),
      orderBy('order')
    ) : null, [db, companyId, selectedCategoryId]);

  // 4. جلب البنود النهائية (Level 3) بناءً على العنصر المختار
  const itemsQuery = useMemo(() => 
    companyId && db && selectedComponentId ? query(
      collection(db, paths.boqWorkItemsMaster(companyId)),
      where('parentId', '==', selectedComponentId),
      orderBy('order')
    ) : null, [db, companyId, selectedComponentId]);

  const { data: sections, loading: sectionsLoading } = useCollection<BOQWorkItemMasterNode>(sectionsQuery);
  const { data: categories, loading: categoriesLoading } = useCollection<BOQWorkItemMasterNode>(categoriesQuery);
  const { data: components, loading: componentsLoading } = useCollection<BOQWorkItemMasterNode>(componentsQuery);
  const { data: items, loading: itemsLoading } = useCollection<BOQWorkItemMasterNode>(itemsQuery);

  const resetFromCategory = () => {
    setSelectedCategoryId("");
    setSelectedComponentId("");
  };

  const resetFromComponent = () => {
    setSelectedComponentId("");
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 items-end", className)}>
      
      {/* المستوى 1: القسم */}
      <div className="space-y-2 text-start">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> {isRtl ? 'القسم الرئيسي' : 'Section'}
        </Label>
        <Select 
          value={selectedSectionId} 
          onValueChange={(v) => { setSelectedSectionId(v); resetFromCategory(); }}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50">
            <SelectValue placeholder={sectionsLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {sections?.map(s => (
              <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3">
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* المستوى 2: الفئة */}
      <div className="space-y-2 text-start">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <Boxes className="h-3 w-3" /> {isRtl ? 'الفئة' : 'Category'}
        </Label>
        <Select 
          disabled={!selectedSectionId}
          value={selectedCategoryId} 
          onValueChange={(v) => { setSelectedCategoryId(v); resetFromComponent(); }}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50">
            <SelectValue placeholder={categoriesLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id!} className="font-bold text-xs py-3">
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* المستوى 3: العنصر */}
      <div className="space-y-2 text-start">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <Hammer className="h-3 w-3" /> {isRtl ? 'العنصر' : 'Component'}
        </Label>
        <Select 
          disabled={!selectedCategoryId}
          value={selectedComponentId} 
          onValueChange={setSelectedComponentId}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50">
            <SelectValue placeholder={componentsLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {components?.map(c => (
              <SelectItem key={c.id} value={c.id!} className="font-bold text-xs py-3">
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* المستوى 4: بند العمل النهائي */}
      <div className="space-y-2 text-start">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <ListChecks className="h-3 w-3 text-primary" /> {isRtl ? 'بند العمل' : 'Work Item'}
        </Label>
        <Select 
          disabled={!selectedComponentId}
          onValueChange={(id) => {
            const node = items?.find(i => i.id === id);
            if (node) onSelect(node);
          }}
        >
          <SelectTrigger className="h-11 rounded-xl border-2 font-black bg-primary/5 text-primary border-primary/20">
            <SelectValue placeholder={itemsLoading ? "..." : "---"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-2xl">
            {items?.map(item => (
              <SelectItem key={item.id} value={item.id!} className="font-black text-xs py-4 border-b last:border-0 border-slate-50">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center justify-between gap-4">
                      <span>{item.title}</span>
                      <Badge variant="outline" className="text-[8px] bg-slate-50 font-mono border-slate-200">
                         {item.code}
                      </Badge>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{item.unitSymbol || item.unitName}</span>
                      <span className="text-[8px] text-primary/60 font-black">Ref Price: {item.estimatedRate || 0}</span>
                   </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* مؤشر التحميل العام للمقايسة */}
      {(sectionsLoading || categoriesLoading || componentsLoading || itemsLoading) && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl pointer-events-none">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* رسالة إرشادية في حال عدم وجود بيانات */}
      {selectedComponentId && !itemsLoading && items?.length === 0 && (
        <div className="col-span-full mt-2 p-3 bg-rose-50 border-2 border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 animate-in slide-in-from-top-1">
           <Info className="h-4 w-4" />
           <p className="text-[10px] font-bold">{isRtl ? 'لا توجد بنود عمل معرّفة تحت هذا العنصر في القاموس المرجعي.' : 'No work items defined under this component in master reference.'}</p>
        </div>
      )}
    </div>
  );
}
