'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Mail, Phone, MoreHorizontal, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const initialLeads = [
  { id: "1", name: "خالد العتيبي", company: "شركة العتيبي للمقاولات", status: "qualified", value: 50000, email: "k.otaibi@example.com" },
  { id: "2", name: "محمد صلاح", company: "مجموعة النيل الهندسية", status: "new", value: 120000, email: "m.salah@nile-group.com" },
  { id: "3", name: "سارة الأحمد", company: "مكتب آفاق للاستشارات", status: "contacted", value: 35000, email: "s.ahmad@afaq.com" },
  { id: "4", name: "عبدالله الرويحي", company: "الرويحي للإنشاءات", status: "closed", value: 90000, email: "a.ruwaihi@ruwaihi.com" },
];

export default function CRMPage() {
  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-right">إدارة العملاء والفرص (CRM)</h1>
          <p className="text-muted-foreground mt-1 text-right">تتبع العملاء المحتملين والصفقات في خط الأنابيب</p>
        </div>
        <Button className="bg-primary text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-primary/20">
          <UserPlus className="ml-2 h-5 w-5" />
          إضافة عميل محتمل
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription>إجمالي الفرص</CardDescription>
            <CardTitle className="text-2xl font-black font-headline">24</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription>القيمة المتوقعة</CardDescription>
            <CardTitle className="text-2xl font-black font-headline text-primary">295,000 د.ك</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription>معدل التحويل</CardDescription>
            <CardTitle className="text-2xl font-black font-headline text-emerald-600">64%</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription>نشط حالياً</CardDescription>
            <CardTitle className="text-2xl font-black font-headline text-blue-600">12</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث عن عميل..." className="pr-10 rounded-xl" />
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
              {initialLeads.map((lead) => (
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
                  <TableCell className="text-left font-mono font-bold">{lead.value.toLocaleString()} د.ك</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}