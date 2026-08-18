'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  GitBranch, Plus, Loader2, Folder, 
  FileText, Search, ChevronRight, ChevronDown,
  Save, Landmark, Sparkles, DatabaseZap,
  RotateCcw, Trash2, FolderOpen, CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Account } from '@/types/accounting';
import { cn } from '@/lib/utils';
import { AccountingService } from '@/services/accounting-service';
import { SeedService } from '@/services/seed-service';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function ChartOfAccountsPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const [form, setForm] = useState<Partial<Account>>({
    nameAr: '', nameEn: '', code: '', type: 'asset', isGroup: false, parentId: ""
  });

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const { data: accounts, loading } = useCollection<Account>(accountsQuery);

  const handleSaveAccount = async () => {
    if (!db || !companyId || !user || !form.nameAr || !form.nameEn || !form.code) return;
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
      setForm({ nameAr: '', nameEn: '', code: '', type: 'asset', isGroup: false, parentId: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally { setSaving(false); }
  };

  const handleSeedCOA = async () => {
    if (!db || !companyId || !user) return;
    setSeeding(true);
    try {
      const seedService = new SeedService(db, companyId);
      await seedService.seedConstructionCOA(user.uid);
      toast({ title: tSafe('inline.coa.activated', 'تم تفعيل الشجرة الهرمية بنجاح', 'COA Activated') });
      setShowSeedConfirm(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setSeeding(false);
    }
  };

  const handlePurgeCOA = async () => {
    if (!db || !companyId) return;
    setPurging(true);
    try {
      const seedService = new SeedService(db, companyId);
      await seedService.purgeCOA();
      toast({ title: isRtl ? 'تم تنظيف الدليل' : 'COA Purged' });
      setShowPurgeConfirm(false);
    } catch (e: any) {
       toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setPurging(false);
    }
  };

  const handleAddSubAccount = async (parent: Account, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db || !companyId) return;
    
    const service = new AccountingService(db, companyId);
    const nextCode = await service.getNextAccountCode(parent.id);

    setForm({
      nameAr: '', 
      nameEn: '', 
      code: nextCode, 
      type: parent.type, 
      isGroup: false, 
      parentId: parent.id 
    });
    setIsAdding(true);
  };

  const renderTree = (parentId: string | "" = "", level = 0) => {
    return (accounts || [])
      .filter(a => (a.parentId || "") === parentId)
      .filter(a => {
        if (searchTerm === "") return true;
        return (
          a.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
          a.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.code.includes(searchTerm)
        );
      })
      .map(account => {
        const hasChildren = accounts?.some(child => child.parentId === account.id);
        const isExpanded = expanded[account.id] || searchTerm !== "";

        return (
          <div key={account.id} className="select-none">
            <div 
              className={cn(
                "flex items-center justify-between p-2.5 hover:bg-primary/5 rounded-xl cursor-pointer transition-all border-b border-slate-50 group", 
                (account.isGroup || hasChildren) ? "font-black text-slate-900" : "font-medium text-slate-600"
              )} 
              style={{ paddingInlineStart: `${level * 24 + 12}px` }} 
              onClick={() => {
                if (hasChildren || account.isGroup) {
                  setExpanded(prev => ({...prev, [account.id]: !prev[account.id]}));
                } else {
                  setForm(account);
                  setIsAdding(true);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {(account.isGroup || hasChildren) ? (
                    <div className="p-1 hover:bg-primary/10 rounded-md transition-colors">
                       {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />}
                    </div>
                  ) : <div className="w-6" />}
                  
                  {(account.isGroup || hasChildren) ? (
                     isExpanded ? <FolderOpen className="h-4 w-4 text-primary fill-current opacity-20" /> : <Folder className="h-4 w-4 text-amber-500 fill-current opacity-40" />
                  ) : <FileText className="h-4 w-4 text-blue-400 opacity-60" />}
                </div>
                
                <span className="text-[10px] font-black font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 uppercase tracking-tighter">
                  {account.code}
                </span>
                
                <div className="flex flex-col text-start">
                   <span className="text-sm truncate">{account.nameAr}</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{account.nameEn}</span>
                </div>
              </div>
              
              <div className="ms-auto flex items-center gap-2">
                <button 
                  onClick={(e) => handleAddSubAccount(account, e)}
                  className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-emerald-100 hover:bg-emerald-600 hover:text-white"
                  title={isRtl ? 'إضافة حساب فرعي' : 'Add Sub-Account'}
                >
                   <Plus className="h-4 w-4" />
                </button>
                <Badge variant="outline" className="text-[8px] font-black border-2 h-5 bg-white opacity-40 group-hover:opacity-100 uppercase">
                  {account.type}
                </Badge>
              </div>
            </div>
            {isExpanded && renderTree(account.id, level + 1)}
          </div>
        );
      });
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-[1600px] mx-auto text-start" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start space-y-1">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
             <GitBranch className="h-7 w-7 text-primary" /> {t('chartOfAccounts')}
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sovereign Financial Registry V3.2</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowPurgeConfirm(true)} variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 border-2 border-transparent hover:border-rose-100 transition-all">
             <Trash2 className="h-5 w-5" />
          </Button>
          <Button 
            onClick={() => setShowSeedConfirm(true)} 
            disabled={seeding}
            variant="outline"
            className="h-10 px-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-black gap-2 shadow-sm hover:bg-emerald-100 transition-all"
          >
             {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
             {isRtl ? 'تنشيط الشجرة الهرمية' : 'Activate Hierarchy'}
          </Button>
          <Button onClick={async () => { 
            const service = new AccountingService(db!, companyId!);
            const nextRoot = await service.getNextAccountCode(null);
            setForm({ nameAr: '', nameEn: '', code: nextRoot, type: 'asset', isGroup: false, parentId: "" }); 
            setIsAdding(true); 
          }} size="sm" className="h-10 px-8 font-black rounded-xl shadow-lg gap-2">
            <Plus className="h-4 w-4" /> {isRtl ? 'إضافة حساب جذري' : 'Add Root Account'}
          </Button>
        </div>
      </header>

      <Card className="rounded-[2rem] shadow-2xl border-0 bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 p-6 border-b text-start">
          <div className="relative max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input 
              placeholder={isRtl ? "بحث بالاسم أو الكود..." : "Search name or code..."} 
              className="ps-11 h-10 rounded-xl bg-white border-2 border-slate-100 font-bold" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 min-h-[600px]">
          {loading ? (
            <div className="py-40 text-center flex flex-col items-center gap-4">
               <Loader2 className="animate-spin h-10 w-10 text-primary/20" />
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Loading Chart...</p>
            </div>
          ) : (!accounts || accounts.length === 0) ? (
             <div className="py-40 text-center space-y-6 opacity-30">
                <DatabaseZap className="h-20 w-20 mx-auto text-slate-200" />
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-slate-400">{isRtl ? 'لا توجد حسابات مسجلة' : 'No Accounts Found'}</h3>
                   <p className="text-xs font-bold text-slate-300">{isRtl ? 'يرجى تنزيل الشجرة القياسية أو إضافة حساب يدوي للبدء.' : 'Please seed standard COA or add manually.'}</p>
                </div>
             </div>
          ) : renderTree("")}
        </CardContent>
      </Card>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="rounded-xl p-0 overflow-hidden max-w-xl bg-white border-0 shadow-3xl" dir={dir}>
           <div className="bg-primary/5 p-8 border-b text-start shrink-0">
              <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                 <Landmark className="h-6 w-6 text-primary" /> 
                 {form.parentId ? (isRtl ? 'إضافة حساب فرعي' : 'Add Sub-Account') : (form.id ? t('common.edit') : t('newDept'))}
              </DialogTitle>
           </div>
           <div className="p-8 space-y-6 text-start">
              {form.parentId && (
                <div className="p-4 bg-slate-50 border-2 border-dashed rounded-xl mb-2">
                   <Label className="text-[9px] font-black text-slate-400 uppercase">الحساب الأب</Label>
                   <p className="font-bold text-sm text-slate-700">
                     {accounts?.find(a => a.id === form.parentId)?.nameAr}
                   </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">كود الحساب</Label>
                    <Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="h-10 border-2 font-mono font-black" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">نوع الحساب</Label>
                    <Select disabled={!!form.parentId} value={form.type} onValueChange={(v: any) => setForm({...form, type: v})}>
                       <SelectTrigger className="h-10 border-2 font-bold"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl border-2 z-[200] max-h-[300px] overflow-y-auto">
                          <SelectItem value="asset" className="font-bold">أصول (Asset)</SelectItem>
                          <SelectItem value="liability" className="font-bold">خصوم (Liability)</SelectItem>
                          <SelectItem value="equity" className="font-bold">حقوق ملكية (Equity)</SelectItem>
                          <SelectItem value="revenue" className="font-bold">إيرادات (Revenue)</SelectItem>
                          <SelectItem value="expense" className="font-bold">مصروفات (Expense)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">الاسم الكامل (Ar)</Label>
                  <Input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="h-10 border-2 font-black bg-slate-50/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Full Name (En)</Label>
                  <Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-10 border-2 font-bold text-start bg-slate-50/50" dir="ltr" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border-2">
                 <div className="space-y-0.5">
                    <Label className="font-black text-sm">{isRtl ? 'حساب رئيسي (مجموعة)' : 'Is Group Account?'}</Label>
                    <p className="text-[9px] text-slate-400 font-bold">الحسابات الرئيسية لا تستخدم في تسجيل القيود</p>
                 </div>
                 <Switch checked={form.isGroup} onCheckedChange={v => setForm({...form, isGroup: v})} />
              </div>

              <Button onClick={handleSaveAccount} disabled={saving || !form.nameAr || !form.nameEn || !form.code} className="w-full h-12 rounded-xl bg-primary text-white font-black shadow-xl border-b-4 border-orange-700 hover:scale-[1.02] transition-all gap-3">
                 {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} {t('common.save')}
              </Button>
           </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-emerald-50/50">
                  <Sparkles className="h-12 w-12" />
               </div>
               <AlertDialogTitle className="text-start font-black text-2xl font-headline text-slate-900 leading-tight">
                 {isRtl ? 'تنشيط البنية التحتية المالية' : 'Activate Financial Infrastructure'}
               </AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {isRtl 
                    ? 'هل تريد تنزيل شجرة الحسابات القياسية؟ سيتم بناء الهيكل الهرمي آلياً وتأسيس مراكز التكلفة والربحية الإدارية اللازمة لضمان جاهزية النظام فوراً.' 
                    : 'Download standard COA? Hierarchy and administrative centers will be auto-provisioned.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white" onClick={() => setShowSeedConfirm(false)}>{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction 
                 onClick={handleSeedCOA} 
                 disabled={seeding}
                 className="flex-[2] h-14 rounded-2xl font-black bg-emerald-600 text-white shadow-xl shadow-emerald-100"
               >
                  {seeding ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 me-2" />} {isRtl ? 'تنشيط الآن' : 'Activate Now'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPurgeConfirm} onOpenChange={setShowPurgeConfirm}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <RotateCcw className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{tSafe('inline.confirm.purge.coa', 'تطهير دليل الحسابات', 'Purge Chart of Accounts')}</AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {isRtl 
                    ? 'تحذير: هذا الإجراء سيقوم بمسح كافة الحسابات الحالية لإعادة بنائها بشكل هرمي سليم. لن يتأثر تاريخ القيود السابقة، ولكنها ستفقد ربطها بالدليل. هل أنت متأكد؟' 
                    : 'Warning: This will delete all current accounts to rebuild them hierarchically. Proceed?'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white" onClick={() => setShowPurgeConfirm(false)}>{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction 
                 onClick={handlePurgeCOA} 
                 disabled={purging}
                 className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 text-white shadow-xl"
               >
                  {purging ? <Loader2 className="animate-spin h-5 w-5" /> : tSafe('inline.purge.now', 'مسح الدليل الآن', 'Purge Now')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}