'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Search, Loader2, 
  ArrowRight, Filter, Hammer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { WorkGroup, Employee } from '@/types/hr';
import { Department } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/hooks/use-toast';

export default function WorkGroupsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState<Partial<WorkGroup>>({
    name: '', code: '', departmentId: '', supervisorId: '', memberIds: [], isActive: true
  });

  const groupsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.workGroups(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: groups, loading: groupsLoading } = useCollection<WorkGroup>(groupsQuery);

  const filteredGroups = (groups || []).filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.supervisorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500" dir={dir}>
      {/* Unified Header Design */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Users className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('construction.groups')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">{t('construction.groupsdesc')}</p>
          </div>
        </div>

        <Button onClick={() => setIsAddOpen(true)} className="h-11 px-8 font-black rounded-xl shadow-lg shadow-primary/20">
            <Plus className="h-5 w-5 me-2" /> {isRtl ? 'تكوين طاقم عمل' : 'New Group'}
        </Button>
      </header>

      <Card className="rounded-xl shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
         <div className="p-4 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
            <div className="relative w-full max-w-sm text-start">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
               <Input 
                 placeholder={t('common.search')} 
                 className="ps-11 h-11 border-2 border-slate-100 bg-white font-bold text-sm rounded-xl focus:border-primary/40 transition-all" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
            <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs border-2"><Filter className="h-4 w-4 me-2" /> {t('common.filter')}</Button>
         </div>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b-0">
                     <TableHead className="py-5 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'بيانات الطاقم والقسم' : 'Crew & Dept'}</TableHead>
                     <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'المشرف المسؤول' : 'Supervisor'}</TableHead>
                     <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'العدد' : 'Count'}</TableHead>
                     <TableHead className="pe-10"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {groupsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredGroups.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24 text-slate-300 font-black italic">{t('common.noresults')}</TableCell></TableRow>
                  ) : filteredGroups.map(group => (
                    <TableRow key={group.id} className="hover:bg-primary/[0.01] border-b-slate-100 group cursor-pointer">
                       <TableCell className="py-4 ps-10 text-start">
                          <div className="flex flex-col text-start">
                             <span className="font-black text-slate-800 text-base">{group.name}</span>
                             <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-1">{group.departmentName}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-start">
                          <span className="text-sm font-bold text-slate-600">{group.supervisorName}</span>
                       </TableCell>
                       <TableCell className="text-center">
                          <Badge variant="secondary" className="font-black border-0 bg-blue-50 text-blue-600 text-[10px] px-4 py-1 rounded-lg shadow-sm">{group.memberCount} Staff</Badge>
                       </TableCell>
                       <TableCell className="pe-10 text-end">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-primary transition-all">
                             <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                          </Button>
                       </TableCell>
                    </TableRow>
                  ))}
               </TableBody>
            </Table>
         </CardContent>
      </Card>
    </div>
  );
}
