'use client';

import { useState, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  LayoutGrid, 
  ListChecks,
  ChevronRight,
  Search,
  Check,
  RotateCcw,
  ChevronDown
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceNode } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { resolveNodeEffectiveServices } from '@/lib/boq-tree-utils';

interface Props {
  onSelect: (node: BOQReferenceNode) => void;
  className?: string;
  activityTypeId?: string; 
  serviceId?: string;
}

export function BOQReferenceSelector({ onSelect, className, activityTypeId, serviceId }: Props) {
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [parentSearch, setParentSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [openParent, setOpenParent] = useState(false);
  const [openItem, setOpenItem] = useState(false);

  const nodesQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.boqReferenceNodes(companyId)), orderBy('order'));
  }, [db, companyId]);

  const { data: allNodes, loading: nodesLoading } = useCollection<BOQReferenceNode>(nodesQuery);

  const filteredRoots = useMemo(() => {
    if (!allNodes) return [];
    let roots = allNodes.filter(node => node.depth === 0);
    
    if (activityTypeId || serviceId) {
      roots = roots.filter(node => {
        const effective = resolveNodeEffectiveServices(node.id!, allNodes);
        const matchService = !serviceId || effective.serviceIds.includes(serviceId);
        const matchActivity = !activityTypeId || (node.allowedActivityTypeIds && node.allowedActivityTypeIds.includes(activityTypeId));
        return matchService && matchActivity;
      });
    }

    if (parentSearch.trim()) {
      const q = parentSearch.toLowerCase();
      roots = roots.filter(r => r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    }

    return roots;
  }, [allNodes, activityTypeId, serviceId, parentSearch]);

  const currentChildren = useMemo(() => {
    if (!selectedParentId || !allNodes) return [];
    let items = allNodes.filter(n => n.parentId === selectedParentId);
    
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
    }
    
    return items;
  }, [selectedParentId, allNodes, itemSearch]);

  const selectedParent = allNodes?.find(n => n.id === selectedParentId);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 items-end", className)}>
      
      <div className="space-y-2 text-start relative">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> {isRtl ? 'القسم المرجعي الرئيسي' : 'Root Reference Section'}
        </Label>
        
        <Popover open={openParent} onOpenChange={setOpenParent}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full h-11 rounded-xl border-2 font-bold bg-slate-50/50 justify-between">
              <span className="truncate">{selectedParent?.title || (isRtl ? '--- اختر القسم ---' : '--- Select Section ---')}</span>
              <ChevronDown className="h-4 w-4 opacity-30" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 rounded-2xl shadow-3xl border-2" align="start">
            <div className="p-3 bg-slate-50 border-b">
               <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input 
                    placeholder={isRtl ? "بحث..." : "Search..."}
                    className="h-9 ps-9 rounded-lg border-2 bg-white text-xs font-bold"
                    value={parentSearch}
                    onChange={e => setParentSearch(e.target.value)}
                  />
               </div>
            </div>
            <ScrollArea className="h-64">
               <div className="p-2 space-y-1">
                  {filteredRoots.map(s => (
                    <div 
                      key={s.id} 
                      onClick={() => { setSelectedParentId(s.id!); setOpenParent(false); setParentSearch(""); }}
                      className={cn(
                        "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between",
                        selectedParentId === s.id ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                      )}
                    >
                       <span className="text-xs font-black">{s.title}</span>
                       {selectedParentId === s.id && <Check className="h-3.5 w-3.5" />}
                    </div>
                  ))}
                  {filteredRoots.length === 0 && <div className="py-10 text-center text-[10px] text-slate-400 italic">No matches.</div>}
               </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2 text-start relative">
        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
          <ListChecks className="h-3 w-3 text-primary" /> {isRtl ? 'البنود والتعريفات المتاحة' : 'Available Work Items'}
        </Label>
        
        <Popover open={openItem} onOpenChange={setOpenItem}>
          <PopoverTrigger asChild>
            <Button 
              disabled={!selectedParentId}
              variant="outline" 
              className="w-full h-11 rounded-xl border-2 font-black bg-primary/5 text-primary border-primary/20 justify-between"
            >
              <span className="truncate">{isRtl ? '--- ابحث عن بند ---' : '--- Search Item ---'}</span>
              <Search className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0 rounded-2xl shadow-3xl border-2" align="start">
            <div className="p-3 bg-slate-50 border-b">
               <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input 
                    placeholder={isRtl ? "بحث بالاسم أو الكود..." : "Search by name or code..."}
                    className="h-9 ps-9 rounded-lg border-2 bg-white text-xs font-bold"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                  />
               </div>
            </div>
            <ScrollArea className="h-72">
               <div className="p-2 space-y-1">
                  {currentChildren.map(node => {
                    const effective = resolveNodeEffectiveServices(node.id!, allNodes || []);
                    return (
                      <div 
                        key={node.id} 
                        onClick={() => {
                          if (node.isExecutable) { onSelect(node); setOpenItem(false); setItemSearch(""); }
                          else { setSelectedParentId(node.id!); setItemSearch(""); }
                        }}
                        className="p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-1 border border-transparent hover:border-primary/20 hover:bg-primary/5 group"
                      >
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-black text-slate-800">{node.title}</span>
                               {effective.isInherited && <RotateCcw className="h-2.5 w-2.5 text-slate-300" />}
                            </div>
                            <Badge className={cn("text-[7px] border-0 px-1.5 h-4", node.isExecutable ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                               {node.isExecutable ? 'ITEM' : 'GROUP'}
                            </Badge>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-slate-400">#{node.code}</span>
                            {node.isExecutable && node.unitSymbol && (
                               <span className="text-[9px] text-slate-400 font-bold uppercase">• {node.unitName} ({node.unitSymbol})</span>
                            )}
                         </div>
                      </div>
                    );
                  })}
                  {currentChildren.length === 0 && <div className="py-10 text-center text-[10px] text-slate-400 italic">No items in this section.</div>}
               </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {nodesLoading && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl pointer-events-none z-50">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
