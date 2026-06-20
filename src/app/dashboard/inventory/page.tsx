'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, Boxes, Truck, Plus, 
  Search, Loader2, Warehouse as WarehouseIcon,
  LayoutGrid, AlertTriangle, ArrowRight, Save,
  User, CheckCircle2, History, RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryService } from '@/services/inventory-service';
import { Employee } from '@/types/hr';
import { toast } from '@/hooks/use-toast';

export default function InventoryDashboard() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // States
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAssignAssetOpen, setIsAssignAssetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  // Forms
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });
  const [itemForm, setItemForm] = useState({ name: '', sku: '', quantity: 0, unit: 'pcs', warehouseId: '' });
  const [assignForm, setAssignForm] = useState({ employeeId: '', itemId: '', quantity: 1 });

  // Data
  const warehousesQuery = useMemo(() => companyId && db ? query(collection(db, paths.warehouses(companyId)), orderBy('name')) : null, [db, companyId]);
  const itemsQuery = useMemo(() => companyId && db ? query(collection(db, paths.inventoryItems(companyId)), orderBy('name')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, [db, companyId]);
  const logsQuery = useMemo(() => companyId && db ? query(collection(db, paths.assetAssignments(companyId)), orderBy('assignedAt', 'desc'), limit(10)) : null, [db, companyId]);

  const { data: warehouses, loading: wLoading } = useCollection(warehousesQuery);
  const { data: items, loading: iLoading } = useCollection(itemsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: assignments, loading: logsLoading } = useCollection<any>(logsQuery);

  const inventoryService = useMemo(() => db && companyId ? new InventoryService(db, companyId) : null, [db, companyId]);

  const handleAddWarehouse = async () => {
    if (!inventoryService || !warehouseForm.name) return;
    setLoading(true);
    try {
      await inventoryService.addWarehouse(warehouseForm);
      toast({ title: t('saved') });
      setWarehouseForm({ name: '', location: '' });
      setIsAddWarehouseOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!inventoryService || !itemForm.name || !itemForm.warehouseId) return;
    setLoading(true);
    try {
      await inventoryService.addItem(itemForm);
      toast({ title: t('saved') });
      setItemForm({ name: '', sku: '', quantity: 0, unit: 'pcs', warehouseId: '' });
      setIsAddItemOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAsset = async () => {
    if (!inventoryService || !assignForm.employeeId || !assignForm.itemId) return;
    setLoading(true);
    try {
      const emp = employees?.find(e => e.id === assignForm.employeeId);
      const item = items?.find(i => i.id === assignForm.itemId);
      
      await inventoryService.assignAsset({
        ...assignForm,
        employeeName: emp?.fullName || '',
        itemName: item?.name || ''
      });
      toast({ title: isRtl ? "تم صرف العهدة بنجاح" : "Asset Assigned Successfully" });
      setAssignForm({ employeeId: '', itemId: '', quantity: 1 });
      setIsAssignAssetOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReturnAsset = async (assignment: any) => {
    if (!inventoryService) return;
    setReturningId(assignment.id);
    try {
      await inventoryService.returnAsset(assignment.id, assignment.itemId, assignment.quantity);
      toast({ title: isRtl ? "تم استرجاع العهدة للمخزن" : "Asset returned to stock" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-2">
           <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Package className="h-10 w-10 text-primary" />
             {isRtl ? 'إدارة المخازن والعهد' : 'Inventory & Assets'}
           </h1>
           <p className="text-muted-foreground font-bold text-sm opacity-80 italic">
             {isRtl ? 'تتبع المخزون اللحظي وإدارة تسليم المعدات للميدان.' : 'Real-time inventory tracking and equipment assignment.'}
           </p>
        </div>

        <div className="flex gap-4">
           {/* صرف عهدة */}
           <Dialog open={isAssignAssetOpen} onOpenChange={setIsAssignAssetOpen}>
              <DialogTrigger asChild>
                 <Button className="h-16 px-8 rounded-2xl bg-slate-900 text-white font-black gap-2 hover:bg-slate-800 transition-all shadow-xl">
                    <Truck className="h-5 w-5 text-primary" /> {isRtl ? 'صرف عهدة' : 'Assign Asset'}
                 </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2.5rem] p-8 max-w-lg" dir={dir}>
                 <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'تسليم عهدة لموظف' : 'Assign to Employee'}</DialogTitle></DialogHeader>
                 <div className="space-y-6 py-4 text-start">
                    <div className="space-y-2">
                       <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'الموظف المستلم' : 'Select Employee'}</Label>
                       <Select value={assignForm.employeeId} onValueChange={v => setAssignForm({...assignForm, employeeId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent>
                             {employees?.map(e => <SelectItem key={e.id} value={e.id!}>{e.fullName} (#{e.employeeNumber})</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'الصنف المراد صرفه' : 'Select Item'}</Label>
                       <Select value={assignForm.itemId} onValueChange={v => setAssignForm({...assignForm, itemId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent>
                             {items?.filter(i => i.quantity > 0).map(i => <SelectItem key={i.id} value={i.id!}>{i.name} ({i.quantity} {i.unit})</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'الكمية' : 'Quantity'}</Label>
                       <Input type="number" value={assignForm.quantity} onChange={e => setAssignForm({...assignForm, quantity: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black" />
                    </div>
                 </div>
                 <DialogFooter>
                    <Button onClick={handleAssignAsset} disabled={loading || !assignForm.employeeId || !assignForm.itemId} className="w-full h-14 rounded-2xl font-black text-lg bg-primary">
                       {loading ? <Loader2 className="animate-spin" /> : (isRtl ? 'تأكيد عملية الصرف' : 'Confirm Assignment')}
                    </Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>

           {/* إضافة صنف */}
           <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
              <DialogTrigger asChild>
                 <Button className="h-16 px-10 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3">
                    <Boxes className="h-6 w-6" /> {isRtl ? 'إضافة صنف' : 'Add Item'}
                 </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2.5rem] p-8 max-w-lg" dir={dir}>
                 <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'إضافة صنف مخزني' : 'New Inventory Item'}</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4 text-start">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] text-slate-400 uppercase">{isRtl ? 'اسم الصنف' : 'Item Name'}</Label>
                          <Input value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="h-12 rounded-xl border-2" />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] text-slate-400 uppercase">{isRtl ? 'الباركود / SKU' : 'SKU'}</Label>
                          <Input value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] text-slate-400 uppercase">{isRtl ? 'الكمية الافتتاحية' : 'Initial Qty'}</Label>
                          <Input type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: Number(e.target.value)})} className="h-12 rounded-xl border-2" />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] text-slate-400 uppercase">{isRtl ? 'وحدة القياس' : 'Unit'}</Label>
                          <Input value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="h-12 rounded-xl border-2" placeholder="pcs, kg, m..." />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-[10px] text-slate-400 uppercase">{isRtl ? 'المستودع' : 'Warehouse'}</Label>
                       <Select value={itemForm.warehouseId} onValueChange={v => setItemForm({...itemForm, warehouseId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-black"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent>
                             {warehouses?.map(w => <SelectItem key={w.id} value={w.id!}>{w.name}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
                 <DialogFooter>
                    <Button onClick={handleAddItem} disabled={loading || !itemForm.warehouseId} className="w-full h-12 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin" /> : t('save')}</Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي المستودعات' : 'Total Warehouses', val: warehouses?.length || 0, icon: WarehouseIcon, color: 'text-primary', bg: 'bg-primary/5' },
           { label: isRtl ? 'أصناف مخزنية' : 'Inventory Items', val: items?.length || 0, icon: Boxes, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'عهد ميدانية' : 'Field Assets', val: assignments?.filter((a: any) => a.status === 'in-use').length || 0, icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: isRtl ? 'تنبيهات نقص' : 'Low Stock', val: items?.filter(i => i.quantity < 5).length || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
         ].map((stat, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-[2.5rem] p-6 text-start bg-white group hover:shadow-xl transition-all">
              <div className={cn("p-4 rounded-2xl w-fit mb-4", stat.bg, stat.color)}>
                 <stat.icon className="h-6 w-6" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-4xl font-black font-headline text-slate-900">{stat.val}</h3>
           </Card>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
         <Card className="lg:col-span-2 border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 text-start flex flex-row items-center justify-between">
               <div className="space-y-1">
                  <CardTitle className="text-xl font-black">{isRtl ? 'جدول الأصناف والمواد' : 'Inventory Items Table'}</CardTitle>
                  <CardDescription className="font-bold">{isRtl ? 'مراجعة الكميات المتاحة في كافة المستودعات.' : 'Available quantities across all warehouses.'}</CardDescription>
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <table className="w-full text-start text-sm">
                  <thead className="bg-slate-50/50 border-b">
                     <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <th className="p-6 text-start">{isRtl ? 'الصنف' : 'Item'}</th>
                        <th className="p-6 text-start">{isRtl ? 'SKU' : 'SKU'}</th>
                        <th className="p-6 text-center">{isRtl ? 'الكمية' : 'Qty'}</th>
                        <th className="p-6 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                     {iLoading ? <tr><td colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr> : 
                        items?.map(item => (
                           <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="p-6">
                                 <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black">
                                       {item.name?.charAt(0)}
                                    </div>
                                    <span className="font-black text-slate-800">{item.name}</span>
                                 </div>
                              </td>
                              <td className="p-6 font-mono text-xs text-slate-400">{item.sku}</td>
                              <td className="p-6 text-center">
                                 <span className={cn("font-black text-lg", item.quantity < 5 ? "text-rose-600" : "text-slate-900")}>
                                    {item.quantity}
                                 </span>
                                 <span className="text-[10px] ms-1 text-slate-400">{item.unit}</span>
                              </td>
                              <td className="p-6">
                                 {item.quantity < 5 ? (
                                    <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-0 text-[9px] font-black uppercase tracking-tighter">Low Stock</Badge>
                                 ) : (
                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0 text-[9px] font-black uppercase tracking-tighter">In Stock</Badge>
                                 )}
                              </td>
                           </tr>
                        ))
                     }
                  </tbody>
               </table>
            </CardContent>
         </Card>

         <Card className="border-0 shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden group">
            <CardHeader className="bg-white/5 border-b border-white/5 p-8 text-start">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center">
                     <History className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-black">{isRtl ? 'تحركات العهد الميدانية' : 'Field Asset Logs'}</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
               <div className="divide-y divide-white/5">
                  {logsLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/40" /></div> : (
                    assignments?.map((log: any) => (
                      <div key={log.id} className="p-6 space-y-4 hover:bg-white/5 transition-all text-start">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <p className="text-sm font-black text-white">{log.itemName}</p>
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                  <User className="h-2 w-2" /> {log.employeeName}
                               </p>
                            </div>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase",
                              log.status === 'in-use' ? "border-amber-500 text-amber-400" : "border-emerald-500 text-emerald-400"
                            )}>{log.status}</Badge>
                         </div>
                         
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-slate-600">{log.assignedAt?.toDate().toLocaleDateString()}</span>
                            {log.status === 'in-use' && (
                               <Button 
                                 size="sm" 
                                 variant="ghost" 
                                 onClick={() => handleReturnAsset(log)}
                                 disabled={returningId === log.id}
                                 className="h-8 rounded-lg bg-white/5 text-primary hover:bg-primary hover:text-white font-black text-[9px] gap-1.5"
                               >
                                  {returningId === log.id ? <Loader2 className="animate-spin h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                                  {isRtl ? 'استرجاع' : 'Return'}
                               </Button>
                            )}
                         </div>
                      </div>
                    ))
                  )}
                  {assignments?.length === 0 && <div className="p-20 text-center text-slate-500 italic text-sm">{isRtl ? 'لا يوجد حركات مسجلة.' : 'No movements found.'}</div>}
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
