'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Plus, Trash2, Loader2, Save, ShoppingCart, 
  Truck, Boxes, Calculator, DollarSign,
  ArrowRight, CheckCircle2
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { ProcurementService } from '@/services/procurement-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';

export default function NewPurchaseOrderPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [items, setItems] = useState<any[]>([{ itemName: '', quantity: 1, unitPrice: 0, unit: 'pcs' }]);

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  const inventoryQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.inventoryItems(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: suppliers } = useCollection<any>(suppliersQuery);
  const { data: inventory } = useCollection<any>(inventoryQuery);

  const addItem = () => setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, unit: 'pcs' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    const newItems = [...items];
    newItems[idx][field] = val;
    setItems(newItems);
  };

  const totalAmount = useMemo(() => items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0), [items]);

  const handleSave = async () => {
    if (!db || !companyId || !user || !formData.supplierId) return;
    setLoading(true);
    try {
      const selectedSupplier = suppliers?.find(s => s.id === formData.supplierId);
      const service = new ProcurementService(db, companyId, permissions);
      
      const finalItems = items.map(item => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice
      }));

      const poId = await service.createPurchaseOrder({
        ...formData,
        supplierName: selectedSupplier?.name || '',
        totalAmount,
        currency: 'KWD'
      }, finalItems, user.uid);

      toast({ title: isRtl ? "تم إنشاء أمر الشراء بنجاح" : "Purchase Order Created" });
      router.push(`/dashboard/procurement/orders/${poId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'إصدار أمر شراء (PO)' : 'Create Purchase Order'}</h1>
              <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Supply Chain Execution</p>
           </div>
        </div>
        <Button onClick={handleSave} disabled={loading || !formData.supplierId} className="h-14 px-12 rounded-[1.5rem] bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3 border-b-8 border-orange-700">
           {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
           {isRtl ? 'اعتماد وحفظ الأمر' : 'Confirm Order'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         <div className="lg:col-span-1 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-8">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                     <Truck className="h-5 w-5 text-primary" />
                     {isRtl ? 'بيانات المورد والوقت' : 'Supplier & Timing'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المورد المعتمد' : 'Supplier'}</Label>
                     <Select value={formData.supplierId} onValueChange={v => setFormData({...formData, supplierId: v})}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {suppliers?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ الأمر' : 'PO Date'}</Label>
                     <SmartDateInput value={formData.date} onChange={v => setFormData({...formData, date: v})} />
                  </div>
               </CardContent>
            </Card>

            <div className="p-10 bg-emerald-50/50 rounded-[2.5rem] border-2 border-emerald-100 text-center relative overflow-hidden shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5"><DollarSign className="h-40 w-40" /></div>
               <div className="relative z-10 space-y-1">
                  <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">{isRtl ? 'إجمالي قيمة الطلب' : 'Total Order Value'}</p>
                  <h3 className="text-4xl font-black text-emerald-700 font-headline">{totalAmount.toLocaleString()} <span className="text-xs">KWD</span></h3>
               </div>
            </div>
         </div>

         <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center px-4">
               <h3 className="text-xl font-black font-headline flex items-center gap-3"><Boxes className="h-6 w-6 text-primary" /> {isRtl ? 'بنود التوريد' : 'Order Line Items'}</h3>
               <Button onClick={addItem} variant="outline" size="sm" className="rounded-xl h-10 px-4 font-black border-2 gap-2"><Plus className="h-4 w-4" /> {isRtl ? 'إضافة صنف' : 'Add Item'}</Button>
            </div>

            <div className="space-y-4">
               {items.map((item, idx) => (
                 <Card key={idx} className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all">
                    <CardContent className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                       <div className="md:col-span-1 flex justify-center"><Badge className="h-10 w-10 rounded-xl bg-slate-900 text-white font-black">#{idx + 1}</Badge></div>
                       <div className="md:col-span-4 space-y-1">
                          <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'الصنف / المادة' : 'Item Name'}</Label>
                          <Select 
                            onValueChange={v => {
                               const inv = inventory?.find(i => i.id === v);
                               updateItem(idx, 'itemName', inv?.name || '');
                               updateItem(idx, 'itemId', v);
                               updateItem(idx, 'unit', inv?.unit || 'pcs');
                            }}
                          >
                             <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {inventory?.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold">{i.name}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="md:col-span-2 space-y-1">
                          <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'الكمية' : 'Qty'}</Label>
                          <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="h-11 border-2 font-black text-center rounded-xl" />
                       </div>
                       <div className="md:col-span-2 space-y-1">
                          <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'سعر الوحدة' : 'Price'}</Label>
                          <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="h-11 border-2 font-black text-center rounded-xl text-emerald-600" />
                       </div>
                       <div className="md:col-span-2 text-end">
                          <p className="text-[8px] font-black text-slate-300 uppercase mb-1">{isRtl ? 'المجموع' : 'Subtotal'}</p>
                          <p className="font-mono font-black text-slate-800">{(item.quantity * item.unitPrice).toLocaleString()}</p>
                       </div>
                       <div className="md:col-span-1 flex justify-end">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-5 w-5" /></Button>
                       </div>
                    </CardContent>
                 </Card>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
