'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowRight, CheckCircle2, Link as LinkIcon,
  FileSpreadsheet, AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { ProcurementService } from '@/services/procurement-service';
import { BOQ, BOQItem } from '@/types/documents';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';

export default function NewPurchaseOrderPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const preSelectedProjectId = searchParams.get('projectId');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    projectId: preSelectedProjectId || '',
    boqId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  const [items, setItems] = useState<any[]>([{ itemName: '', quantity: 1, unitPrice: '', unit: 'pcs', boqItemId: '' }]);

  const suppliersQuery = useMemo(() => companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, [db, companyId]);
  const inventoryQuery = useMemo(() => companyId && db ? query(collection(db, paths.inventoryItems(companyId)), orderBy('name')) : null, [db, companyId]);
  const boqsQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), orderBy('createdAt', 'desc')) : null, [db, companyId]);

  const { data: suppliers } = useCollection<any>(suppliersQuery);
  const { data: inventory } = useCollection<any>(inventoryQuery);
  const { data: boqs } = useCollection<BOQ>(boqsQuery);

  const [availableBOQItems, setAvailableBOQItems] = useState<BOQItem[]>([]);
  useEffect(() => {
    if (db && companyId && formData.boqId) {
      getDocs(collection(db, paths.boqItems(companyId, formData.boqId)))
        .then(snap => setAvailableBOQItems(snap.docs.map(d => ({id: d.id, ...d.data()} as BOQItem))))
        .catch(() => setAvailableBOQItems([]));
    }
  }, [db, companyId, formData.boqId]);

  const addItem = () => setItems([...items, { itemName: '', quantity: 1, unitPrice: '', unit: 'pcs', boqItemId: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    const newItems = [...items];
    newItems[idx][field] = val;
    setItems(newItems);
  };

  const totalAmount = useMemo(() => items.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0), [items]);

  const handleSave = async () => {
    if (!db || !companyId || !user || !formData.supplierId) return;
    setLoading(true);
    try {
      const selectedSupplier = suppliers?.find(s => s.id === formData.supplierId);
      const service = new ProcurementService(db, companyId, permissions);
      
      const finalItems = items.map(item => ({
        ...item,
        unitPrice: Number(item.unitPrice) || 0,
        boqId: formData.boqId, 
        totalPrice: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
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
           <Button variant="ghost" onClick={() => router.back()} className="h-10 w-10 p-0 rounded-xl bg-white shadow-sm border">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'إصدار أمر شراء ذكي' : 'Create Smart PO'}</h1>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Linked Progress & Procurement</p>
           </div>
        </div>
        <Button onClick={handleSave} disabled={loading || !formData.supplierId} className="h-12 px-10 rounded-xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3">
           {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
           {isRtl ? 'تأكيد وحفظ الطلب' : 'Confirm & Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         <div className="lg:col-span-1 space-y-6">
            <Card className="border-0 shadow-xl rounded-2xl bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-6 text-start">
                  <CardTitle className="text-base font-black flex items-center gap-2">
                     <Truck className="h-5 w-5 text-primary" />
                     {isRtl ? 'بيانات المورد والمقايسة' : 'Supplier & Progress Link'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المورد المعتمد' : 'Verified Supplier'}</Label>
                     <Select value={formData.supplierId} onValueChange={v => setFormData({...formData, supplierId: v})}>
                        <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {suppliers?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{s.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5 pt-4 border-t">
                     <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" /> {isRtl ? 'ربط التكلفة بالمقايسة' : 'Link Cost to BOQ'}
                     </Label>
                     <Select value={formData.boqId} onValueChange={v => setFormData({...formData, boqId: v})}>
                        <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-blue-50/30 border-blue-100">
                           <SelectValue placeholder={isRtl ? "اختر المقايسة..." : "Select BOQ..."} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {boqs?.map(b => <SelectItem key={b.id} value={b.id!} className="font-bold text-xs">{b.boqNumber} - {b.clientName}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ الأمر' : 'Order Date'}</Label>
                     <SmartDateInput value={formData.date} onChange={v => setFormData({...formData, date: v})} />
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center px-4">
               <h3 className="text-lg font-black font-headline flex items-center gap-3"><Boxes className="h-5 w-5 text-primary" /> {isRtl ? 'بنود أمر التوريد' : 'Supply Items'}</h3>
               <Button onClick={addItem} variant="outline" size="sm" className="rounded-lg h-9 px-4 font-black border-2 gap-2"><Plus className="h-3.5 w-3.5" /> {isRtl ? 'إضافة صنف' : 'Add Item'}</Button>
            </div>

            <div className="space-y-4">
               {items.map((item, idx) => (
                 <Card key={idx} className="border-0 shadow-lg rounded-2xl bg-white ring-1 ring-black/5 overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-1 flex justify-center"><Badge className="h-8 w-8 rounded-lg bg-slate-900 text-white font-black">#{idx + 1}</Badge></div>
                          
                          <div className="md:col-span-5 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'الصنف' : 'Item'}</Label>
                             <Select 
                               onValueChange={v => {
                                  const inv = inventory?.find(i => i.id === v);
                                  updateItem(idx, 'itemName', inv?.name || '');
                                  updateItem(idx, 'itemId', v);
                                  updateItem(idx, 'unit', inv?.unit || 'pcs');
                               }}
                             >
                                <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   {inventory?.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold text-xs">{i.name}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>

                          <div className="md:col-span-2 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'الكمية' : 'Qty'}</Label>
                             <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} className="h-10 border-2 font-black text-center rounded-lg" />
                          </div>
                          
                          <div className="md:col-span-3 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'سعر الوحدة' : 'Price'}</Label>
                             <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value === '' ? '' : Number(e.target.value))} className="h-10 border-2 font-black text-center rounded-lg text-emerald-600" />
                          </div>
                          
                          <div className="md:col-span-1 flex justify-end">
                             <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
               ))}
            </div>

            <footer className="bg-[#1e1b4b] text-white p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
               <div className="text-start">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'إجمالي المشتريات' : 'Total Purchase'}</p>
                  <h3 className="text-3xl font-black font-headline">{totalAmount.toLocaleString()} <span className="text-xs opacity-40">KWD</span></h3>
               </div>
               <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                  <Calculator className="h-5 w-5 text-primary" />
                  <p className="text-[10px] font-bold text-slate-300 max-w-[150px]">{isRtl ? 'يتم الترحيل للحسابات عند الاعتماد.' : 'Accounting sync on approval.'}</p>
               </div>
            </footer>
         </div>
      </div>
    </div>
  );
}
