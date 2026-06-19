
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CalendarDays, Plus, Loader2, Search, 
  Filter, ArrowRight, CheckCircle2, XCircle,
  Clock, Plane, AlertCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { LeaveRequest } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function LeaveRequestsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;
  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: leaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  const filteredLeaves = leaves?.filter(l => 
    l.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.type?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Plane className="h-10 w-10 text-primary" />
            {isRtl ? 'طلبات الإجازات' : 'Leave Requests'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة الغيابات، الأرصدة، والامتثال لقانون العمل' : 'Manage absences, balances, and labor law compliance'}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/leaves/new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-6 w-6" />
          {isRtl ? 'طلب إجازة جديد' : 'New Request'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={isRtl ? 'بحث باسم الموظف أو نوع الإجازة...' : 'Search by name or type...'} 
              className="ps-12 rounded-2xl h-14 bg-white text-start border-2 border-slate-100" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'النوع' : 'Type'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الفترة' : 'Period'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'أيام العمل' : 'Work Days'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-center pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredLeaves.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground font-bold italic">{isRtl ? 'لا توجد طلبات مسجلة.' : 'No requests found.'}</TableCell></TableRow>
              ) : (
                filteredLeaves.map((leave) => (
                  <TableRow 
                    key={leave.id} 
                    className="hover:bg-primary/5 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/hr/leaves/${leave.id}`)}
                  >
                    <TableCell className="py-6 ps-8 text-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                           <CalendarDays className="h-5 w-5" />
                        </div>
                        <span className="font-black text-slate-800">{leave.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="font-black border-2 px-3 uppercase text-[10px]">
                          {leave.type}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                          <span>{leave.startDate}</span>
                          <ArrowRight className={cn("h-3 w-3 opacity-30", isRtl && "rotate-180")} />
                          <span>{leave.endDate}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">{leave.workingDays}</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1 rounded-lg border-0 shadow-sm",
                         leave.status === 'approved' ? 'bg-emerald-500 text-white' : 
                         leave.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                         'bg-rose-500 text-white'
                       )}>
                          {leave.status.toUpperCase()}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center pe-8">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white">
                          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-0", isRtl && "rotate-180")} />
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
