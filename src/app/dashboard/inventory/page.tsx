
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, Boxes, Truck, Plus, 
  Search, Loader2, Warehouse as WarehouseIcon,
  LayoutGrid, AlertTriangle, ArrowRight, ArrowUpRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { InventoryService } from '@/services/inventory-service';
import { toast } from '@/hooks/use-toast';

export default function InventoryDashboard() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });
  const [loading, setLoading] = useState(false);

  const warehousesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.warehouses(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const itemsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.inventoryItems(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: warehouses, loading: wLoading } = useCollection(warehousesQuery);
  const { data: items, loading: iLoading } = useCollection(itemsQuery);

  const handleAddWarehouse = async () => {
    if (!db || !companyId || !warehouseForm.name) return;
    setLoading(true);
    try {
      const service = new InventoryService(db, companyId);
      await service.addWarehouse(warehouseForm);
      toast({ title: t('saved') });
      setWarehouseForm({ name: '', location: '' });
      setIsAddWarehouseOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-2">
           <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Package className="h-10 w-10 text-primary" />
             {isRtl ? 'المخازن والمستودعات' : 'Inventory & Warehouses'}
           </h1>
           <p className="text-muted-foreground font-bold text-sm opacity-80 italic">
             {isRtl ? 'إدارة الأصول المخزنية، المواد الخام، وتوزيع العهد.' : 'Manage inventory assets, raw materials, and field assignments.'}
           </p>
        </div>

        <div className="flex gap-4">
           <Dialog open={isAddWarehouseOpen} onOpenChange={setIsAddWarehouseOpen}>
              <DialogTrigger asChild>
                 <Button className="h-16 px-8 rounded-2xl bg-white border-2 text-slate-800 font-black gap-2 hover:bg-slate-50 transition-all">
                    <WarehouseIcon className="h-5 w-5 text-primary" /> {isRtl ? 'مستودع جديد' : 'New Warehouse'}
                 </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2.5rem] p-8 max-w-lg" dir={dir}>
                 <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'إضافة مستودع' : 'Add Warehouse'}</DialogTitle></DialogHeader>
                 <div className="space-y-6 py-4 text-start">
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{isRtl ? 'اسم المستودع' : 'Warehouse Name'}</Label>
                       <Input value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{isRtl ? 'الموقع' : 'Location'}</Label>
                       <Input value={warehouseForm.location} onChange={e => setWarehouseForm({...warehouseForm, location: e.target.value})} className="h-12 rounded-xl" />
                    </div>
                 </div>
                 <DialogFooter>
                    <Button onClick={handleAddWarehouse} disabled={loading} className="w-full h-12 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin" /> : t('save')}</Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>
           <Button 
             className="h-16 px-10 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3"
           >
              <Boxes className="h-6 w-6" /> {isRtl ? 'إضافة صنف' : 'Add Item'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي المستودعات' : 'Total Warehouses', val: warehouses?.length || 0, icon: WarehouseIcon, color: 'text-primary', bg: 'bg-primary/5' },
           { label: isRtl ? 'أصناف مخزنية' : 'Inventory Items', val: items?.length || 0, icon: Boxes, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'عهد ميدانية' : 'Field Assets', val: '142', icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: isRtl ? 'تنبيهات نقص' : 'Low Stock', val: '3', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
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
                  <CardTitle className="text-xl font-black">{isRtl ? 'المستودعات النشطة' : 'Active Warehouses'}</CardTitle>
                  <CardDescription className="font-bold">{isRtl ? 'قائمة المواقع التخزينية المعتمدة.' : 'List of approved storage locations.'}</CardDescription>
               </div>
               <div className="relative w-full max-w-[200px]">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder={t('search')} className="ps-9 rounded-xl h-10 bg-white" />
               </div>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
               {wLoading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div> : (
                 warehouses?.map((w) => (
                    <div key={w.id} className="p-6 rounded-3xl bg-slate-50 border-2 border-white hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group flex items-center justify-between shadow-sm">
                       <div className="text-start space-y-1">
                          <h4 className="font-black text-slate-900">{w.name}</h4>
                          <p className="text-xs text-slate-400 font-bold">{w.location}</p>
                       </div>
                       <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                       </div>
                    </div>
                 ))
               )}
            </CardContent>
         </Card>

         <Card className="border-0 shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden group">
            <CardHeader className="bg-white/5 border-b border-white/5 p-8 text-start">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center">
                     <Truck className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-black">{isRtl ? 'العهد الميدانية' : 'Field Assets'}</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6 text-start">
               <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <p className="text-xs font-bold text-slate-400">{isRtl ? 'صرف معدات للمهندسين والمواقع' : 'Assign equipment to field staff.'}</p>
                  <Button className="w-full bg-white text-slate-900 font-black h-12 rounded-xl hover:scale-105 transition-all">
                     {isRtl ? 'بدء عملية صرف عهدة' : 'New Assignment'}
                  </Button>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'نظرة سريعة' : 'Quick Glance'}</h4>
                  <div className="divide-y divide-white/5">
                     {[
                       { label: 'Laptop - Dell XPS', emp: 'Ahmad M.', status: 'in-use' },
                       { label: 'Site Helmet v2', emp: 'Sami K.', status: 'in-use' }
                     ].map((item, i) => (
                       <div key={i} className="py-3 flex justify-between items-center">
                          <div className="text-start">
                             <p className="text-sm font-bold">{item.label}</p>
                             <p className="text-[10px] text-slate-500">{item.emp}</p>
                          </div>
                          <Badge variant="outline" className="text-[8px] border-white/10 text-slate-400">{item.status}</Badge>
                       </div>
                     ))}
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
