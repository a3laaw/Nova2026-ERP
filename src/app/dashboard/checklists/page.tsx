
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Database, Plus, Search, Loader2, Trash2, 
  ChevronRight, Building2, MapPin, Workflow, 
  Settings2, ArrowLeft, Layers 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';

export default function ReferenceHubPage() {
  const { globalUser } = useAuthContext();
  const { t } = useLanguage();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("technical");

  // State for drill-down navigation in Technical Path
  const [selectedTxType, setSelectedTxType] = useState<any>(null);
  const [selectedSubService, setSelectedSubService] = useState<any>(null);

  // Firestore Collections
  const txTypesQuery = useMemo(() => {
    if (!db || !globalUser?.companyId) return null;
    return query(collection(db, paths.transactionTypes(globalUser.companyId)), orderBy('name'));
  }, [db, globalUser?.companyId]);

  const subServicesQuery = useMemo(() => {
    if (!db || !globalUser?.companyId || !selectedTxType) return null;
    return query(collection(db, paths.subServices(globalUser.companyId, selectedTxType.id)), orderBy('name'));
  }, [db, globalUser?.companyId, selectedTxType]);

  const stagesQuery = useMemo(() => {
    if (!db || !globalUser?.companyId || !selectedTxType || !selectedSubService) return null;
    return query(collection(db, paths.technicalStages(globalUser.companyId, selectedTxType.id, selectedSubService.id)), orderBy('order'));
  }, [db, globalUser?.companyId, selectedTxType, selectedSubService]);

  const { data: txTypes, loading: txLoading } = useCollection(txTypesQuery);
  const { data: subServices, loading: subLoading } = useCollection(subServicesQuery);
  const { data: stages, loading: stageLoading } = useCollection(stagesQuery);

  // Management State
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  const handleAdd = async (type: 'tx' | 'sub' | 'stage') => {
    if (!newItemName.trim() || !globalUser?.companyId || !db) return;
    setIsAdding(true);
    try {
      let ref;
      let data: any = { name: newItemName, createdAt: serverTimestamp() };

      if (type === 'tx') {
        ref = collection(db, paths.transactionTypes(globalUser.companyId));
      } else if (type === 'sub' && selectedTxType) {
        ref = collection(db, paths.subServices(globalUser.companyId, selectedTxType.id));
        data.parentId = selectedTxType.id;
      } else if (type === 'stage' && selectedTxType && selectedSubService) {
        ref = collection(db, paths.technicalStages(globalUser.companyId, selectedTxType.id, selectedSubService.id));
        data.order = (stages?.length || 0) + 1;
        data.controlType = 'TimeBased';
      }

      if (ref) {
        await addDoc(ref, data);
        toast({ title: "تم الحفظ", description: "تمت إضافة السجل المرجعي بنجاح." });
        setNewItemName("");
      }
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الحفظ." });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-right">
          <h1 className="text-3xl font-black font-headline flex items-center gap-3 flex-row-reverse">
            <Database className="h-8 w-8 text-primary" />
            {t('checklists')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold">هيكلة المسارات الفنية، الأقسام، والقواعد المرجعية للنظام</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl mx-auto h-14 bg-muted/50 rounded-2xl p-1">
          <TabsTrigger value="technical" className="rounded-xl font-bold gap-2 flex-row-reverse"><Workflow className="h-4 w-4" /> {t('techRef')}</TabsTrigger>
          <TabsTrigger value="org" className="rounded-xl font-bold gap-2 flex-row-reverse"><Building2 className="h-4 w-4" /> {t('orgRef')}</TabsTrigger>
          <TabsTrigger value="geo" className="rounded-xl font-bold gap-2 flex-row-reverse"><MapPin className="h-4 w-4" /> {t('geoRef')}</TabsTrigger>
        </TabsList>

        <TabsContent value="technical" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Transaction Types */}
            <Card className="border-0 shadow-lg rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">{t('txTypes')}</CardTitle>
                <Dialog>
                  <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-primary"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                  <DialogContent className="rounded-3xl" dir="rtl">
                    <DialogHeader><DialogTitle className="text-right">إضافة نوع معاملة جديد</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                      <Label>اسم نوع المعاملة</Label>
                      <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="مثال: تصميم بلدية" className="h-12 rounded-xl" />
                    </div>
                    <DialogFooter><Button onClick={() => handleAdd('tx')} className="w-full h-12 rounded-xl font-bold">{isAdding ? <Loader2 className="animate-spin" /> : "حفظ"}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                {txLoading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></div> : (
                  txTypes?.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => { setSelectedTxType(tx); setSelectedSubService(null); }}
                      className={`p-4 border-b flex items-center justify-between cursor-pointer transition-colors ${selectedTxType?.id === tx.id ? 'bg-primary/5 border-r-4 border-r-primary' : 'hover:bg-muted/30'}`}
                    >
                      <span className="text-sm font-bold">{tx.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Column 2: Sub Services */}
            <Card className={`border-0 shadow-lg rounded-3xl bg-white overflow-hidden transition-opacity ${!selectedTxType ? 'opacity-30 pointer-events-none' : ''}`}>
              <CardHeader className="bg-slate-50 border-b p-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">{t('subSrvs')}</CardTitle>
                <Dialog>
                  <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-primary"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                  <DialogContent className="rounded-3xl" dir="rtl">
                    <DialogHeader><DialogTitle className="text-right">إضافة خدمة فرعية لـ {selectedTxType?.name}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                      <Label>اسم الخدمة الفرعية</Label>
                      <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="مثال: مخططات معمارية" className="h-12 rounded-xl" />
                    </div>
                    <DialogFooter><Button onClick={() => handleAdd('sub')} className="w-full h-12 rounded-xl font-bold">{isAdding ? <Loader2 className="animate-spin" /> : "حفظ"}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                {!selectedTxType ? <div className="p-12 text-center text-xs text-muted-foreground">اختر نوع معاملة أولاً</div> : (
                  subLoading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></div> : (
                    subServices?.map(sub => (
                      <div 
                        key={sub.id} 
                        onClick={() => setSelectedSubService(sub)}
                        className={`p-4 border-b flex items-center justify-between cursor-pointer transition-colors ${selectedSubService?.id === sub.id ? 'bg-primary/5 border-r-4 border-r-primary' : 'hover:bg-muted/30'}`}
                      >
                        <span className="text-sm font-bold">{sub.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))
                  )
                )}
              </CardContent>
            </Card>

            {/* Column 3: Technical Stages (WBS) */}
            <Card className={`border-0 shadow-lg rounded-3xl bg-white overflow-hidden transition-opacity ${!selectedSubService ? 'opacity-30 pointer-events-none' : ''}`}>
              <CardHeader className="bg-slate-50 border-b p-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">{t('stages')}</CardTitle>
                <Dialog>
                  <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-primary"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                  <DialogContent className="rounded-3xl" dir="rtl">
                    <DialogHeader><DialogTitle className="text-right">إضافة مرحلة عمل لـ {selectedSubService?.name}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                      <Label>اسم المرحلة (WBS Item)</Label>
                      <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="مثال: إعداد المسودة الأولى" className="h-12 rounded-xl" />
                    </div>
                    <DialogFooter><Button onClick={() => handleAdd('stage')} className="w-full h-12 rounded-xl font-bold">{isAdding ? <Loader2 className="animate-spin" /> : "حفظ"}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {!selectedSubService ? <div className="p-12 text-center text-xs text-muted-foreground">اختر خدمة فرعية أولاً</div> : (
                  stageLoading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></div> : (
                    stages?.length === 0 ? <p className="text-center text-xs text-muted-foreground py-8">لا يوجد مراحل بعد</p> : (
                      stages?.map((stage, idx) => (
                        <div key={stage.id} className="p-3 bg-muted/40 rounded-xl border flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold">{stage.name}</p>
                            <Badge variant="outline" className="text-[9px] mt-1 bg-white">TimeBased</Badge>
                          </div>
                        </div>
                      ))
                    )
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="org" className="mt-8">
          <div className="flex items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed opacity-50">
            <div className="text-center space-y-2">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="font-bold">قيد البرمجة: موديول الأقسام والوظائف</p>
              <p className="text-xs">سيتم ربط الموظفين بالأقسام المرجعية هنا.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="geo" className="mt-8">
           <div className="flex items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed opacity-50">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="font-bold">قيد البرمجة: موديول المحافظات والمناطق</p>
              <p className="text-xs">سيتم استخدامها في عناوين المشاريع والعملاء.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
