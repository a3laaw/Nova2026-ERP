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
  const [returningId, setReturningId] = useState<string | null>(null);

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
             <Package className="h-8 w-8 text-[#FFA000]" />
             {isRtl ? 'المخازن والعهد' : 'Inventory & Assets'}
           </h1>
           <p className="text-slate-600 text-sm font-bold opacity-80">{isRtl ? 'تتبع المخزون والعهد الميدانية' : 'Track stock and field assignments'}</p>
        </div>

        <div className="flex gap-3">
           {canTransfer && (
             <Dialog open={isAssignAssetOpen} onOpenChange={setIsAssignAssetOpen}>
                <DialogTrigger asChild>
                   <Button className="bg-[#1e1b4b] text-white font-bold h-11 px-6 shadow-sm">
                      <Truck className="h-4 w-4 me-2" /> {isRtl ? 'صرف عهدة' : 'Assign Asset'}
                   </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl p-8 max-w-lg" dir={dir}>
                   <DialogHeader><DialogTitle className="text-start font-bold text-xl">{isRtl ? 'صرف عهدة جديدة' : 'New Assignment'}</DialogTitle></DialogHeader>
                   <div className="space-y-4 py-4 text-start">
                      <div className="space-y-2">
                         <Label className="text-xs font-bold text-slate-500 uppercase">{isRtl ? 'الموظف' : 'Employee'}</Label>
                         <Select value={assignForm.employeeId} onValueChange={v => setAssignForm({...assignForm, employeeId: v})}>
                            <SelectTrigger className="h-11 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent className="rounded-lg">
                               {employees?.map(e => <SelectItem key={e.id} value={e.id!} className="font-bold">{e.fullName}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs font-bold text-slate-500 uppercase">{isRtl ? 'الصنف' : 'Item'}</Label>
                         <Select value={assignForm.itemId} onValueChange={v => setAssignForm({...assignForm, itemId: v})}>
                            <SelectTrigger className="h-11 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent className="rounded-lg">
                               {items?.filter(i => i.quantity > 0).map(i => <SelectItem key={i.id} value={i.id!} className="font-bold">{i.name}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                   </div>
                   <DialogFooter>
                      <Button onClick={handleAssignAsset} disabled={loading} className="w-full h-12 rounded-lg font-bold bg-[#FFA000]">
                         {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'تأكيد الصرف' : 'Confirm')}
                      </Button>
                   </DialogFooter>
                </DialogContent>
             </Dialog>
           )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: isRtl ? 'أصناف المخزن' : 'Items', val: items?.length || 0, icon: Boxes, color: 'text-[#FFA000]', bg: 'bg-orange-50' },
           { label: isRtl ? 'العهد النشطة' : 'Active', val: assignments?.filter((a: any) => a.status === 'in-use').length || 0, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'مسترجع' : 'Returned', val: assignments?.filter((a: any) => a.status === 'returned').length || 0, icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: isRtl ? 'تنبيهات نقص' : 'Low Stock', val: items?.filter(i => i.quantity < 3).length || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
         ].map((stat, i) => (
           <Card key={i} className="border-none shadow-sm card-shadow bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="text-start">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                   <h3 className="text-3xl font-black text-slate-900">{stat.val}</h3>
                </div>
                <div className={cn("p-3 rounded-lg", stat.bg, stat.color)}>
                   <stat.icon className="h-5 w-5" />
                </div>
              </CardContent>
           </Card>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card className="lg:col-span-2 border-none shadow-sm card-shadow bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-5 text-start">
               <CardTitle className="text-base font-bold flex items-center gap-2">
                 <Boxes className="h-5 w-5 text-[#FFA000]" /> {isRtl ? 'رصيد المستودع' : 'Stock Balance'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                  <TableHeader className="bg-muted/5">
                     <TableRow>
                        <TableHead className="py-4 ps-6">{isRtl ? 'الصنف' : 'Item'}</TableHead>
                        <TableHead className="text-center">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                        <TableHead className="text-end pe-6">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {iLoading ? <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/30" /></td></tr> : 
                        items?.map(item => (
                           <TableRow key={item.id} className="border-b-slate-50 hover:bg-slate-50/50">
                              <td className="py-4 ps-6 font-bold text-slate-800">{item.name}</td>
                              <td className="text-center">
                                 <span className={cn("font-black text-sm", item.quantity < 3 ? "text-rose-600" : "text-slate-900")}>
                                    {item.quantity}
                                 </span>
                                 <span className="text-[10px] ms-1 text-slate-400 font-bold uppercase">{item.unit}</span>
                              </td>
                              <td className="text-end pe-6">
                                 <Badge variant="outline" className={cn(
                                   "font-black text-[9px] border-none px-3 py-1",
                                   item.quantity < 3 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                 )}>
                                    {item.quantity < 3 ? 'LOW' : 'STABLE'}
                                 </Badge>
                              </td>
                           </TableRow>
                        ))
                     }
                  </TableBody>
               </Table>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm card-shadow bg-white overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b p-5 text-start">
               <CardTitle className="text-base font-bold flex items-center gap-2">
                 <History className="h-5 w-5 text-slate-400" /> {isRtl ? 'سجل العهد' : 'Recent Activity'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
               <div className="divide-y divide-slate-50">
                  {assignments.length === 0 ? (
                    <div className="p-20 text-center text-slate-400 font-bold italic text-xs">{isRtl ? 'لا يوجد حركات.' : 'No activity.'}</div>
                  ) : assignments.map((log: any) => (
                    <div key={log.id} className="p-5 space-y-3 hover:bg-slate-50/50 transition-all text-start group">
                       <div className="flex justify-between items-start">
                          <div>
                             <p className="text-sm font-black text-slate-800">{log.itemName}</p>
                             <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <User className="h-3 w-3 text-[#039BE5]" /> {log.employeeName}
                             </p>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase px-2 border-none",
                            log.status === 'in-use' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                          )}>{log.status}</Badge>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                          <span className="font-mono">{log.assignedAt?.toDate().toLocaleDateString()}</span>
                       </div>
                    </div>
                  ))}
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}