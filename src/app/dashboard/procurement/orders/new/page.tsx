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
  FileSpreadsheet, AlertTriangle, Sparkles
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

      toast({ title: t('common.saved') });
      router.push(`/dashboard/procurement/orders/${poId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500 text-start bg-[#fdfaf3]" dir={dir}>
      <div className="flex items-center justify-between border-b-4 border-primary/20 pb-6 px-4 pt-4">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
              <h1 className="text-2xl font-black font-headline text-slate-900">{t('procurement.issueSmartPo')}</h1>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Linked Progress & Procurement</p>
           </div>
        </div>
        <Button onClick={handleSave} disabled={loading || !formData.supplierId} className="h-12 px-10 rounded-xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3 border-b-4 border-orange-700">
           {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
           {t('common.confirm')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-4">
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-primary/5 border-b p-6 text-start">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg"><Truck className="h-5 w-5" /></div>
                     <CardTitle className="text-base font-black flex items-center gap-2">
                        {t('procurement.supplierLink')}
                     </CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.supplier')}</Label>
                     <Select value={formData.supplierId} onValueChange={v => setFormData({...formData, supplierId: v})}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl">
                           {suppliers?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3">{s.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5 pt-4 border-t">
                     <Label className="text-[10px] font-black uppercase text-secondary tracking-widest flex items-center gap-1.5">
                        <LinkIcon className="h-3.5 w-3.5" /> {t('procurement.linkToBoq')}
                     </Label>
                     <Select value={formData.boqId} onValueChange={v => setFormData({...formData, boqId: v})}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-secondary/5 border-secondary/20">
                           <SelectValue placeholder={t('boq.selectTemplate')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl">
                           {boqs?.map(b => <SelectItem key={b.id} value={b.id!} className="font-bold text-xs py-3">{b.boqNumber} - {b.clientName}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                     <SmartDateInput value={formData.date} onChange={v => setFormData({...formData, date: v})} />
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-center px-4">
               <h3 className="text-lg font-black font-headline flex items-center gap-3 text-slate-800"><Boxes className="h-5 w-5 text-primary" /> {t('procurement.supplyItemsGrid')}</h3>
               <Button onClick={addItem} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black border-2 gap-2 bg-white hover:bg-primary/5 transition-all">
                 <Plus className="h-4 w-4" /> {t('common.add')}
               </Button>
            </div>

            <div className="space-y-4">
               {items.map((item, idx) => (
                 <Card key={idx} className="border-0 shadow-lg rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden border-s-8 border-s-slate-100 hover:border-s-primary transition-all">
                    <CardContent className="p-6 space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                          <div className="md:col-span-1 flex justify-center"><Badge className="h-10 w-10 rounded-xl bg-slate-900 text-white font-black text-lg">#{idx + 1}</Badge></div>
                          
                          <div className="md:col-span-5 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('procurement.warehouseItem')}</Label>
                             <Select 
                               onValueChange={v => {
                                  const inv = inventory?.find(i => i.id === v);
                                  updateItem(idx, 'itemName', inv?.name || '');
                                  updateItem(idx, 'itemId', v);
                                  updateItem(idx, 'unit', inv?.unit || 'pcs');
                               }}
                             >
                                <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent className="rounded-xl border-2 shadow-2xl">
                                   {inventory?.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3">{i.name}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>

                          <div className="md:col-span-2 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('common.quantity')}</Label>
                             <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} className="h-11 border-2 font-black text-center rounded-xl bg-white text-lg" />
                          </div>
                          
                          <div className="md:col-span-3 space-y-1 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('projects.boqExplorer.rate')}</Label>
                             <div className="relative">
                                <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value === '' ? '' : Number(e.target.value))} className="h-11 border-2 font-black text-center rounded-xl text-emerald-600 bg-white text-lg" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-300">KWD</span>
                             </div>
                          </div>
                          
                          <div className="md:col-span-1 flex justify-end">
                             <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-5 w-5" /></Button>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
               ))}
            </div>

            <footer className="bg-slate-900 text-white p-10 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden ring-4 ring-white">
               <div className="absolute top-0 right-0 p-10 opacity-5"><Sparkles className="h-40 w-40 text-primary" /></div>
               <div className="text-start relative z-10">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{t('common.total')}</p>
                  <h3 className="text-5xl font-black font-headline text-emerald-400">{totalAmount.toLocaleString()} <span className="text-sm font-bold opacity-40">KWD</span></h3>
               </div>
               <div className="flex items-center gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 relative z-10">
                  <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-xl"><Calculator className="h-6 w-6" /></div>
                  <p className="text-[10px] font-bold text-slate-400 max-w-[200px] leading-relaxed italic">{t('procurement.postedToLedgerHint')}</p>
               </div>
            </footer>
         </div>
      </div>
    </div>
  );
}
