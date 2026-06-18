
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Search, Loader2, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';

export default function ChecklistsPage() {
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newChecklist, setNewChecklist] = useState({ title: '', category: 'technical', description: '' });

  // SaaS Logic: Fetching scoped to company
  const checklistsRef = useMemo(() => {
    if (!db || !globalUser?.companyId) return null;
    return collection(db, paths.checklists(globalUser.companyId));
  }, [db, globalUser?.companyId]);

  const checklistsQuery = useMemo(() => {
    if (!checklistsRef) return null;
    return query(checklistsRef, orderBy('createdAt', 'desc'));
  }, [checklistsRef]);

  const { data: checklists, loading } = useCollection(checklistsQuery);

  const handleAddChecklist = async () => {
    if (!checklistsRef) return;
    setIsAdding(true);
    try {
      await addDoc(checklistsRef, {
        ...newChecklist,
        items: [], // Start with empty items
        createdAt: serverTimestamp(),
      });
      toast({ title: "تم الإنشاء", description: "تمت إضافة القائمة المرجعية الجديدة لقاعدة بياناتك." });
      setNewChecklist({ title: '', category: 'technical', description: '' });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "حدث خطأ أثناء حفظ القائمة." });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!checklistsRef) return;
    try {
      await deleteDoc(doc(checklistsRef, id));
      toast({ title: "تم الحذف", description: "تم إزالة القائمة المرجعية بنجاح." });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الحذف حالياً." });
    }
  };

  const filteredChecklists = checklists?.filter(c => 
    c.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.category?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-right">
          <h1 className="text-3xl font-black font-headline">القوائم المرجعية والمعايير</h1>
          <p className="text-muted-foreground mt-1">قاعدة بيانات الشركة المصغرة للنماذج، الإجراءات، والمعايير الفنية</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-primary/20">
              <Plus className="ml-2 h-5 w-5" />
              إنشاء قاعدة بيانات جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة قائمة مرجعية</DialogTitle>
              <DialogDescription className="text-right">قم بتعريف إجراء أو معيار جديد ليتم الرجوع إليه من قبل الفريق.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-right">
              <div className="space-y-2">
                <Label htmlFor="title">عنوان القائمة / المعيار</Label>
                <Input id="title" value={newChecklist.title} onChange={e => setNewChecklist({...newChecklist, title: e.target.value})} placeholder="مثال: إجراءات تسليم الموقع" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">التصنيف</Label>
                <Select value={newChecklist.category} onValueChange={val => setNewChecklist({...newChecklist, category: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">فني / هندسي</SelectItem>
                    <SelectItem value="financial">محاسبي / مالي</SelectItem>
                    <SelectItem value="hr">موارد بشرية</SelectItem>
                    <SelectItem value="safety">أمن وسلامة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">وصف مختصر</Label>
                <Input id="description" value={newChecklist.description} onChange={e => setNewChecklist({...newChecklist, description: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddChecklist} disabled={isAdding || !newChecklist.title} className="w-full">
                {isAdding ? <Loader2 className="animate-spin" /> : "حفظ القائمة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-sm">
          <CardHeader className="p-4 text-right">
            <div className="flex items-center justify-between flex-row-reverse">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><ClipboardList className="h-5 w-5" /></div>
              <CardDescription>إجمالي القوائم</CardDescription>
            </div>
            <CardTitle className="text-2xl font-black mt-2">{filteredChecklists.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-blue-50 border-blue-200 shadow-sm">
          <CardHeader className="p-4 text-right">
            <div className="flex items-center justify-between flex-row-reverse">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><CheckCircle2 className="h-5 w-5" /></div>
              <CardDescription>النماذج الفنية</CardDescription>
            </div>
            <CardTitle className="text-2xl font-black mt-2">{filteredChecklists.filter(c => c.category === 'technical').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
          <CardHeader className="p-4 text-right">
            <div className="flex items-center justify-between flex-row-reverse">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><FileText className="h-5 w-5" /></div>
              <CardDescription>تحديثات هذا الشهر</CardDescription>
            </div>
            <CardTitle className="text-2xl font-black mt-2">جديد</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b flex flex-row items-center justify-between flex-row-reverse">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث في القواعد والبيانات..." 
              className="pr-10 rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <h3 className="font-bold text-lg hidden md:block">سجل المعايير والبيانات</h3>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-right">عنوان المعيار / القائمة</TableHead>
                <TableHead className="text-right">التصنيف</TableHead>
                <TableHead className="text-right">تاريخ الإضافة</TableHead>
                <TableHead className="text-center">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredChecklists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    لا توجد قوائم مرجعية مضافة حالياً لشركتك.
                  </TableCell>
                </TableRow>
              ) : (
                filteredChecklists.map((checklist: any) => (
                  <TableRow key={checklist.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-bold">
                      <div className="flex flex-col">
                        <span>{checklist.title}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">{checklist.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        checklist.category === 'technical' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                        checklist.category === 'financial' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                        checklist.category === 'hr' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                        'border-emerald-200 text-emerald-700 bg-emerald-50'
                      }>
                        {checklist.category === 'technical' ? 'فني / هندسي' : 
                         checklist.category === 'financial' ? 'محاسبي' : 
                         checklist.category === 'hr' ? 'موارد بشرية' : 'أمن وسلامة'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {checklist.createdAt?.toDate().toLocaleDateString('ar-KW')}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(checklist.id)}>
                          <Trash2 className="h-4 w-4" />
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
