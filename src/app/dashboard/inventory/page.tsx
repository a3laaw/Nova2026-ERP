'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, Boxes, Truck, Plus, 
  Search, Loader2,
  AlertTriangle, Save,
  User, RotateCcw,
  PackageCheck, History, ArrowDownToLine
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryService } from '@/services/inventory-service';
import { Employee } from '@/types/hr';
import { toast } from '@/hooks/use-toast';
import { canPerformOnRecord } from '@/lib/permissions/engine';

export default function InventoryDashboard() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const viewAccess = check('inventory', 'view');
  const canCreate = check('inventory', 'create').can;
  const canTransfer = check('inventory', 'transfer').can;

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAssignAssetOpen, setIsAssignAssetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [itemForm, setItemForm] = useState({ name: '', sku: '', quantity: 0, unit: 'pcs', warehouseId: 'default' });
  const [assignForm, setAssignForm] = useState({ employeeId: '', itemId: '', quantity: 1 });

  const itemsQuery = useMemo(() => companyId && db ? query(collection(db, paths.inventoryItems(companyId)), orderBy('name')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active'), orderBy('fullName')) : null, [db, companyId]);
  const assignmentsQuery = useMemo(() => companyId && db ? query(collection(db, paths.assetAssignments(companyId)), orderBy('assignedAt', 'desc'), limit(20)) : null, [db, companyId]);

  const { data: items, loading: iLoading } = useCollection<any>(itemsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: rawAssignments } = useCollection<any>(assignmentsQuery);

  const assignments = useMemo(() => {
    if (!viewAccess.can) return [];
    if (viewAccess.scope === 'all') return rawAssignments;
    return rawAssignments.filter(log => canPerformOnRecord(
      viewAccess,
      { uid: user?.uid || '', departmentId: globalUser?.departmentId },
      { createdBy: log.employeeId, departmentId: log.departmentId }
    ));
  }, [rawAssignments, viewAccess, globalUser, user]);

  const inventoryService = useMemo(() => db && companyId ? new InventoryService(db, companyId) : null, [db, companyId]);

  const handleAddItem = async () => {
    if (!inventoryService || !itemForm.name || !canCreate) return;
    setLoading(true);
    try {
      await inventoryService.addItem(itemForm);
      toast({ title: t('saved') });
      setItemForm({ name: '', sku: '', quantity: 0, unit: 'pcs', warehouseId: 'default' });
      setIsAddItemOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAsset = async () => {
    if (!inventoryService || !assignForm.employeeId || !assignForm.itemId || !canTransfer) return;
    setLoading(true);
    try {
      const emp = employees?.find(e => e.id === assignForm.employeeId);
      const item = items?.find(i => i.id === assignForm.itemId);
      await inventoryService.assignAsset({ ...assignForm, employeeName: emp?.fullName || '', itemName: item?.name || '' });
      toast({ title: isRtl ? "تم صرف العهدة" : "Asset Assigned" });
      setAssignForm({ employeeId: '', itemId: '', quantity: 1 });
      setIsAssignAssetOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900">
             <Package className="h-8 w-8 text-primary" />
             {isRtl ? 'المخازن والعهد' : 'Inventory & Assets'}
           </h1>
           <p className="text-slate-600 text-sm font-bold opacity-80">{isRtl ? 'تتبع المخزون والعهد الميدانية' : 'Track stock and field assignments'}</p>
        </div>

        <div className="flex gap-3">
           {canTransfer && (
             <Dialog open={isAssignAssetOpen} onOpenChange={setIsAssignAssetOpen}>
                <DialogTrigger asChild>
                   <Button variant="default" className="h-11 px-8 shadow-xl shadow-primary/20 flex items-center gap-2">
                      <Truck className="h-4 w-4" /> {isRtl ? 'صرف عهدة' : 'Assign Asset'}
                   </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
                   <div className="bg-slate-900 p-8 text-white text-start">
                      <DialogTitle className="font-black text-2xl">{isRtl ? 'صرف عهدة جديدة' : 'New Assignment'}</DialogTitle>
                   </div>
                   <div className="p-8 space-y-6 text-start">
                      <div className="space-y-2">
                         <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الموظف' : 'Employee'}</Label>
                         <Select value={assignForm.employeeId} onValueChange={v => setAssignForm({...assignForm, employeeId: v})}>
                            <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                               {employees?.map(e => <SelectItem key={e.id} value={e.id!} className="font-bold">{e.fullName}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الصنف' : 'Item'}</Label>
                         <Select value={assignForm.itemId} onValueChange={v => setAssignForm({...assignForm, itemId: v})}>
                            <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                               {items?.filter(i => i.quantity > 0).map(i => <SelectItem key={i.id} value={i.id!} className="font-bold">{i.name}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                   </div>
                   <DialogFooter className="p-8 bg-slate-50 border-t">
                      <Button onClick={handleAssignAsset} disabled={loading} className="w-full h-12 rounded-xl font-black">
                         {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'تأكيد الصرف' : 'Confirm')}
                      </Button>
                   </DialogFooter>
                </DialogContent>
             </Dialog>
           )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'أصناف المخزن' : 'Items', val: items?.length || 0, icon: Boxes, color: 'text-primary', bg: 'bg-orange-50' },
           { label: isRtl ? 'العهد النشطة' : 'Active', val: assignments?.filter((a: any) => a.status === 'in-use').length || 0, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'تنبيهات نقص' : 'Low Stock', val: items?.filter(i => i.quantity < 3).length || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
         ].map((stat, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-xl bg-white p-6 flex items-center justify-between">
              <div className="text-start">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                 <h3 className="text-3xl font-black text-slate-900">{stat.val}</h3>
              </div>
              <div className={cn("p-4 rounded-xl", stat.bg, stat.color)}>
                 <stat.icon className="h-6 w-6" />
              </div>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-black">{isRtl ? 'رصيد المستودع' : 'Stock Balance'}</CardTitle>
            <div className="relative w-full max-w-xs">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
               <Input placeholder={t('search')} className="ps-12 h-10 border-slate-200" />
            </div>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="py-6 ps-8 text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الصنف' : 'Item'}</TableHead>
                     <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                     <TableHead className="pe-8"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {iLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : items?.map(item => (
                    <TableRow key={item.id} className="hover:bg-primary/5 transition-colors border-b-slate-100">
                       <TableCell className="py-6 ps-8 font-black text-slate-800">{item.name}</TableCell>
                       <TableCell className="text-center">
                          <span className={cn("font-black text-xl", item.quantity < 3 ? "text-rose-600" : "text-emerald-600")}>{item.quantity}</span>
                          <span className="text-[10px] font-bold text-slate-400 ms-1 uppercase">{item.unit}</span>
                       </TableCell>
                       <TableCell className="pe-8 text-end">
                          <Button variant="outline" size="sm" className="rounded-lg text-[10px] h-9">
                             <Edit3 className="h-3.5 w-3.5" />
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
