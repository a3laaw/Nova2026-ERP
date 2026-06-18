
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink, ShieldAlert, Sparkles, Ban, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function DeveloperDashboard() {
  const { t, lang } = useLanguage();
  const db = useFirestore();
  
  // جلب الطلبات
  const requestsQuery = db ? query(collection(db, 'company_requests'), orderBy('createdAt', 'desc')) : null;
  const { data: requests, loading: requestsLoading } = useCollection(requestsQuery);

  // جلب الشركات النشطة للإدارة
  const companiesQuery = db ? query(collection(db, 'companies'), orderBy('createdAt', 'desc')) : null;
  const { data: companies, loading: companiesLoading } = useCollection(companiesQuery);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleToggleCompanyStatus = async (companyId: string, currentStatus: string) => {
    if (!db) return;
    setProcessingId(companyId);
    
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const companyRef = doc(db, 'companies', companyId);

    try {
      await updateDoc(companyRef, {
        status: newStatus,
        suspendedAt: newStatus === 'suspended' ? newTimestamp() : null
      });
      toast({
        title: lang === 'ar' ? "تم تحديث الحالة" : "Status Updated",
        description: lang === 'ar' ? `المنشأة الآن ${newStatus === 'active' ? 'نشطة' : 'موقوفة'}` : `Tenant is now ${newStatus}`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update status" });
    } finally {
      setProcessingId(null);
    }
  };

  const isRtl = lang === 'ar';

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex justify-between items-end">
        <div className={isRtl ? "text-right" : "text-left"}>
          <h2 className="text-3xl font-black font-headline text-slate-900">{t('devConsole')}</h2>
          <p className="text-slate-500">إدارة دورة حياة المنشآت والاشتراكات السحابية.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-0 rounded-3xl p-6 shadow-xl">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">إجمالي المنشآت</h4>
          <p className="text-4xl font-black font-headline">{companies?.length || 0}</p>
          <div className={cn("mt-4 flex items-center gap-1 text-emerald-400 text-xs font-bold", isRtl ? "flex-row-reverse" : "flex-row")}>
            <CheckCircle className="h-3 w-3" /> {companies?.filter(c => c.status === 'active').length} نشطة
          </div>
        </Card>
        
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">موقوفة حالياً</h4>
          <p className="text-4xl font-black font-headline text-destructive">
            {companies?.filter(c => c.status === 'suspended').length || 0}
          </p>
          <div className={cn("mt-4 flex items-center gap-1 text-rose-500 text-xs font-bold", isRtl ? "flex-row-reverse" : "flex-row")}>
            <ShieldAlert className="h-3 w-3" /> سياسة الحذف (3 أشهر)
          </div>
        </Card>

        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">طلبات جديدة</h4>
          <p className="text-4xl font-black font-headline text-slate-900">
            {requests?.filter((r: any) => r.status === 'pending').length || 0}
          </p>
          <div className={cn("mt-4 flex items-center gap-1 text-blue-500 text-xs font-bold", isRtl ? "flex-row-reverse" : "flex-row")}>
            <Clock className="h-3 w-3" /> بانتظار المراجعة
          </div>
        </Card>

        <Card className="bg-primary text-white border-0 shadow-xl rounded-3xl p-6">
          <h4 className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest mb-2">الحذف التلقائي</h4>
          <p className="text-xs mt-2 opacity-90 leading-relaxed">
            المنشآت الموقوفة تُحذف بياناتها تماماً بعد 90 يوماً من تاريخ الإيقاف لتقليل تكاليف التخزين.
          </p>
        </Card>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="companies" className="rounded-lg font-bold">إدارة المنشآت (Tenants)</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg font-bold">سجل الطلبات</TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className={isRtl ? "text-right" : "text-left"}>اسم المنشأة</TableHead>
                    <TableHead className={isRtl ? "text-right" : "text-left"}>النشاط</TableHead>
                    <TableHead className={isRtl ? "text-right" : "text-left"}>نهاية التجربة</TableHead>
                    <TableHead className={isRtl ? "text-right" : "text-left"}>الحالة</TableHead>
                    <TableHead className={isRtl ? "text-left" : "text-right"}>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : (
                    companies?.map((comp: any) => (
                      <TableRow key={comp.id}>
                        <TableCell className="font-bold">{comp.name}</TableCell>
                        <TableCell>{comp.activity}</TableCell>
                        <TableCell className="font-mono text-xs">{comp.trialEndsAt?.split('T')[0]}</TableCell>
                        <TableCell>
                          <Badge className={comp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>
                            {comp.status === 'active' ? 'نشط' : 'موقوف'}
                          </Badge>
                        </TableCell>
                        <TableCell className={isRtl ? "text-left" : "text-right"}>
                          <Button 
                            size="sm" 
                            variant={comp.status === 'active' ? 'destructive' : 'default'}
                            onClick={() => handleToggleCompanyStatus(comp.id, comp.status)}
                            disabled={processingId === comp.id}
                            className="rounded-xl font-bold"
                          >
                            {comp.status === 'active' ? <Ban className="h-4 w-4 ml-1" /> : <RefreshCcw className="h-4 w-4 ml-1" />}
                            {comp.status === 'active' ? 'إيقاف' : 'تنشيط'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          {/* محتوى سجل الطلبات القديم يمكن وضعه هنا */}
          <Card className="border-0 shadow-2xl rounded-3xl p-10 text-center text-muted-foreground">
            تاريخ طلبات الانضمام يظهر هنا للأرشفة.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function newTimestamp() {
  return new Date().toISOString();
}
