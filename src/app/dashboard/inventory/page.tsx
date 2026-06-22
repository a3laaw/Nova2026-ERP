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

  // فحص الصلاحيات الميدانية
  const viewAccess = check('inventory', 'view');
  const canCreate = check('inventory', 'create').can; // لإدخال مخزني
  const canTransfer = check('inventory', 'transfer').can; // لصرف واسترجاع العهد

  // States
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAssignAssetOpen, setIsAssignAssetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  // Forms
  const [itemForm, setItemForm] = useState({ name: '', sku: '', quantity: 0, unit: 'pcs', warehouseId: 'default' });
  const [assignForm, setAssignForm] = useState({ employeeId: '', itemId: '', quantity: 1 });

  // Data
  const itemsQuery = useMemo(() => companyId && db ? query(collection(db, paths.inventoryItems(companyId)), orderBy('name')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active'), orderBy('fullName')) : null, [db, companyId]);
  
  // سجل التحركات: يخضع لفلترة النطاق (Scope)
  const assignmentsQuery = useMemo(() => companyId && db ? query(collection(db, paths.assetAssignments(companyId)), orderBy('assignedAt', 'desc'), limit(20)) : null, [db, companyId]);

  const { data: items, loading: iLoading } = useCollection<any>(itemsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: rawAssignments, loading: logsLoading } = useCollection<any>(assignmentsQuery);

  // تصفية السجلات بناءً على الصلاحية (عزل البيانات)
  const assignments = useMemo(() => {
    if (!viewAccess.can) return [];
    if (viewAccess.scope === 'all') return rawAssignments;
    
    return rawAssignments.filter(log => canPerformOnRecord(
      viewAccess,
      { uid: user?.uid || '', departmentId: globalUser?.departmentId },
      { createdBy: log.employeeId, departmentId: log.departmentId } // العهد عادة تتبع الموظف
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
    if (!inventoryService || !user || !canTransfer) return;
    setReturningId(assignment.id);
    try {
      await inventoryService.returnAsset(assignment.id, assignment.itemId, assignment.quantity, user.uid);
      toast({ title: isRtl ? "تم استرجاع العهدة للمخزن بنجاح" : "Asset returned to stock" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-2">
           <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Package className="h-10 w-10 text-primary" />
             {isRtl ? 'المخازن والعهد الميدانية' : 'Inventory & Field Assets'}
           </h1>
           <p className="text-muted-foreground font-bold text-sm opacity-80 italic">
             {viewAccess.scope === 'own' ? (isRtl ? 'استعراض عهدك الشخصية المسجلة' : 'Viewing your assigned assets') : (isRtl ? 'تتبع المخزون اللحظي وحركات العهد الميدانية' : 'Track stock and asset movements')}
           </p>
        </div>

        <div className="flex gap-4">
           {/* صرف عهدة: تظهر فقط للمخولين بالتحويل */}
           {canTransfer && (
             <Dialog open={isAssignAssetOpen} onOpenChange={setIsAssignAssetOpen}>
                <DialogTrigger asChild>
                   <button className="btn-nova-primary h-16 px-8 rounded-2xl flex items-center gap-3">
                      <Truck className="h-6 w-6" /> {isRtl ? 'صرف عهدة جديدة' : 'Assign Asset'}
                   </button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] p-8 max-w-lg" dir={dir}>
                   <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'صرف عهدة لموظف' : 'New Assignment'}</DialogTitle></DialogHeader>
                   <div className="space-y-6 py-4 text-start">
                      <div className="space-y-2">
                         <Label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">{isRtl ? 'الموظف المستلم' : 'Receiver'}</Label>
                         <Select value={assignForm.employeeId} onValueChange={v => setAssignForm({...assignForm, employeeId: v})}>
                            <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                               {employees?.map(e => <SelectItem key={e.id} value={e.id!} className="font-bold">{e.fullName}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">{isRtl ? 'الصنف المراد صرفه' : 'Item'}</Label>
                         <Select value={assignForm.itemId} onValueChange={v => setAssignForm({...assignForm, itemId: v})}>
                            <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                               {items?.filter(i => i.quantity > 0).map(i => <SelectItem key={i.id} value={i.id!} className="font-bold">{i.name} ({i.quantity} {i.unit})</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">{isRtl ? 'الكمية' : 'Quantity'}</Label>
                         <Input type="number" value={assignForm.quantity} onChange={e => setAssignForm({...assignForm, quantity: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black" />
                      </div>
                   </div>
                   <DialogFooter>
                      <Button onClick={handleAssignAsset} disabled={loading} className="w-full h-14 rounded-2xl font-black text-lg bg-primary">
                         {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'تأكيد الصرف' : 'Confirm Assignment')}
                      </Button>
                   </DialogFooter>
                </DialogContent>
             </Dialog>
           )}

           {/* إدخال مخزني: يظهر فقط لمن يملك صلاحية Create */}
           {canCreate && (
             <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
                <DialogTrigger asChild>
                   <Button variant="outline" className="h-16 px-8 rounded-2xl border-2 font-black gap-3 hover:bg-slate-50 transition-all">
                      <Boxes className="h-6 w-6 text-primary" /> {isRtl ? 'إدخال مخزني' : 'Add Stock'}
                   </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] p-8 max-w-lg" dir={dir}>
                   <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'إضافة مادة للمخزن' : 'Add Item'}</DialogTitle></DialogHeader>
                   <div className="space-y-4 py-4 text-start">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم الصنف' : 'Name'}</Label>
                         <Input value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="h-12 rounded-xl border-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الكمية' : 'Qty'}</Label>
                            <Input type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: Number(e.target.value)})} className="h-12 rounded-xl border-2" />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الوحدة' : 'Unit'}</Label>
                            <Input value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="h-12 rounded-xl border-2" />
                         </div>
                      </div>
                   </div>
                   <DialogFooter>
                      <Button onClick={handleAddItem} disabled={loading} className="w-full h-12 rounded-xl font-bold bg-primary">{isRtl ? 'حفظ الصنف' : 'Save Item'}</Button>
                   </DialogFooter>
                </DialogContent>
             </Dialog>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'أصناف المخزن' : 'Items', val: items?.length || 0, icon: Boxes, color: 'text-primary', bg: 'bg-primary/5' },
           { label: isRtl ? 'عهد قيد الاستخدام' : 'Active Assets', val: assignments?.filter((a: any) => a.status === 'in-use').length || 0, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'تم استرجاعها' : 'Returned', val: assignments?.filter((a: any) => a.status === 'returned').length || 0, icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: isRtl ? 'تنبيهات النقص' : 'Low Stock', val: items?.filter(i => i.quantity < 3).length || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* قائمة الأصناف: تظهر للمدراء فقط أو لمن يملك صلاحية رؤية المستودع الشامل */}
         {viewAccess.scope !== 'own' && (
           <Card className="lg:col-span-2 border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <CardTitle className="text-xl font-black flex items-center gap-2">
                   <Boxes className="h-6 w-6 text-primary" /> {isRtl ? 'رصيد المستودع الحالي' : 'Stock Balance'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                 <table className="w-full text-start text-sm">
                    <thead className="bg-slate-50/50 border-b">
                       <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <th className="p-6 text-start">{isRtl ? 'الصنف' : 'Item'}</th>
                          <th className="p-6 text-center">{isRtl ? 'الرصيد المتاح' : 'Stock Qty'}</th>
                          <th className="p-6 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y">
                       {iLoading ? <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr> : 
                          items?.map(item => (
                             <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-6">
                                   <div className="flex items-center gap-3 font-black text-slate-800">{item.name}</div>
                                </td>
                                <td className="p-6 text-center">
                                   <span className={cn("font-black text-lg", item.quantity < 3 ? "text-rose-600" : "text-slate-900")}>
                                      {item.quantity}
                                   </span>
                                   <span className="text-[10px] ms-1 text-slate-400 font-bold uppercase">{item.unit}</span>
                                </td>
                                <td className="p-6">
                                   <Badge variant="outline" className={cn(
                                     "font-black text-[9px] border-2",
                                     item.quantity < 3 ? "text-rose-500 border-rose-100" : "text-emerald-600 border-emerald-100"
                                   )}>
                                      {item.quantity < 3 ? 'LOW STOCK' : 'AVAILABLE'}
                                   </Badge>
                                </td>
                             </tr>
                          ))
                       }
                    </tbody>
                 </table>
              </CardContent>
           </Card>
         )}

         {/* سجل العهد: مفلتر آلياً للموظف أو شامل للمدير */}
         <Card className={cn("border-0 shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden", viewAccess.scope === 'own' ? "lg:col-span-3" : "lg:col-span-1")}>
            <CardHeader className="bg-white/5 border-b border-white/5 p-8 text-start flex flex-row items-center justify-between">
               <CardTitle className="text-lg font-black flex items-center gap-2">
                 <History className="h-5 w-5 text-primary" /> {viewAccess.scope === 'own' ? (isRtl ? 'عهدي المسجلة' : 'My Registered Assets') : (isRtl ? 'آخر التحركات' : 'Recent Assignments')}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                  {assignments.length === 0 ? (
                    <div className="p-20 text-center text-slate-500 italic font-bold">{isRtl ? 'لا يوجد عهد مسجلة.' : 'No records found.'}</div>
                  ) : assignments.map((log: any) => (
                    <div key={log.id} className="p-6 space-y-4 hover:bg-white/5 transition-all text-start">
                       <div className="flex justify-between items-start">
                          <div className="space-y-1">
                             <p className="text-sm font-black text-white">{log.itemName}</p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <User className="h-2 w-2" /> {log.employeeName}
                             </p>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase",
                            log.status === 'in-use' ? "border-amber-500 text-amber-400" : "border-emerald-500 text-emerald-400"
                          )}>{log.status}</Badge>
                       </div>
                       
                       <div className="flex justify-between items-center pt-2">
                          <span className="text-[9px] font-mono text-slate-600 flex items-center gap-1">
                             <ArrowDownToLine className="h-3 w-3" /> {log.assignedAt?.toDate().toLocaleDateString()}
                          </span>
                          {log.status === 'in-use' && canTransfer && (
                             <Button 
                               size="sm" 
                               onClick={() => handleReturnAsset(log)}
                               disabled={returningId === log.id}
                               className="h-8 rounded-lg bg-primary text-white font-black text-[9px] gap-1.5 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                             >
                                {returningId === log.id ? <Loader2 className="animate-spin h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                                {isRtl ? 'استرجاع للمخزن' : 'Return'}
                             </Button>
                          )}
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
