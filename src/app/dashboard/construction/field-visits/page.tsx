'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  HardHat, Plus, Search, Loader2, ArrowRight,
  Filter, Hammer, Calendar, MapPin, Camera
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collectionGroup, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { FieldVisit } from '@/types/field-visit';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function FieldVisitsListPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // استعلام شامل لكافة الزيارات الميدانية في المنشأة (Collection Group)
  const visitsQuery = useMemo(() => 
    companyId && db ? query(collectionGroup(db, 'fieldVisits'), where('companyId', '==', companyId), orderBy('visitDate', 'desc')) : null, 
  [db, companyId]);

  const { data: visits, loading } = useCollection<FieldVisit>(visitsQuery);

  const filtered = visits.filter(v => 
    v.engineerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.completedWork?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <HardHat className="h-8 w-8 text-primary" />
             {isRtl ? 'سجل الزيارات الميدانية' : 'Field Visits Log'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? 'تتبع الإنجاز الميداني، صور المواقع، وتقارير القوى العاملة.' : 'Track field progress, site photos, and labor reports.'}
           </p>
        </div>
        <Button onClick={() => router.push('/dashboard/construction/field-visits/new')} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2">
          <Plus className="h-5 w-5" /> {isRtl ? 'تقرير زيارة جديد' : 'New Site Report'}
        </Button>
      </div>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث...' : 'Search...'} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-slate-200">
             <Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400 font-bold italic">{isRtl ? 'لا يوجد تقارير زيارات.' : 'No site reports found.'}</div>
        ) : (
          filtered.map((visit) => (
            <Card key={visit.id} className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden group hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer" onClick={() => router.push(`/dashboard/construction/field-visits/${visit.id}`)}>
               <CardHeader className="bg-slate-50/50 p-6 border-b flex flex-row justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="h-9 w-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary border border-primary/10">
                        <Calendar className="h-4 w-4" />
                     </div>
                     <span className="font-black text-xs text-slate-600">{visit.visitDate}</span>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0 font-black text-[9px] uppercase">
                    {visit.status}
                  </Badge>
               </CardHeader>
               <CardContent className="p-6 space-y-4 text-start">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المهندس المنفذ' : 'Site Engineer'}</p>
                     <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                        <Hammer className="h-3.5 w-3.5 text-primary" /> {visit.engineerName}
                     </h4>
                  </div>
                  
                  <div className="space-y-1.5">
                     <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                        <span>{isRtl ? 'نسبة الإنجاز المبلغ عنها' : 'Progress'}</span>
                        <span className="text-primary">{visit.progressPercentage}%</span>
                     </div>
                     <Progress value={visit.progressPercentage} className="h-1.5" />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                     <div className="flex -space-x-2">
                        {(visit.photoUrls || []).slice(0, 3).map((url, i) => (
                          <div key={i} className="h-7 w-7 rounded-lg border-2 border-white bg-slate-100 overflow-hidden shadow-sm">
                             <img src={url} alt="Site" className="h-full w-full object-cover" />
                          </div>
                        ))}
                        {(visit.photoUrls?.length || 0) > 3 && (
                           <div className="h-7 w-7 rounded-lg border-2 border-white bg-slate-900 text-white flex items-center justify-center text-[8px] font-black">
                              +{(visit.photoUrls?.length || 0) - 3}
                           </div>
                        )}
                     </div>
                     <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <Camera className="h-3 w-3" />
                        {visit.photoUrls?.length || 0}
                     </div>
                  </div>
               </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
