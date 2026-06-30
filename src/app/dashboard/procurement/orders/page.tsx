
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShoppingCart, Plus, Search, Loader2, ArrowRight,
  Filter, Calendar, FileText, Truck, DollarSign
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { PurchaseOrder } from '@/types/procurement';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function PurchaseOrdersPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");

  const ordersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.purchaseOrders(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: orders, loading } = useCollection<PurchaseOrder>(ordersQuery);

  const filtered = (orders || []).filter(po => 
    po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    po.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <ShoppingCart className="h-10 w-10 text-primary" />
            {isRtl ? 'أوامر الشراء (POs)' : 'Purchase Orders'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'تتبع طلبات التوريد، الاعتمادات، وحالة الاستلام الميداني.' : 'Track supply orders, approvals, and field delivery status.'}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/procurement/orders/new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-6 w-6" />
          {isRtl ? 'أمر شراء جديد' : 'New Order'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={isRtl ? 'بحث برقم الأمر أو المورد...' : 'Search by PO number or supplier...'} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'رقم الأمر / المورد' : 'PO # / Supplier'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'الإجمالي' : 'Amount'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد أوامر شراء.' : 'No purchase orders found.'}</TableCell></TableRow>
              ) : (
                filtered.map((po) => (
                  <TableRow key={po.id} className="hover:bg-slate-50 transition-colors border-b-slate-50 cursor-pointer" onClick={() => router.push(`/dashboard/procurement/orders/${po.id}`)}>
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black">
                             <FileText className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <p className="font-black text-slate-800">{po.poNumber}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Truck className="h-2.5 w-2.5" /> {po.supplierName}</p>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col text-start">
                          <span className="text-xs font-bold text-slate-600">{po.date}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-emerald-600">
                       {po.totalAmount?.toLocaleString()} <span className="text-[9px] text-slate-400">KWD</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                         po.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                         po.status === 'ordered' ? 'bg-blue-50 text-blue-600' :
                         'bg-amber-50 text-amber-600'
                       )}>
                          {po.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10">
                          <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
