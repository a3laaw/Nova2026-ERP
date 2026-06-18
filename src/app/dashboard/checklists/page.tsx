'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Search, Loader2, Trash2, FileText, CheckCircle2, X } from "lucide-react";
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
  
  // الحالة الخاصة بالقائمة الجديدة
  const [newChecklist, setNewChecklist] = useState({ title: '', category: '', description: '' });
  const [tempItems, setTempItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState("");

  // جلب البيانات من السحاب بناءً على معرف الشركة
  const checklistsRef = useMemo(() => {
    if (!db || !globalUser?.companyId) return null;
    return collection(db, paths.checklists(globalUser.companyId));
  }, [db, globalUser?.companyId]);

  const checklistsQuery = useMemo(() => {
    if (!checklistsRef) return null;
    return query(checklistsRef, orderBy('createdAt', 'desc'));
  }, [checklistsRef]);

  const { data: checklists, loading } = useCollection(checklistsQuery);

  const handleAddItem = () => {
    if (newItemText.trim()) {
      setTempItems([...tempItems, newItemText.trim()]);
      setNewItemText("");
    }
  };

  const removeItem = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const handleAddChecklist = async () => {
    if (!checklistsRef || !newChecklist.title) return;
    setIsAdding(true);
    try {
      await addDoc(checklistsRef, {
        title: newChecklist.title,
        category: newChecklist.category || 'technical',
        description: newChecklist.description,
        items: tempItems.map(text => ({ text, isRequired: true })),
        createdAt: serverTimestamp(),
      });
      toast({ title: "تم الحفظ", description: "تمت إضافة المعيار الجديد لقاعدة بيانات الشركة." });
      setNewChecklist({ title: '', category: '', description: '' });
      setTempItems([]);
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر حفظ البيانات حالياً." });
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
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الحذف." });
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
          <h1 className="text-3xl font-black font-headline">قاعدة البيانات المرجعية</h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold">إدارة المعايير، النماذج الفنية، وإجراءات الجودة للشركة</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-bold rounded-2xl px-8 py-7 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="ml-2 h-5 w-5" />
              إنشاء نموذج معيار جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-headline font-bold text-xl">إضافة معيار / قائمة مرجعية</DialogTitle>
              <DialogDescription className="text-right">أدخل تفاصيل الإجراء أو قائمة المهام الفنية المطلوبة من فريقك.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 text-right">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-bold">عنوان النموذج</Label>
                <Input 
                  id="title" 
                  value={newChecklist.title} 
                  onChange={e => setNewChecklist({...newChecklist, title: e.target.value})} 
                  placeholder="مثال: إجراءات استلام حديد التسليح"
                  className="rounded-xl border-2 h-12"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="font-bold">التصنيف الرئيسي</Label>
                  <Select value={newChecklist.category} onValueChange={val => setNewChecklist({...newChecklist, category: val})}>
                    <SelectTrigger className="rounded-xl border-2 h-12">
                      <SelectValue placeholder="اختر التصنيف..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">فني / هندسي</SelectItem>
                      <SelectItem value="financial">محاسبي / مالي</SelectItem>
                      <SelectItem value="safety">أمن وسلامة</SelectItem>
                      <SelectItem value="hr">إداري / HR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="font-bold">وصف المعيار</Label>
                  <Input 
                    id="description" 
                    value={newChecklist.description} 
                    onChange={e => setNewChecklist({...newChecklist, description: e.target.value})} 
                    placeholder="مثال: يطبق في مصفاة الزور"
                    className="rounded-xl border-2 h-12"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <Label className="font-bold">بنود التحقق (Checklist Items)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newItemText} 
                    onChange={e => setNewItemText(e.target.value)} 
                    placeholder="اكتب بنداً جديداً هنا..."
                    className="rounded-xl border-2 h-12 flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  />
                  <Button type="button" onClick={handleAddItem} className="h-12 w-12 rounded-xl bg-secondary text-secondary-foreground">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="max-h-[150px] overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-2xl border">
                  {tempItems.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-4">لم يتم إضافة أي بنود بعد.</p>
                  ) : (
                    tempItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 px-3 rounded-lg border text-xs group">
                        <span>{item}</span>
                        <button onClick={() => removeItem(idx)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddChecklist} disabled={isAdding || !newChecklist.title} className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20">
                {isAdding ? <Loader2 className="animate-spin" /> : "حفظ المعيار في قاعدة البيانات"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-0 shadow-lg rounded-2xl p-6 text-right">
          <div className="flex items-center justify-between flex-row-reverse mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><ClipboardList className="h-6 w-6" /></div>
            <span className="text-xs font-bold text-muted-foreground">قواعد البيانات</span>
          </div>
          <h3 className="text-3xl font-black font-headline">{filteredChecklists.length}</h3>
          <p className="text-xs text-muted-foreground mt-1">إجمالي القوائم والنماذج المعتمدة</p>
        </Card>
        
        <Card className="bg-white border-0 shadow-lg rounded-2xl p-6 text-right">
          <div className="flex items-center justify-between flex-row-reverse mb-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600"><CheckCircle2 className="h-6 w-6" /></div>
            <span className="text-xs font-bold text-muted-foreground">التصنيف الفني</span>
          </div>
          <h3 className="text-3xl font-black font-headline">{filteredChecklists.filter(c => c.category === 'technical').length}</h3>
          <p className="text-xs text-muted-foreground mt-1">نماذج هندسية وفنية</p>
        </Card>

        <Card className="bg-slate-900 text-white border-0 shadow-lg rounded-2xl p-6 text-right">
          <div className="flex items-center justify-between flex-row-reverse mb-4">
            <div className="p-3 bg-white/10 rounded-2xl text-white"><FileText className="h-6 w-6" /></div>
            <span className="text-xs font-bold text-slate-400">آخر التحديثات</span>
          </div>
          <h3 className="text-xl font-bold font-headline mt-2">نوفا إنسايتس</h3>
          <p className="text-[10px] text-slate-400 mt-1">قاعدة البيانات محدثة وتعمل بسلاسة سحابياً</p>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="بحث في القواعد والمعايير الفنية..." 
              className="pr-12 h-12 rounded-2xl border-2 focus:border-primary/50 transition-all" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="px-4 py-2 rounded-xl bg-muted/50">تصنيف تلقائي (AI)</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b">
                <TableHead className="text-right font-bold text-slate-600">عنوان المعيار / القائمة المرجعية</TableHead>
                <TableHead className="text-right font-bold text-slate-600">التصنيف</TableHead>
                <TableHead className="text-right font-bold text-slate-600">عدد البنود</TableHead>
                <TableHead className="text-right font-bold text-slate-600">تاريخ الإضافة</TableHead>
                <TableHead className="text-center font-bold text-slate-600">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-sm font-bold text-muted-foreground">جاري استرجاع بياناتك من السحاب...</p>
                  </TableCell>
                </TableRow>
              ) : filteredChecklists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="max-w-xs mx-auto text-center space-y-2 opacity-40">
                      <ClipboardList className="h-12 w-12 mx-auto" />
                      <p className="text-sm font-bold">لا يوجد سجلات مطابقة حالياً.</p>
                      <p className="text-xs">ابدأ بإنشاء أول معيار مرجعي لشركتك الآن.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredChecklists.map((checklist: any) => (
                  <TableRow key={checklist.id} className="hover:bg-primary/5 transition-colors border-b">
                    <TableCell className="font-bold py-5">
                      <div className="flex flex-col">
                        <span className="text-sm">{checklist.title}</span>
                        <span className="text-[10px] text-muted-foreground font-normal mt-0.5">{checklist.description || "بدون وصف إضافي"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        checklist.category === 'technical' ? 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20' :
                        checklist.category === 'financial' ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20' :
                        checklist.category === 'safety' ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20' :
                        'bg-purple-500/10 text-purple-700 hover:bg-purple-500/20'
                      }>
                        {checklist.category === 'technical' ? 'فني / هندسي' : 
                         checklist.category === 'financial' ? 'محاسبي' : 
                         checklist.category === 'safety' ? 'أمن وسلامة' : 'إداري / HR'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono font-bold bg-muted px-2 py-1 rounded-lg">
                        {checklist.items?.length || 0} بند
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[10px] font-mono">
                      {checklist.createdAt?.toDate().toLocaleDateString('ar-KW')}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDelete(checklist.id)}>
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
