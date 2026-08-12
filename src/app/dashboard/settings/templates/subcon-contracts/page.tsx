'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Loader2, Search, ArrowRight, 
  Handshake, Trash2, Edit3, ShieldCheck, FileText,
  AlertTriangle, Hammer
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { SubConContractTemplate } from '@/types/templates';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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
import { SubConContractTemplateForm } from './subcon-contract-form';

export default function SubConContractTemplatesPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<SubConContractTemplate | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const templatesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subconContractTemplates(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: templates, loading } = useCollection<SubConContractTemplate>(templatesQuery);

  const handleDelete = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      await service.deleteTemplate('subcon_contract', deletingId);
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = (templates || []).filter(temp => 
    temp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (temp.code && temp.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (editingTemplate) {
    return (
      <SubConContractTemplateForm 
        template={editingTemplate === 'new' ? null : editingTemplate} 
        onClose={() => setEditingTemplate(null)} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-full" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start space-y-2">
          <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest bg-amber-50 px-4 py-1.5 rounded-full w-fit border border-amber-100 shadow-sm">
             <Hammer className="h-3 w-3" /> {tSafe('inline.subcon.master', 'مكتبة عقود الباطن', 'SubCon Contract Library')}
          </div>
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Handshake className="h-10 w-10 text-primary" />
            {tSafe('inline.subcon.templates', 'قوالب عقود مقاولي الباطن', 'SubCon Templates')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {tSafe('inline.subcon.templates.desc', 'إدارة نماذج اتفاقيات مقاولي الباطن حسب التخصص.', 'Manage subcontractor agreement templates by trade.')}
          </p>
        </div>

        <Button 
          onClick={() => setEditingTemplate('new')}
          className="bg-primary text-white font-black rounded-xl h-14 px-10 py-8 text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700"
        >
          <Plus className="h-7 w-7" />
          {isRtl ? 'قالب عقد باطن جديد' : 'New SubCon Template'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={isRtl ? 'بحث باسم العقد...' : 'Search contract templates...'} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 font-bold text-lg shadow-inner" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-8 ps-12 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'مسمى القالب / الكود' : 'Template / Code'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'التخصص الفني' : 'Specialization'}</TableHead>
                <TableHead className="text-center text-xs font-black uppercase tracking-widest">{isRtl ? 'الدفعات' : 'Milestones'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{t('common.status')}</TableHead>
                <TableHead className="pe-12 text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-bold italic">{isRtl ? 'لا توجد قوالب عقود مسجلة.' : 'No templates found.'}</TableCell></TableRow>
              ) : (
                filtered.map((temp) => (
                  <TableRow key={temp.id} className="hover:bg-slate-50/50 transition-colors group border-b-slate-50 cursor-pointer" onClick={() => setEditingTemplate(temp)}>
                    <TableCell className="py-8 ps-12 text-start">
                       <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-amber-600 font-black text-xl border-2 border-amber-50 group-hover:scale-110 transition-transform">
                             <FileText className="h-7 w-7" />
                          </div>
                          <div className="text-start">
                             <p className="font-black text-xl text-slate-800">{temp.name}</p>
                             <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">REF: {temp.code || 'NO_CODE'}</p>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[9px] uppercase px-4 h-7 rounded-xl">
                          <Hammer className="h-3 w-3 me-2" /> {temp.trade || 'GENERAL'}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center font-black text-xl text-slate-900">{temp.defaultMilestones?.length || 0}</TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1 rounded-xl border-0 shadow-sm uppercase text-[9px]",
                         temp.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                       )}>
                          {temp.isActive ? 'Active' : 'Inactive'}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-12 text-end" onClick={e => e.stopPropagation()}>
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

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if(!v) setDeletingId(null); }}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[200]" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('common.confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {isRtl 
                  ? 'هل أنت متأكد؟ سيتم حذف هذا القالب المرجعي لعقود الباطن نهائياً من المكتبة. لن يتأثر العقود القائمة بهذا الإجراء.' 
                  : 'Are you sure? This subcontractor contract template will be permanently removed. Existing contracts won\'t be affected.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row items-center justify-center">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
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
