
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, 
  Edit3, Trash2, Settings2,
  RefreshCcw,
  Link as LinkIcon,
  Filter,
  Hammer,
  ArrowRight,
  PlusCircle,
  CheckCircle2
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { EquipmentService } from '@/services/equipment-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EquipmentMasterPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAssigning, setIsAssigning] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({ projectId: '', fromDate: new Date().toISOString().split('T')[0] });

  const equipQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.equipment(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: equipment, loading: equipLoading } = useCollection<Equipment>(equipQuery);
  const { data: projects } = useCollection<any>(projectsQuery);

  const equipmentService = useMemo(() => db && companyId ? new EquipmentService(db, companyId) : null, [db, companyId]);

  const handleAssign = async () => {
    if (!equipmentService || !user || !isAssigning || !assignForm.projectId) return;
    setLoading(true);
    try {
      const proj = projects?.find(p => p.id === assignForm.projectId);
      await equipmentService.assignToProject(
        isAssigning.id, 
        isAssigning.name, 
        assignForm.projectId, 
        proj?.subServiceName || 'Project', 
        assignForm.fromDate, 
        user.uid,
        globalUser?.fullName || 'Admin'
      );
      toast({ title: isRtl ? "تم تخصيص المعدة لمشروع" : "Equipment Assigned" });
      setIsAssigning(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (equip: Equipment) => {
    if (!equipmentService || !user) return;
    if (!confirm(isRtl ? "تأكيد تحرير المعدة وإعادتها للمخزن؟" : "Confirm equipment release?")) return;
    setLoading(true);
    try {
      await equipmentService.releaseFromProject(equip.id, new Date().toISOString().split('T')[0], user.uid);
      toast({ title: isRtl ? "تم تحرير المعدة" : "Equipment Released" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return (equipment || []).filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [equipment, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Truck className="h-8 w-8 text-primary" />
            {isRtl ? 'سجل المعدات والآليات' : 'Equipment Master'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة الأصول التشغيلية، تتبع التخصيص، والتحليل المحاسبي للإهلاك.' : 'Manage operational assets, track assignments, and depreciation analysis.'}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/equipment/new')} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700 font-black">
           <Plus className="h-5 w-5" /> {isRtl ? 'إضافة معدة جديدة' : 'Add New Equipment'}
        </Button>
      </header>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث بالكود أو الاسم...' : 'Search equipment...'} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-slate-200">
             <Filter className="h-4 w-4 me-2 text-primary" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </div>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المعدة / الكود' : 'Equipment / Code'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'النوع والملكية' : 'Type & Ownership'}</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">{isRtl ? 'تعرفة الساعة' : 'Hourly Rate'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة والمشروع' : 'Status & Project'}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-300 font-bold italic">{isRtl ? 'لا يوجد معدات مسجلة.' : 'No equipment found.'}</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-primary/[0.01] transition-colors border-b-slate-100">
                    <TableCell className="ps-10 py-6 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                             <Hammer className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-lg leading-none">{item.name}</span>
                             <span className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest font-mono">#{item.code}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-slate-600">{item.type}</span>
                          <Badge variant="outline" className={cn(
                            "w-fit text-[8px] font-black uppercase bg-white",
                            item.ownershipType === 'owned' ? "text-blue-600 border-blue-100" : "text-orange-600 border-orange-100"
                          )}>
                             {item.ownershipType}
                          </Badge>
                       </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-emerald-600 text-lg">
                       {item.ownershipType === 'owned' ? (item.hourlyDepreciationRate || 0) : (item.hourlyRentalRate || 0)}
                       <span className="text-[8px] text-slate-300 ms-1">KWD</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="space-y-1.5">
                          <Badge className={cn(
                            "font-black px-3 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                            item.status === 'available' ? 'bg-emerald-50 text-emerald-600' :
                            item.status === 'in_use' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                          )}>
                             {item.status}
                          </Badge>
                          {item.currentProjectId && (
                            <p className="text-[9px] font-bold text-primary flex items-center gap-1">
                               <LinkIcon className="h-2 w-2" /> {item.currentProjectName}
                            </p>
                          )}
                       </div>
                    </TableCell>
                    <TableCell className="pe-10 text-end">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.status === 'available' ? (
                            <Button size="sm" variant="outline" onClick={() => setIsAssigning(item)} className="h-8 rounded-lg text-[9px] font-black gap-1.5 bg-blue-50 text-blue-600 border-blue-100">
                               <LinkIcon className="h-3 w-3" /> {isRtl ? 'تخصيص' : 'Assign'}
                            </Button>
                          ) : item.status === 'in_use' && (
                            <Button size="sm" variant="outline" onClick={() => handleRelease(item)} className="h-8 rounded-lg text-[9px] font-black gap-1.5 bg-orange-50 text-orange-600 border-orange-100">
                               <RefreshCcw className="h-3 w-3" /> {isRtl ? 'تحرير' : 'Release'}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600" onClick={() => router.push(`/dashboard/equipment/${item.id}/edit`)}>
                             <Edit3 className="h-4 w-4" />
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!isAssigning} onOpenChange={() => setIsAssigning(null)}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md" dir={dir}>
            <div className="bg-blue-600 p-8 text-white text-start">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <LinkIcon className="h-6 w-6 text-blue-200" />
                  {isRtl ? 'تخصيص المعدة لمشروع' : 'Assign to Project'}
               </DialogTitle>
               <p className="text-[10px] font-bold text-blue-100/70 mt-2 uppercase tracking-widest">{isAssigning?.name}</p>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اختر المشروع' : 'Target Project'}</Label>
                  <Select value={assignForm.projectId} onValueChange={v => setAssignForm({...assignForm, projectId: v})}>
                     <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border-2 shadow-2xl">
                        {projects?.filter(p => p.status !== 'completed').map(p => (
                          <SelectItem key={p.id} value={p.id} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                             <div className="flex flex-col text-start">
                                <span>{p.subServiceName}</span>
                                <span className="text-[8px] text-slate-400 uppercase">#{p.transactionNumber}</span>
                             </div>
                          </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ التخصيص' : 'From Date'}</Label>
                  <Input type="date" value={assignForm.fromDate} onChange={e => setAssignForm({...assignForm, fromDate: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleAssign} disabled={loading || !assignForm.projectId} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-200 transition-all border-b-8 border-blue-800">
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 me-2" />}
                  {isRtl ? 'تأكيد التخصيص' : 'Confirm Assignment'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
