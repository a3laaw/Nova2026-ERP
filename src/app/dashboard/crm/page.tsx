'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Mail, Phone, MoreHorizontal, Search, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';

export default function CRMPage() {
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', status: 'new', value: 0, email: '' });

  // 1. SaaS Logic: Fetching data scoped to the company
  const leadsRef = useMemo(() => {
    if (!db || !globalUser?.companyId) return null;
    return collection(db, paths.leads(globalUser.companyId));
  }, [db, globalUser?.companyId]);

  const leadsQuery = useMemo(() => {
    if (!leadsRef) return null;
    return query(leadsRef, orderBy('createdAt', 'desc'));
  }, [leadsRef]);

  const { data: leads, loading } = useCollection(leadsQuery);

  // 2. SaaS Logic: Adding data to the company's subcollection
  const handleAddLead = async () => {
    if (!leadsRef) return;
    setIsAdding(true);
    try {
      await addDoc(leadsRef, {
        ...newLead,
        value: Number(newLead.value),
        createdAt: serverTimestamp(),
      });
      toast({ title: "تمت الإضافة", description: "تمت إضافة العميل المحتمل بنجاح إلى قاعدة بيانات شركتك." });
      setNewLead({ name: '', company: '', status: 'new', value: 0, email: '' });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "حدث خطأ أثناء حفظ البيانات." });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredLeads = leads?.filter(lead => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalValue = filteredLeads.reduce((acc, lead) => acc + (Number(lead.value) || 0), 0);

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-right">إدارة العملاء والفرص (CRM)</h1>
          <p className="text-muted-foreground mt-1 text-right">تتبع العملاء المحتملين والصفقات في خط الأنابيب لشركتك</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-primary/20">
              <UserPlus className="ml-2 h-5 w-5" />
              إضافة عميل محتمل
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة عميل جديد</DialogTitle>
              <DialogDescription className="text-right">أدخل بيانات العميل المحتمل هنا. سيتم حفظها في قاعدة بيانات شركتك فقط.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4 text-right">
                <Label htmlFor="name" className="text-right">الاسم</Label>
                <Input id="name" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 text-right">
                <Label htmlFor="company" className="text-right">الشركة</Label>
                <Input id="company" value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 text-right">
                <Label htmlFor="email" className="text-right">البريد</Label>
                <Input id="email" type="email" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 text-right">
                <Label htmlFor="value" className="text-right">القيمة (د.ك)</Label>
                <Input id="value" type="number" value={newLead.value} onChange={e => setNewLead({...newLead, value: Number(e.target.value)})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 text-right">
                <Label htmlFor="status" className="text-right">الحالة</Label>
                <Select value={newLead.status} onValueChange={val => setNewLead({...newLead, status: val})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">جديد</SelectItem>
                    <SelectItem value="contacted">تم الاتصال</SelectItem>
                    <SelectItem value="qualified">مؤهل</SelectItem>
                    <SelectItem value="closed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddLead} disabled={isAdding || !newLead.name} className="w-full">
                {isAdding ? <Loader2 className="animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}
                حفظ العميل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2 text-right">
            <CardDescription>إجمالي الفرص</CardDescription>
            <CardTitle className="text-2xl font-black font-headline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : filteredLeads.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2 text-right">
            <CardDescription>القيمة المتوقعة</CardDescription>
            <CardTitle className="text-2xl font-black font-headline text-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : totalValue.toLocaleString()} د.ك
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2 text-right">
            <CardDescription>نشط حالياً</CardDescription>
            <CardTitle className="text-2xl font-black font-headline text-blue-600">
              {filteredLeads.filter(l => l.status !== 'closed').length}
            </SelectItem>
          </CardHeader>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2 text-right">
            <CardDescription>معدل الإنجاز</CardDescription>
            <CardTitle className="text-2xl font-black font-headline text-emerald-600">
              {filteredLeads.length > 0 ? ((filteredLeads.filter(l => l.status === 'qualified').length / filteredLeads.length) * 100).toFixed(0) : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث عن عميل..." 
              className="pr-10 rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl">تصفية</Button>
            <Button variant="outline" className="rounded-xl">تصدير</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الشركة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-left">القيمة المتوقعة</TableHead>
                <TableHead className="text-center">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-muted-foreground font-bold">جاري تحميل بيانات السحاب...</p>
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    لا يوجد عملاء مضافين لشركتك حالياً.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead: any) => (
                  <TableRow key={lead.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-bold">{lead.name}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.company}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={
                        lead.status === 'qualified' ? 'bg-emerald-100 text-emerald-700' :
                        lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
                        lead.status === 'closed' ? 'bg-muted text-muted-foreground' :
                        'bg-amber-100 text-amber-700'
                      }>
                        {lead.status === 'qualified' ? 'مؤهل' : 
                         lead.status === 'new' ? 'جديد' : 
                         lead.status === 'closed' ? 'مغلق' : 'تم الاتصال'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left font-mono font-bold">{lead.value?.toLocaleString()} د.ك</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
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
