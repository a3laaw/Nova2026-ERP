
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Loader2, Search, ArrowRight, 
  Gavel, Trash2, Edit3, ShieldCheck, FileText,
  AlertTriangle, LayoutGrid, Boxes, Landmark
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { ContractTemplate } from '@/types/templates';
import { Service } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ContractTemplateForm } from './contract-template-form';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ContractTemplatesContent() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // استخراج النطاق (التصميم أو المقاولات) من الرابط
  const scopeCode = searchParams.get('scope') || 'CONSTRUCTION';

  const [searchTerm, setSearchTerm] = useState("");
  const [activeServiceTab, setActiveServiceTab] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. جلب بيانات النشاط المختار (للتعرف على المعرف الفعلي)
  const actTypeQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.activityTypes(companyId)), where('code', '==', scopeCode)) : null, 
  [db, companyId, scopeCode]);
  const { data: currentActList } = useCollection<any>(actTypeQuery);
  const currentAct = currentActList?.[0];

  // 2. جلب كافة الخدمات التابعة لهذا النشاط (لعمل التابات التلقائية)
  const servicesQuery = useMemo(() => 
    companyId && db && currentAct?.id ? query(collection(db, paths.services(companyId, currentAct.id)), orderBy('order')) : null, 
  [db, companyId, currentAct?.id]);
  const { data: services, loading: servicesLoading } = useCollection<Service>(servicesQuery);

  // 3. جلب القوالب
  const templatesQuery = useMemo(() => 
    companyId && db && currentAct?.id ? query(collection(db, paths.contractTemplates(companyId)), where('activityTypeId', '==', currentAct.id)) : null, 
  [db, companyId, currentAct?.id]);
  const { data: templates, loading: templatesLoading } = useCollection<ContractTemplate>(templatesQuery);

  const handleDelete = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      await service.deleteTemplate('contract', deletingId);
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    let list = templates || [];
    if (activeServiceTab !== 'all') {
      list = list.filter(t => t.serviceId === activeServiceTab);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(term) || t.code?.toLowerCase().includes(term));
    }
    return list;
  }, [templates, activeServiceTab, searchTerm]);

  if (editingTemplate) {
    return (
      <ContractTemplateForm 
        template={editingTemplate === 'new' ? null : editingTemplate} 
        onClose={() => setEditingTemplate(null)} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-full text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {tSafe('inline.authorized.library', 'المكتبة المعتمدة', 'Authorized Library')}
           </div>
           <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
             {scopeCode === 'CONSULTING' ? <Landmark className="h-10 w-10 text-primary" /> : <Gavel className="h-10 w-10 text-primary" />}
             {scopeCode === 'CONSULTING' ? (isRtl ? 'قوالب عقود التصميم' : 'Consulting Templates') : (isRtl ? 'قوالب عقود المقاولات' : 'Construction Templates')}
           </h1>
        </div>

        <Button 
          onClick={() => setEditingTemplate('new')}
          className="bg-primary text-white font-black rounded-2xl px-10 py-8 text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700"
        >
          <Plus className="h-7 w-7" />
          {isRtl ? 'إصدار قالب جديد' : 'New Template'}
        </Button>
      </header>

      <div className="space-y-6">
         {/* التابات التلقائية بناءً على الأقسام (Services) */}
         <Tabs value={activeServiceTab} onValueChange={setActiveServiceTab} className="w-full">
            <div className="flex items-center justify-between gap-4 mb-6">
               <TabsList className="bg-white border-2 border-slate-100 p-1.5 rounded-[1.5rem] h-16 gap-2 shadow-xl flex-1 md:flex-none">
                  <TabsTrigger value="all" className="rounded-2xl font-black text-xs px-10 h-full data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
                     {isRtl ? 'كافة الأقسام' : 'All Sections'}
                  </TabsTrigger>
                  {services?.map(srv => (
                    <TabsTrigger key={srv.id} value={srv.id!} className="rounded-2xl font-black text-xs px-10 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                       <Boxes className="h-4 w-4" /> {isRtl ? srv.name : srv.nameEn}
                    </TabsTrigger>
                  ))}
               </TabsList>
               
               <div className="relative max-w-xs hidden md:block">
                  <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder={t('search')} 
                    className="h-12 ps-11 rounded-2xl border-2 bg-white font-bold shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>

            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="py-8 ps-10 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'مسمى القالب' : 'Template Name'}</TableHead>
                      <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المسار المرتبط' : 'Associated Path'}</TableHead>
                      <TableHead className="text-center text-xs font-black uppercase tracking-widest">{isRtl ? 'المحتجزات' : 'Retention'}</TableHead>
                      <TableHead className="text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'قيمة القالب' : 'Base Value'}</TableHead>
                      <TableHead className="pe-10 text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد قوالب في هذا القسم حالياً.' : 'No templates in this section.'}</TableCell></TableRow>
                    ) : (
                      filtered.map((temp) => (
                        <TableRow key={temp.id} className="hover:bg-slate-50/50 transition-colors group border-b-slate-50 cursor-pointer" onClick={() => setEditingTemplate(temp)}>
                          <TableCell className="py-8 ps-10 text-start">
                             <div className="flex items-center gap-5">
                                <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary font-black text-xl border-2 border-orange-50 group-hover:scale-110 transition-transform">
                                   <FileText className="h-7 w-7" />
                                </div>
                                <div className="text-start">
                                   <p className="font-black text-xl text-slate-800">{temp.name}</p>
                                   <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">REF: {temp.code || 'NO_CODE'}</p>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-start">
                             <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-0 font-black text-[9px] uppercase px-3 w-fit">{temp.subServiceName || temp.serviceName}</Badge>
                                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-tighter"><LayoutGrid className="h-2.5 w-2.5" /> {temp.boqTemplateName || '---'}</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-center">
                             <Badge variant="outline" className={cn(
                               "font-black text-[10px] px-4 border-2 h-7 rounded-xl",
                               (temp.retentionRate || 0) > 0 ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-slate-50 text-slate-400 border-slate-100"
                             )}>
                                {temp.retentionRate || 0}%
                             </Badge>
                          </TableCell>
                          <TableCell className="text-end">
                             <span className="font-mono font-black text-xl text-emerald-600 pe-4">
                                {temp.baseAmount?.toLocaleString() || '0'}
                             </span>
                          </TableCell>
                          <TableCell className="pe-10 text-end" onClick={e => e.stopPropagation()}>
                             <div className="flex justify-end gap-3">
                                <Button variant="outline" size="icon" onClick={() => setEditingTemplate(temp)} className="rounded-xl h-12 w-12 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-sm transition-all">
                                   <Edit3 className="h-5 w-5" />
                                </Button>
                                {isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setDeletingId(temp.id!)}
                                    className="rounded-xl h-12 w-12 text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                  >
                                     <Trash2 className="h-5 w-5" />
                                  </Button>
                                )}
                             </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
         </Tabs>
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if(!v) setDeletingId(null); }}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('common.confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {isRtl 
                  ? 'هل أنت متأكد؟ سيتم حذف هذا القالب المرجعي نهائياً من مكتبة العقود. لن يتأثر المشاريع القائمة بهذا الإجراء، ولكن لن تتمكن من استخدامه مرة أخرى.' 
                  : 'Are you sure? This contract template will be permanently removed from the library. Existing projects won\'t be affected.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row items-center justify-center">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
               {isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف القالب' : 'Confirm Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ContractTemplatesPage() {
   return <Suspense fallback={<div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}><ContractTemplatesContent /></Suspense>;
}
