'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, 
  Filter, ArrowRight
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function EquipmentMasterPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");

  const equipQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const { data: equipment, loading } = useCollection<Equipment>(equipQuery);

  const filtered = useMemo(() => {
    return (equipment || []).filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.code.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.code.localeCompare(b.code));
  }, [equipment, searchTerm]);

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {t('equipment.title')}
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            {t('equipment.description')}
          </p>
        </div>
        <Button 
          size="sm"
          onClick={() => router.push('/dashboard/equipment/new')} 
          className="h-9 px-4 font-bold rounded-md shadow-sm"
        >
           <Plus className="h-4 w-4 me-2" /> {t('equipment.addNew')}
        </Button>
      </header>

      <Card className="rounded-lg shadow-sm border border-slate-100 overflow-hidden bg-white">
        <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t('common.search')} 
              className="ps-9 h-9 border-slate-200 bg-white text-sm font-medium rounded-md" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 px-3 rounded-md font-bold text-xs border-slate-200">
             <Filter className="h-3.5 w-3.5 me-2" /> {t('common.filter')}
          </Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="py-3 ps-6 text-start text-[10px] font-bold uppercase text-slate-500">{t('equipment.table.code')}</TableHead>
                <TableHead className="text-start text-[10px] font-bold uppercase text-slate-500">{t('equipment.table.ownership')}</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">{t('common.status')}</TableHead>
                <TableHead className="text-end text-[10px] font-bold uppercase text-slate-500">{t('equipment.table.rate')}</TableHead>
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-bold italic">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-slate-50/50 transition-colors border-b-slate-100 cursor-pointer" onClick={() => router.push(`/dashboard/equipment/${item.id}/edit`)}>
                    <TableCell className="ps-6 py-2.5 text-start">
                       <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-8 w-8 rounded-md flex items-center justify-center border shadow-sm shrink-0",
                            item.ownershipType === 'owned' ? "bg-primary/5 text-primary" : "bg-blue-50 text-blue-600"
                          )}>
                             <Truck className="h-3.5 w-3.5" />
                          </div>
                          <div className="text-start">
                             <span className="font-bold text-slate-800 text-sm block leading-none">{item.name}</span>
                             <span className="text-[9px] text-slate-400 font-mono mt-1 block">#{item.code}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className={cn(
                         "text-[9px] font-bold uppercase px-2 h-5 border-0 rounded-md",
                         item.ownershipType === 'owned' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                       )}>
                          {item.ownershipType}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", item.status === 'available' ? "bg-emerald-500" : "bg-rose-500")} />
                          <span className="text-[10px] font-bold uppercase text-slate-600">{item.status}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-end font-mono font-bold text-xs text-emerald-600">
                       {(item.hourlyRentalRate || item.hourlyDepreciationRate || 0).toLocaleString()} <span className="text-[8px] opacity-40">{t('dashboard.units.kwd')}</span>
                    </TableCell>
                    <TableCell className="pe-6 text-end">
                       <Button variant="ghost" size="icon" className="rounded-md group-hover:text-primary transition-all h-8 w-8">
                          <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
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
