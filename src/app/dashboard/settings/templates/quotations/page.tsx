'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, Plus, Loader2, Search, ArrowRight, 
  LayoutTemplate, Trash2, Edit3, ShieldCheck, AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate } from '@/types/templates';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { QuotationTemplateForm } from './quotation-template-form';
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

export default function QuotationTemplatesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<QuotationTemplate | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const templatesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.quotationTemplates(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: templates, loading } = useCollection<QuotationTemplate>(templatesQuery);

  const handleDelete = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      await service.deleteTemplate('quotation', deletingId);
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
      <QuotationTemplateForm 
        template={editingTemplate === 'new' ? null : editingTemplate} 
        onClose={() => setEditingTemplate(null)} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start space-y-2">
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit border border-primary/10">
             <ShieldCheck className="h-3 w-3" /> {tSafe('inline.legal.document.library', 'مكتبة الوثائق القانونية', 'Legal Document Library')}
          </div>
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <FileText className="h-10 w-10 text-primary" />
            {t('quotationTemplates')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة النماذج المرجعية لعروض الأسعار والمناقصات' : 'Manage reference templates for quotes and tenders'}
          </p>
        </div>

        <Button 
          onClick={() => setEditingTemplate('new')}
          className="bg-primary text-white font-black rounded-xl h-11 px-8 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-4 border-orange-700"
        >
          <Plus className="h-5 w-5" />
          {isRtl ? 'قالب جديد' : 'New Template'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-12 rounded-2xl h-11 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-8 ps-10 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'مسمى القالب' : 'Template Name'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المسار المرتبط' : 'Associated Path'}</TableHead>
                <TableHead className="text-center text-xs font-black uppercase tracking-widest">{isRtl ? 'نمط التسعير' : 'Pricing'}</TableHead>
                <TableHead className="pe-10 text-end text-xs font-black uppercase tracking-widest">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-32 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد قوالب مسجلة.' : 'No templates found.'}</TableCell></TableRow>
              ) : (
                filtered.map((temp) => (
                  <TableRow key={temp.id} className="hover:bg-slate-50/50 transition-colors group border-b-slate-100 cursor-pointer" onClick={() => setEditingTemplate(temp)}>
                    <TableCell className="py-8 ps-10 text-start">
                       <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary font-black text-xl border-2 border-orange-50">
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
                          <Badge variant="secondary" className="bg-primary/5 text-primary border-0 font-black text-[9px] uppercase px-3 w-fit">{temp.activityTypeName}</Badge>
                          <span className="text-xs font-bold text-slate-500">{temp.subServiceName || temp.serviceName}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="font-black text-[10px] px-4 border-2 h-7 rounded-xl uppercase">
                          {t(temp.pricingMode)}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-10 text-end" onClick={e => e.stopPropagation()}>
                       <div className="flex justify-end gap-3">
                          <Button variant="outline" size="icon" onClick={() => setEditingTemplate(temp)} className="rounded-xl h-11 w-11 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-sm transition-all">
                             <Edit3 className="h-5 w-5" />
                          </Button>
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeletingId(temp.id!)}
                              className="rounded-xl h-11 w-11 text-rose-500 hover:bg-rose-50 transition-all"
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
    </div>
  );
}
