'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileSpreadsheet, Plus, Loader2, Search, ArrowRight, 
  Trash2, Edit3, ShieldCheck, Layers, Boxes
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate } from '@/types/templates';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { BOQTemplateForm } from './boq-template-form';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';

export default function BOQTemplatesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<BOQTemplate | null | 'new'>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const templatesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqTemplates(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: templates, loading } = useCollection<BOQTemplate>(templatesQuery);

  const handleDelete = async (id: string) => {
    if (!db || !companyId || !confirm(t('confirmDelete'))) return;
    setLoadingAction(id);
    try {
      const service = new TemplateService(db, companyId);
      await service.deleteTemplate('boq', id);
      toast({ title: t('deleted') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const filtered = (templates || []).filter(temp => 
    temp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    temp.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (editingTemplate) {
    return (
      <BOQTemplateForm 
        template={editingTemplate === 'new' ? null : editingTemplate} 
        onClose={() => setEditingTemplate(null)} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            {isRtl ? 'قوالب جداول الكميات (BOQ)' : 'BOQ Templates'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة بنود الأعمال القياسية والكميات المرجعية للمشاريع.' : 'Manage standard work items and reference quantities for projects.'}
          </p>
        </div>

        <Button 
          onClick={() => setEditingTemplate('new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-6 w-6" />
          {isRtl ? 'قالب BOQ جديد' : 'New BOQ Template'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={t('search')} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'القالب / الكود' : 'Template / Code'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'المسار الفني' : 'Associated Path'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الأقسام' : 'Sections'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'البنود' : 'Items'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'افتراضي' : 'Default'}</TableHead>
                <TableHead className="pe-8 text-end">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد قوالب BOQ مسجلة.' : 'No BOQ templates found.'}</TableCell></TableRow>
              ) : (
                filtered.map((temp) => (
                  <TableRow key={temp.id} className="hover:bg-slate-50 transition-colors group border-b-slate-50">
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black">
                             {temp.code?.charAt(0) || 'B'}
                          </div>
                          <div className="text-start">
                             <p className="font-black text-slate-800">{temp.name}</p>
                             <p className="text-[10px] font-mono text-slate-400 uppercase">CODE: {temp.code}</p>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600">{temp.subServiceName || temp.serviceName}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{temp.activityTypeName}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="font-black text-[9px] px-3 border-2">
                          {temp.sections?.length || 0}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="secondary" className="font-black text-[9px] px-3 bg-blue-50 text-blue-600 border-0">
                          {temp.items?.length || 0} {isRtl ? 'بند' : 'Items'}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       {temp.isDefault ? (
                         <ShieldCheck className="h-5 w-5 text-emerald-500 mx-auto" />
                       ) : <span className="text-slate-200">-</span>}
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => setEditingTemplate(temp)} className="rounded-xl h-10 w-10 text-primary border-primary/20 hover:bg-primary hover:text-white">
                             <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={loadingAction === temp.id}
                            onClick={() => handleDelete(temp.id!)}
                            className="rounded-xl h-10 w-10 text-rose-500 hover:bg-rose-50"
                          >
                             {loadingAction === temp.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
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
