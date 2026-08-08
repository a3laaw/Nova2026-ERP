'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, Plus, Loader2, Folder, 
  FileText, Search, ChevronRight, ChevronDown,
  ShieldCheck, Sparkles, DatabaseZap, X, Save
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Account, AccountType } from '@/types/accounting';
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
  const { t, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [initializing, setInitializing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<Account>>({
    nameAr: '', nameEn: '', code: '', type: 'asset', isGroup: false, parentId: null
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
      toast({ title: isRtl ? "تمت تهيئة الدليل بنجاح" : "COA Initialized" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
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
      level: parent ? parent.level + 1 : 1
    });
    setIsAdding(true);
  };

  const handleSaveAccount = async () => {
    if (!db || !companyId || !user || !form.nameAr || !form.code) return;
    setSaving(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createAccount(form, user.uid);
      toast({ title: t('saved') });
      setIsAdding(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    return accounts
      ?.filter(a => a.parentId === parentId)
      .filter(a => searchTerm === "" || a.nameAr.includes(searchTerm) || a.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) || a.code.includes(searchTerm))
      .map(account => {
        const hasChildren = accounts.some(a => a.parentId === account.id);
        const isExpanded = expanded[account.id];

        return (
          <div key={account.id} className="select-none">
            <div 
              className={cn(
                "flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all border-b border-slate-50 group",
                account.isGroup ? "font-black text-slate-900" : "font-medium text-slate-600"
              )}
              style={{ paddingInlineStart: `${level * 24 + 8}px` }}
              onClick={() => account.isGroup && toggleExpand(account.id)}
            >
              {account.isGroup ? (
                isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className={cn("h-3.5 w-3.5 text-slate-400", isRtl && "rotate-180")} />
              ) : (
                <div className="w-3.5" />
              )}
              
              {account.isGroup ? <Folder className="h-3.5 w-3.5 text-amber-500" /> : <FileText className="h-3.5 w-3.5 text-blue-400" />}
              
              <span className="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{account.code}</span>
              <span className="text-xs truncate">{isRtl ? account.nameAr : account.nameEn}</span>
              
              <Badge variant="outline" className="ms-auto text-[7px] uppercase h-4 px-1 opacity-40">
                {account.type}
              </Badge>

              {account.isGroup && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-md text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                  onClick={(e) => { e.stopPropagation(); openAddDialog(account); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {(isExpanded || searchTerm !== "") && renderTree(account.id, level + 1)}
          </div>
        );
      });
  };

  return (
    <div className="space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <GitBranch className="h-6 w-6 text-primary" /> {isRtl ? 'دليل الحسابات السيادي' : 'Sovereign COA'}
          </h1>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">Hierarchical Financial Architecture</p>
        </div>
        
        <div className="flex gap-2">
           {accounts?.length === 0 && (
              <Button 
                onClick={handleInitCOA} 
                disabled={initializing}
                variant="outline" 
                size="sm" 
                className="h-9 px-4 font-black border-primary text-primary hover:bg-primary/5 gap-2 shadow-xl animate-pulse"
              >
                {initializing ? <Loader2 className="animate-spin h-4 w-4" /> : <DatabaseZap className="h-4 w-4" />}
                {isRtl ? 'تهيئة الدليل الإنشائي' : 'Init Construction COA'}
              </Button>
           )}
           <Button onClick={() => openAddDialog()} size="sm" className="h-9 px-6 font-bold gap-2">
              <Plus className="h-4 w-4" /> {isRtl ? 'حساب رئيسي' : 'Add Root Account'}
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 rounded-xl shadow-sm border bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 p-4 border-b text-start">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input 
                placeholder={t('search')} 
                className="ps-10 h-9 bg-white border-slate-200" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-2 min-h-[500px]">
            {loading ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
            ) : accounts?.length === 0 ? (
              <div className="py-20 text-center space-y-6">
                 <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-200">
                    <GitBranch className="h-10 w-10" />
                 </div>
                 <div className="space-y-2">
                    <h3 className="font-black text-slate-400">{isRtl ? 'الدليل المحاسبي فارغ' : 'COA is Empty'}</h3>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto font-bold">ابدأ بتهيئة الدليل الإنشائي الكويتي المعتمد للبدء فوراً.</p>
                 </div>
                 <Button 
                   onClick={handleInitCOA} 
                   disabled={initializing}
                   className="h-12 px-8 rounded-xl font-black gap-2"
                 >
                    <Sparkles className="h-5 w-5" /> {isRtl ? 'تفعيل الدليل الإنشائي' : 'Activate Construction COA'}
                 </Button>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden bg-white">
                {renderTree(null)}
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="lg:col-span-4 space-y-4 text-start">
           <Card className="rounded-xl shadow-sm border-2 border-primary/10 bg-primary/5 p-6 space-y-3">
              <h3 className="font-black text-xs mb-2 flex items-center gap-2 text-primary uppercase tracking-widest">
                 <ShieldCheck className="h-4 w-4" /> المحاسبة السيادية
              </h3>
              <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                 "لا يسمح بتفريع أي حسابات تحت حسابات الحركة (Leaf Nodes) لضمان سلامة ميزان المراجعة. يمكنك فقط إضافة حسابات تحت المجموعات (Groups)."
              </p>
           </Card>
           
           <Card className="rounded-xl shadow-sm border bg-white p-6 space-y-4">
              <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">مفاتيح الدليل الموحد</h3>
              <div className="space-y-2.5">
                 <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" /> <span className="text-[10px] font-black uppercase">1 - الأصول (Assets)</span></div>
                 <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> <span className="text-[10px] font-black uppercase">2 - الالتزامات (Liabilities)</span></div>
                 <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /> <span className="text-[10px] font-black uppercase">3 - حقوق الملكية (Equity)</span></div>
                 <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500" /> <span className="text-[10px] font-black uppercase">4 - الإيرادات (Revenue)</span></div>
                 <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500" /> <span className="text-[10px] font-black uppercase">5 - المصروفات (Expenses)</span></div>
              </div>
           </Card>
        </aside>
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
           <div className="bg-slate-50 p-6 border-b text-start">
              <DialogTitle className="text-lg font-black flex items-center gap-3">
                 <Plus className="h-5 w-5 text-primary" />
                 {isRtl ? 'إضافة حساب جديد' : 'Add New Account'}
              </DialogTitle>
           </div>
           
           <div className="p-8 space-y-6 text-start">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{t('code')}</Label>
                    <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-10 border-2 font-mono font-black text-primary" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'النوع' : 'Type'}</Label>
                    <Select value={form.type} onValueChange={(v: any) => setForm({...form, type: v})}>
                       <SelectTrigger className="h-10 border-2 font-bold"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="asset" className="font-bold">أصول (Asset)</SelectItem>
                          <SelectItem value="liability" className="font-bold">التزامات (Liability)</SelectItem>
                          <SelectItem value="equity" className="font-bold">حقوق ملكية (Equity)</SelectItem>
                          <SelectItem value="revenue" className="font-bold">إيرادات (Revenue)</SelectItem>
                          <SelectItem value="expense" className="font-bold">مصروفات (Expense)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم الحساب (عربي)' : 'Name (AR)'}</Label>
                    <Input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="h-11 border-2 font-bold" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم الحساب (English)' : 'Name (EN)'}</Label>
                    <Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-11 border-2 font-bold text-start" dir="ltr" />
                 </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-100 flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label className="font-black text-xs text-slate-800">{isRtl ? 'حساب مجموعة؟' : 'Is it a Group?'}</Label>
                    <p className="text-[9px] font-bold text-slate-400">{isRtl ? 'تفعيل هذا الخيار يسمح بإضافة حسابات فرعية تحته.' : 'Enable to allow children accounts.'}</p>
                 </div>
                 <Switch checked={form.isGroup} onCheckedChange={v => setForm({...form, isGroup: v})} />
              </div>
           </div>

           <DialogFooter className="p-6 bg-slate-50 border-t">
              <Button onClick={handleSaveAccount} disabled={saving || !form.nameAr || !form.code} className="w-full h-12 rounded-xl font-black gap-2 shadow-lg shadow-primary/20 border-b-4 border-orange-700">
                 {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                 {isRtl ? 'اعتماد الحساب' : 'Commit Account'}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
