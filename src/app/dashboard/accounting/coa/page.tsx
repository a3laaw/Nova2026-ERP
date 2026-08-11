'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, Plus, Loader2, Folder, 
  FileText, Search, ChevronRight, ChevronDown,
  Sparkles, DatabaseZap, Save, ShieldCheck,
  Target, LayoutGrid
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Account, AnalyticalRequirement } from '@/types/accounting';
import { cn } from '@/lib/utils';
import { SeedService } from '@/services/seed-service';
import { AccountingService } from '@/services/accounting-service';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ChartOfAccountsPage() {
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [initializing, setInitializing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<Account>>({
    nameAr: '', nameEn: '', code: '', type: 'asset', isGroup: false, parentId: null,
    expenseNature: 'administrative',
    analyticalConfig: { costCenter: 'not_allowed', profitCenter: 'not_allowed', project: 'not_allowed', distributionAllowed: false }
  });

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const { data: accounts, loading } = useCollection<Account>(accountsQuery);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleInitCOA = async () => {
    if (!db || !companyId || !user) return;
    setInitializing(true);
    try {
      const service = new SeedService(db, companyId);
      await service.seedConstructionCOA(user.uid);
      toast({ title: t('common.saved') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setInitializing(false);
    }
  };

  const openAddDialog = (parent?: Account) => {
    setForm({
      nameAr: '',
      nameEn: '',
      code: parent ? `${parent.code}` : '',
      type: parent?.type || 'asset',
      isGroup: false,
      parentId: parent?.id || null,
      level: parent ? parent.level + 1 : 1,
      expenseNature: 'administrative',
      analyticalConfig: { costCenter: 'not_allowed', profitCenter: 'not_allowed', project: 'not_allowed', distributionAllowed: false }
    });
    setIsAdding(true);
  };

  const openEditDialog = (account: Account) => {
    setForm({
      ...account,
      analyticalConfig: account.analyticalConfig || { costCenter: 'not_allowed', profitCenter: 'not_allowed', project: 'not_allowed', distributionAllowed: false }
    });
    setIsAdding(true);
  };

  const handleSaveAccount = async () => {
    if (!db || !companyId || !user || !form.nameAr || !form.code) return;
    setSaving(true);
    try {
      const service = new AccountingService(db, companyId);
      if (form.id) {
        const ref = doc(db, paths.accounts(companyId), form.id);
        await updateDoc(ref, { ...form, updatedAt: serverTimestamp() });
      } else {
        await service.createAccount(form, user.uid);
      }
      toast({ title: t('common.saved') });
      setIsAdding(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    return accounts
      ?.filter(a => a.parentId === parentId)
      .filter(a => searchTerm === "" || a.nameAr.includes(searchTerm) || a.code.includes(searchTerm))
      .map(account => {
        const isExpanded = expanded[account.id];

        return (
          <div key={account.id} className="select-none">
            <div 
              className={cn(
                "flex items-center gap-2 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-all border-b border-slate-50 group",
                account.isGroup ? "font-black text-slate-900" : "font-medium text-slate-600"
              )}
              style={{ paddingInlineStart: `${level * 24 + 12}px` }}
              onClick={() => account.isGroup ? toggleExpand(account.id) : openEditDialog(account)}
            >
              {account.isGroup ? (
                isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className={cn("h-4 w-4 text-slate-400", isRtl && "rotate-180")} />
              ) : (
                <div className="w-4" />
              )}
              
              {account.isGroup ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-blue-400" />}
              
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded font-black text-primary">{account.code}</span>
              <span className="text-xs truncate">{isRtl ? account.nameAr : account.nameEn}</span>
              
              <Badge variant="outline" className="ms-auto text-[8px] uppercase font-black border-2 h-5">
                {account.type}
              </Badge>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                {account.isGroup && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-primary"
                    onClick={(e) => { e.stopPropagation(); openAddDialog(account); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                {!account.isGroup && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-blue-600"
                    onClick={(e) => { e.stopPropagation(); openEditDialog(account); }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {(isExpanded || searchTerm !== "") && renderTree(account.id, level + 1)}
          </div>
        );
      });
  };

  const RequirementSelector = ({ label, field, icon: Icon }: { label: string, field: keyof NonNullable<Account['analyticalConfig']>, icon: any }) => (
    <div className="space-y-2">
       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
         <Icon className="h-3 w-3" /> {label}
       </Label>
       <Select 
         value={form.analyticalConfig?.[field as any] as string} 
         onValueChange={v => setForm({ ...form, analyticalConfig: { ...form.analyticalConfig!, [field]: v as AnalyticalRequirement } })}
       >
          <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl border-0 shadow-2xl z-[201]">
             <SelectItem value="not_allowed" className="text-xs font-bold">{tSafe('inline.not_allowed', 'غير مسموح', 'Not Allowed')}</SelectItem>
             <SelectItem value="optional" className="text-xs font-bold">{tSafe('inline.optional', 'اختياري', 'Optional')}</SelectItem>
             <SelectItem value="required" className="text-xs font-bold">{tSafe('inline.required', 'إلزامي', 'Required')}</SelectItem>
             <SelectItem value="auto" className="text-xs font-bold">{tSafe('inline.auto', 'تلقائي', 'Auto')}</SelectItem>
          </SelectContent>
       </Select>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <GitBranch className="h-7 w-7 text-primary" /> {t('chartOfAccounts')}
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{tSafe('accounting.coa.title', 'دليل الحسابات المعتمد للمنشأة', 'Chart of Accounts')}</p>
        </div>
        
        <div className="flex gap-3">
           <Button onClick={() => openAddDialog()} size="sm" className="h-10 px-6 font-black rounded-xl shadow-lg gap-2">
              <Plus className="h-4 w-4" /> {t('accounting.coa.addAccount')}
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <Card className="lg:col-span-8 rounded-[2rem] shadow-2xl border-0 bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-slate-50/50 p-6 border-b text-start">
            <div className="relative">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-12 h-12 rounded-2xl bg-white border-slate-200 text-lg font-bold" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 min-h-[600px]">
            {loading ? (
              <div className="py-40 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></div>
            ) : accounts?.length === 0 ? (
              <div className="py-32 text-center space-y-8">
                 <GitBranch className="h-24 w-24 text-slate-100 mx-auto" />
                 <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-400 italic">{t('accounting.coa.noAccounts')}</h3>
                 </div>
                 <Button onClick={handleInitCOA} disabled={initializing} className="h-16 px-12 rounded-2xl bg-primary text-white font-black shadow-xl border-b-8 border-orange-700">
                    {initializing ? <Loader2 className="animate-spin h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                    {t('accounting.coa.activateStandard')}
                 </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {renderTree(null)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl flex flex-col h-fit max-h-[95vh]" dir={dir}>
           <div className="bg-primary/5 p-8 text-slate-900 text-start border-b shrink-0">
              <DialogTitle className="text-2xl font-black font-headline flex items-center gap-4">
                 {form.id ? <Edit3 className="h-8 w-8 text-primary" /> : <Plus className="h-8 w-8 text-primary" />}
                 {form.id ? tSafe('inline.edit_account', 'تعديل الحساب', 'Edit Account') : t('accounting.coa.addAccount')}
              </DialogTitle>
           </div>
           
           <div className="p-8 space-y-8 text-start bg-white overflow-y-auto scrollbar-hide flex-1">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.code')}</Label>
                    <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono font-black text-xl text-primary" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('category')}</Label>
                    <Select value={form.type} onValueChange={(v: any) => setForm({...form, type: v})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-black text-base"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                          <SelectItem value="asset" className="font-bold py-3 border-b last:border-0">{isRtl ? 'أصول (Asset)' : 'Assets'}</SelectItem>
                          <SelectItem value="liability" className="font-bold py-3 border-b last:border-0">{isRtl ? 'التزامات (Liability)' : 'Liabilities'}</SelectItem>
                          <SelectItem value="equity" className="font-bold py-3 border-b last:border-0">{isRtl ? 'حقوق ملكية (Equity)' : 'Equity'}</SelectItem>
                          <SelectItem value="revenue" className="font-bold py-3 border-b last:border-0">{isRtl ? 'إيرادات (Revenue)' : 'Revenue'}</SelectItem>
                          <SelectItem value="expense" className="font-bold py-3 border-b last:border-0">{isRtl ? 'مصروفات (Expense)' : 'Expenses'}</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.nameAr')}</Label>
                    <Input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-lg" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.nameEn')}</Label>
                    <Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-lg text-start" dir="ltr" />
                 </div>
              </div>

              {form.type === 'expense' && (
                <div className="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-primary/20 space-y-4 animate-in fade-in">
                   <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> {tSafe('inline.expense_nature', 'طبيعة المصروف', 'Expense Nature')}
                   </Label>
                   <Select value={form.expenseNature} onValueChange={(v: any) => setForm({...form, expenseNature: v})}>
                      <SelectTrigger className="h-11 rounded-xl border-2 font-black bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                         <SelectItem value="direct" className="font-bold">{tSafe('inline.direct_cost', 'تكلفة مباشرة (مشروع)', 'Direct Project Cost')}</SelectItem>
                         <SelectItem value="administrative" className="font-bold">{tSafe('inline.admin_cost', 'تكلفة إدارية (عامة)', 'Administrative Cost')}</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
              )}

              {/* قسم إعدادات التحليل - المرحلة 2 */}
              {!form.isGroup && (
                <div className="space-y-6 pt-6 border-t">
                  <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                     <Settings2 className="h-5 w-5 text-primary" />
                     {tSafe('inline.analytical_settings', 'إعدادات التحليل والأبعاد الميدانية', 'Analytical Settings')}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <RequirementSelector label={tSafe('inline.cost_center', 'مركز التكلفة', 'Cost Center')} field="costCenter" icon={LayoutGrid} />
                     <RequirementSelector label={tSafe('inline.profit_center', 'مركز الربحية', 'Profit Center')} field="profitCenter" icon={DatabaseZap} />
                     <RequirementSelector label={tSafe('inline.project', 'المشروع', 'Project')} field="project" icon={Target} />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner">
                     <div className="space-y-1">
                        <Label className="font-black text-slate-800 text-sm">{tSafe('inline.distribution_allowed', 'السماح بالتوزيع المالي', 'Financial Distribution Allowed')}</Label>
                        <p className="text-[10px] font-bold text-slate-400">{tSafe('inline.dist_hint', 'يسمح بتقسيم قيمة القيد على عدة مراكز تكلفة', 'Allows splitting line amount across multiple centers')}</p>
                     </div>
                     <Switch 
                       checked={form.analyticalConfig?.distributionAllowed} 
                       onCheckedChange={v => setForm({ ...form, analyticalConfig: { ...form.analyticalConfig!, distributionAllowed: v } })} 
                     />
                  </div>
                </div>
              )}

              <div className="p-6 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner flex items-center justify-between">
                 <div className="space-y-1">
                    <Label className="font-black text-slate-800 text-sm">{t('accounting.coa.isGroup')}</Label>
                    <p className="text-[10px] font-bold text-slate-400">{t('accounting.coa.groupHint')}</p>
                 </div>
                 <Switch checked={form.isGroup} onCheckedChange={v => setForm({...form, isGroup: v})} />
              </div>
           </div>

           <DialogFooter className="p-8 bg-slate-50 border-t shrink-0">
              <Button onClick={handleSaveAccount} disabled={saving || !form.nameAr || !form.code} className="w-full h-16 rounded-[2rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all border-b-8 border-orange-700">
                 {saving ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                 {tSafe('inline.commit_account', 'اعتماد وحفظ الحساب', 'Save Account')}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
