
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { 
  Loader2, CheckCircle, ShieldAlert, Ban, RefreshCcw, 
  FileSpreadsheet, Edit3, Save, Users, Zap, HardHat, PencilRuler
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DeveloperDashboard() {
  const { t, lang } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const companiesQuery = db ? query(collection(db, 'companies'), orderBy('createdAt', 'desc')) : null;
  const { data: companies, loading: companiesLoading } = useCollection<any>(companiesQuery);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);

  const getActivityLabel = (code: string) => {
    const map: Record<string, string> = {
      'construction': isRtl ? 'مقاولات وإنشاءات' : 'Construction',
      'consulting': isRtl ? 'استشارات هندسية' : 'Consulting',
      'design_build': isRtl ? 'تصميم وإنشاء (D&B)' : 'Design & Build',
      'general': isRtl ? 'تجارة عامة' : 'General Trading'
    };
    return map[code] || code;
  };

  const exportToExcel = () => {
    if (!companies || companies.length === 0) return;

    const headers = ["Company Name", "Status", "Activity", "Max Users", "Trial Ends At", "Created At"];
    const rows = companies.map(c => [
      c.name,
      c.status,
      getActivityLabel(c.activity),
      c.maxUsers || 5,
      c.trialEndsAt ? c.trialEndsAt.split('T')[0] : 'N/A',
      c.createdAt?.toDate().toLocaleDateString() || 'N/A'
    ]);

    let csvContent = "\uFEFF"; 
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `NovaFlow_Tenants_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: isRtl ? "تم التصدير" : "Report Exported",
      description: isRtl ? "تم تحميل تقرير المنشآت بنجاح." : "Tenants report downloaded successfully.",
    });
  };

  const handleUpdateCompany = async () => {
    if (!db || !editingCompany) return;
    setProcessingId(editingCompany.id);
    
    const companyRef = doc(db, 'companies', editingCompany.id);

    try {
      await updateDoc(companyRef, {
        name: editingCompany.name,
        maxUsers: editingCompany.maxUsers ? Number(editingCompany.maxUsers) : 5,
        trialEndsAt: editingCompany.trialEndsAt,
        activity: editingCompany.activity
      });
      toast({
        title: isRtl ? "تم التحديث" : "Updated",
        description: isRtl ? "تم حفظ التعديلات بنجاح." : "Changes saved successfully.",
      });
      setEditingCompany(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleStatus = async (companyId: string, currentStatus: string) => {
    if (!db) return;
    setProcessingId(companyId);
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        status: newStatus,
        suspendedAt: newStatus === 'suspended' ? new Date().toISOString() : null
      });
      toast({
        title: isRtl ? "تحديث الحالة" : "Status Updated",
        description: isRtl ? `تم ${newStatus === 'active' ? 'تنشيط' : 'إيقاف'} الشركة.` : `Company has been ${newStatus}.`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="text-start">
          <h2 className="text-3xl font-black font-headline text-slate-900">{t('devConsole')}</h2>
          <p className="text-slate-50">إدارة دورة حياة المنشآت والاشتراكات السحابية.</p>
        </div>
        <Button 
          onClick={exportToExcel} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg"
        >
          <FileSpreadsheet className="ml-2 h-5 w-5" />
          تصدير تقرير الشركات (Excel)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-0 rounded-3xl p-6 shadow-xl">
          <div className="text-start">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">إجمالي المنشآت</h4>
            <p className="text-4xl font-black font-headline">{companies?.length || 0}</p>
            <div className="mt-4 flex items-center gap-1 text-emerald-400 text-xs font-bold">
              <CheckCircle className="h-3 w-3" /> {companies?.filter(c => c.status === 'active').length} نشطة
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <div className="text-start">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">موقوفة حالياً</h4>
            <p className="text-4xl font-black font-headline text-destructive">
              {companies?.filter(c => c.status === 'suspended').length || 0}
            </p>
            <div className="mt-4 flex items-center gap-1 text-rose-500 text-xs font-bold">
              <ShieldAlert className="h-3 w-3" /> سياسة الحذف (3 أشهر)
            </div>
          </div>
        </Card>

        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <div className="text-start">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">حدود الاشتراك</h4>
            <p className="text-4xl font-black font-headline text-blue-600">5</p>
            <div className="mt-4 flex items-center gap-1 text-blue-500 text-xs font-bold">
              <Users className="h-3 w-3" /> مستخدمين كحد افتراضي
            </div>
          </div>
        </Card>

        <Card className="bg-primary text-white border-0 shadow-xl rounded-3xl p-6">
          <div className="text-start">
            <h4 className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest mb-2">حالة النظام</h4>
            <div className="flex items-center gap-2 mt-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-bold">جميع الخدمات مستقرة</p>
            </div>
            <p className="text-[10px] mt-2 opacity-80">Google Cloud Platform Status: OK</p>
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b p-6 text-start">
          <CardTitle className="text-lg font-bold">إدارة المنشآت (Tenants Management)</CardTitle>
          <CardDescription>عرض وتعديل والتحكم في وصول الشركات للنظام.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start py-5 ps-8">المنشأة</TableHead>
                <TableHead className="text-start">النشاط السيادي</TableHead>
                <TableHead className="text-start">نهاية التجربة</TableHead>
                <TableHead className="text-start">المستخدمين</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="text-end pe-8">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companiesLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></TableCell></TableRow>
              ) : (
                companies?.map((comp: any) => (
                  <TableRow key={comp.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-start ps-8">
                      <div className="flex flex-col">
                        <span>{comp.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{comp.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge variant="outline" className="text-[10px] font-black uppercase text-primary border-primary/20 bg-primary/5 py-1 px-3">
                         {getActivityLabel(comp.activity)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-start">
                      {comp.trialEndsAt?.split('T')[0]}
                    </TableCell>
                    <TableCell className="font-bold text-xs text-start">{comp.maxUsers || 5}</TableCell>
                    <TableCell className="text-start">
                      <Badge className={cn("font-black px-3 py-1", comp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                        {comp.status === 'active' ? 'نشط' : 'موقوف'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end pe-8">
                      <div className="flex justify-end gap-2">
                        <Dialog open={editingCompany?.id === comp.id} onOpenChange={(open) => !open && setEditingCompany(null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-xl h-10 w-10 p-0" onClick={() => setEditingCompany({...comp})}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md rounded-3xl" dir={isRtl ? "rtl" : "ltr"}>
                            <DialogHeader className="text-start">
                              <DialogTitle className="text-2xl font-black">تعديل بيانات المنشأة</DialogTitle>
                              <DialogDescription className="font-bold">
                                قم بتغيير إعدادات الشركة وقيود الاشتراك النشاطي.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-6 text-start">
                              <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">اسم الشركة</Label>
                                <Input 
                                  value={editingCompany?.name || ''} 
                                  className="h-12 border-2"
                                  onChange={e => setEditingCompany({...editingCompany, name: e.target.value})} 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">النشاط الرئيسي السيادي</Label>
                                <Select value={editingCompany?.activity} onValueChange={v => setEditingCompany({...editingCompany, activity: v})}>
                                   <SelectTrigger className="h-12 border-2 font-bold"><SelectValue /></SelectTrigger>
                                   <SelectContent className="rounded-xl">
                                      <SelectItem value="construction" className="font-bold">
                                         <div className="flex items-center gap-2"><HardHat className="h-4 w-4" /> <span>مقاولات وإنشاءات</span></div>
                                      </SelectItem>
                                      <SelectItem value="consulting" className="font-bold">
                                         <div className="flex items-center gap-2"><PencilRuler className="h-4 w-4" /> <span>استشارات هندسية</span></div>
                                      </SelectItem>
                                      <SelectItem value="design_build" className="font-bold text-primary">
                                         <div className="flex items-center gap-2"><Zap className="h-4 w-4" /> <span>تصميم وإنشاء (D&B)</span></div>
                                      </SelectItem>
                                   </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                   <Label className="text-xs font-black uppercase text-slate-400">الحد الأقصى للمستخدمين</Label>
                                   <Input 
                                     type="number" 
                                     value={editingCompany?.maxUsers || ''} 
                                     className="h-12 border-2 text-center font-black"
                                     onChange={e => setEditingCompany({...editingCompany, maxUsers: e.target.value})} 
                                   />
                                 </div>
                                 <div className="space-y-2">
                                   <Label className="text-xs font-black uppercase text-slate-400">نهاية الفترة التجريبية</Label>
                                   <SmartDateInput 
                                     value={editingCompany?.trialEndsAt?.split('T')[0] || ''} 
                                     onChange={v => setEditingCompany({...editingCompany, trialEndsAt: v})} 
                                   />
                                 </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleUpdateCompany} disabled={processingId === comp.id} className="w-full h-14 rounded-2xl text-lg">
                                {processingId === comp.id ? <Loader2 className="animate-spin" /> : <Save className="ml-2 h-5 w-5" />}
                                حفظ التعديلات السيادية
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Button 
                          size="sm" 
                          variant={comp.status === 'active' ? 'destructive' : 'default'}
                          onClick={() => handleToggleStatus(comp.id, comp.status)}
                          disabled={processingId === comp.id}
                          className="rounded-xl h-10 w-10 p-0 font-bold"
                        >
                          {comp.status === 'active' ? <Ban className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
                        </Button>
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
