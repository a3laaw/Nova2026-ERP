
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Search, Loader2, ArrowRight, Filter, 
  UserPlus, Mail, Phone, ExternalLink, Briefcase,
  CheckCircle2, XCircle, Clock, Trash2, Copy
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { RecruitmentService, ApplicationStatus } from '@/services/recruitment-service';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function RecruitmentManagerPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const appsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.applications(companyId))) : null, 
  [db, companyId]);

  const { data: rawApps, loading } = useCollection<any>(appsQuery);

  const applications = useMemo(() => {
    return [...rawApps].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
  }, [rawApps]);

  const filtered = useMemo(() => {
    return applications.filter(app => {
      const matchSearch = app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          app.position?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "all" || app.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [applications, searchTerm, filterStatus]);

  const handleUpdateStatus = async (id: string, status: ApplicationStatus) => {
    if (!db || !companyId) return;
    try {
      const service = new RecruitmentService(db, companyId);
      await service.updateStatus(id, status);
      toast({ title: "تم تحديث الحالة" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  const copyApplyLink = () => {
    const url = `${window.location.origin}/apply/${companyId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط", description: "يمكنك الآن نشره للمتقدمين." });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <UserPlus className="h-10 w-10 text-primary" />
            إدارة التوظيف والمواهب
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            استقبل طلبات التوظيف وقم بتصفيتها واختيار أفضل الكفاءات.
          </p>
        </div>

        <Button 
          onClick={copyApplyLink}
          className="bg-slate-900 text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl hover:scale-105 transition-all gap-3"
        >
          <Copy className="h-6 w-6 text-primary" />
          نسخ رابط التقديم العام
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: 'إجمالي الطلبات', val: applications.length, color: 'text-slate-900' },
           { label: 'طلبات جديدة', val: applications.filter(a => a.status === 'new').length, color: 'text-blue-600' },
           { label: 'قيد المراجعة', val: applications.filter(a => a.status === 'reviewing' || a.status === 'interview').length, color: 'text-amber-600' },
           { label: 'تم تعيينهم', val: applications.filter(a => a.status === 'hired').length, color: 'text-emerald-600' },
         ].map((s, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <h3 className={cn("text-4xl font-black font-headline", s.color)}>{s.val}</h3>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="بحث باسم المتقدم أو الوظيفة..." 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-2">
              {['all', 'new', 'reviewing', 'interview', 'rejected', 'hired'].map((s) => (
                <Button 
                  key={s}
                  variant={filterStatus === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(s)}
                  className="rounded-xl font-black text-[10px] uppercase h-10 px-4"
                >
                  {s}
                </Button>
              ))}
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">المتقدم / الوظيفة</TableHead>
                <TableHead className="text-center">الخبرة</TableHead>
                <TableHead className="text-start">الاتصال</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="pe-8 text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-400 font-bold italic">لا توجد طلبات مطابقة للبحث.</TableCell></TableRow>
              ) : (
                filtered.map((app) => (
                  <TableRow key={app.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-lg">{app.fullName}</span>
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase">
                             <Briefcase className="h-2.5 w-2.5" /> {app.position}
                          </span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="secondary" className="bg-slate-100 font-black px-3">{app.experienceYears} سنة</Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" /> {app.mobile}</span>
                          <span className="text-[10px] font-mono text-slate-400">{app.email}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                         app.status === 'new' ? 'bg-blue-500 text-white' :
                         app.status === 'interview' ? 'bg-amber-500 text-white' :
                         app.status === 'hired' ? 'bg-emerald-500 text-white' :
                         app.status === 'rejected' ? 'bg-rose-500 text-white' : 'bg-slate-400 text-white'
                       )}>
                          {app.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateStatus(app.id, 'interview')} className="text-amber-600 hover:bg-amber-50 rounded-xl" title="جدولة مقابلة"><Clock className="h-5 w-5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateStatus(app.id, 'hired')} className="text-emerald-600 hover:bg-emerald-50 rounded-xl" title="قبول وتعيين"><CheckCircle2 className="h-5 w-5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateStatus(app.id, 'rejected')} className="text-rose-600 hover:bg-rose-50 rounded-xl" title="رفض"><XCircle className="h-5 w-5" /></Button>
                       </div>
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
