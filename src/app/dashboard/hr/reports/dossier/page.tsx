'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, Loader2, ArrowRight, 
  ShieldCheck, Briefcase, AlertCircle,
  RefreshCw
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';

export default function DossierSearchPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;

  // تثبيت كائن الاستعلام
  const employeesQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.employees(companyId)));
  }, [db, companyId]);

  const { data: rawEmployees, loading, error } = useCollection<Employee>(employeesQuery);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return rawEmployees
      .filter(emp => 
        emp.fullName?.toLowerCase().includes(term) || 
        emp.employeeNumber?.includes(term) ||
        emp.civilId?.includes(term)
      )
      .sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
  }, [rawEmployees, searchTerm]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto" dir={dir}>
      <div className="text-start">
        <h1 className="text-3xl font-black font-headline flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          {isRtl ? 'ملف الموظف الشامل (Dossier)' : 'Employee Dossier Search'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'ابحث عن الموظف لعرض تاريخه الكامل في المنشأة.' : 'Search for an employee to view their full institutional history.'}
        </p>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
          <div className="relative w-full">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={isRtl ? 'بحث باسم الموظف، الرقم المدني، أو رقم الملف...' : 'Search by name, civil id, or number...'} 
              className="ps-12 rounded-2xl h-16 bg-white text-start border-2 border-slate-100 text-lg font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary/30" />
                <p className="text-xs font-bold text-slate-400 animate-pulse">{isRtl ? 'جاري جلب سجل الموظفين...' : 'Fetching employees...'}</p>
              </div>
            ) : error ? (
              <div className="py-16 text-center space-y-4">
                <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                   <AlertCircle className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                   <h3 className="font-black text-rose-900">{isRtl ? 'حدث خطأ أثناء جلب البيانات' : 'Error Fetching Data'}</h3>
                   <p className="text-xs text-rose-600 font-bold">{(error as any).message}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="rounded-xl h-10 px-6 gap-2">
                   <RefreshCw className="h-4 w-4" /> {isRtl ? 'إعادة المحاولة' : 'Retry'}
                </Button>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-20 text-center text-slate-400 font-bold italic">
                {searchTerm ? (isRtl ? 'لا توجد نتائج مطابقة لبحثك.' : 'No matching results.') : (isRtl ? 'لا يوجد موظفين مسجلين حالياً.' : 'No employees registered.')}
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <div 
                  key={emp.id} 
                  onClick={() => router.push(`/dashboard/hr/reports/dossier/${emp.id}`)}
                  className="p-6 rounded-2xl bg-white border-2 border-slate-50 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group"
                >
                   <div className="flex items-center gap-6">
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                        {emp.employeeNumber}
                      </div>
                      <div className="text-start">
                         <h3 className="font-black text-lg text-slate-900">{emp.fullName}</h3>
                         <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                               <Briefcase className="h-3 w-3 text-primary" /> {emp.jobTitle}
                            </span>
                            <span className="text-[10px] font-black uppercase text-slate-400">{emp.departmentName}</span>
                         </div>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                      <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
                   </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
