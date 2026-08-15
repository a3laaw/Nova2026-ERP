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
  Target, LayoutGrid, Settings2, Edit3, History,
  Check
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
import { Checkbox } from "@/components/ui/checkbox";

export default function ChartOfAccountsPage() {
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, dir, isRtl, lang } = useLanguage();
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
    allowedPaymentMethods: [],
    analyticalConfig: { costCenter: 'not_allowed', profitCenter: 'not_allowed', project: 'not_allowed', distributionAllowed: false }
  });

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const { data: accounts, loading } = useCollection<Account>(accountsQuery);
  const { data: paymentMethods } = useCollection<any>(companyId && db ? query(collection(db, paths.paymentMethods(companyId)), orderBy('order')) : null);

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
    } finally { setSaving(false); }
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    return accounts
      ?.filter(a => a.parentId === parentId)
      .filter(a => searchTerm === "" || a.nameAr.includes(searchTerm) || a.code.includes(searchTerm))
      .map(account => {
        const isExpanded = expanded[account.id];
        return (
          <div key={account.id} className="select-none">
            <div className={cn("flex items-center gap-2 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-all border-b border-slate-50 group", account.isGroup ? "font-black text-slate-900" : "font-medium text-slate-600")} style={{ paddingInlineStart: `${level * 24 + 12}px` }} onClick={() => account.isGroup ? setExpanded(prev => ({...prev, [account.id]: !prev[account.id]})) : setIsAdding(true)}>
              {account.isGroup ? (isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className={cn("h-4 w-4 text-slate-400", isRtl && "rotate-180")} />) : <div className="w-4" />}
              {account.isGroup ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-blue-400" />}
              <span className="text-[10px] font-black font-mono text-primary bg-slate-100 px-2 py-0.5 rounded uppercase">{account.code}</span>
              <span className="text-xs truncate">{tSafe('data.account.name', account.nameAr, account.nameEn)}</span>
              <Badge variant="outline" className="ms-auto text-[8px] uppercase font-black border-2 h-5">{account.type}</Badge>
            </div>
            {(isExpanded || searchTerm !== "") && renderTree(account.id, level + 1)}
          </div>
        );
      });
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900"><GitBranch className="h-7 w-7 text-primary" /> {t('chartOfAccounts')}</h1>
        </div>
        <Button onClick={() => setIsAdding(true)} size="sm" className="h-10 px-6 font-black rounded-xl shadow-lg gap-2"><Plus className="h-4 w-4" /> {tSafe('inline.add.account', 'إضافة حساب', 'Add Account')}</Button>
      </header>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <Card className="lg:col-span-12 rounded-[2rem] shadow-2xl border-0 bg-white overflow-hidden ring-1 ring-black/5">
          <CardHeader className="bg-slate-50/50 p-6 border-b text-start">
            <div className="relative max-w-md"><Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><Input placeholder={t('common.search')} className="ps-12 h-10 rounded-xl bg-white border-2" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          </CardHeader>
          <CardContent className="p-4 min-h-[600px]">
            {loading ? <div className="py-40 text-center"><Loader2 className="animate-spin h-12 w-12 text-primary/20 mx-auto" /></div> : renderTree(null)}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-2xl bg-white" dir={dir}>
           <div className="bg-primary/5 p-8 border-b text-start"><DialogTitle className="text-xl font-black">{tSafe('inline.edit_account', 'إعداد حساب مالي', 'Manage Account')}</DialogTitle></div>
           <div className="p-8 space-y-6 text-start">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">الكود</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="h-10 border-2 font-mono" /></div>
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">النوع</Label><Select value={form.type} onValueChange={(v: any) => setForm({...form, type: v})}><SelectTrigger className="h-10 border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-2 z-[200]"><SelectItem value="asset" className="font-bold">أصول</SelectItem><SelectItem value="liability" className="font-bold">خصوم</SelectItem><SelectItem value="revenue" className="font-bold">إيرادات</SelectItem><SelectItem value="expense" className="font-bold">مصروفات</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">الاسم (Ar)</Label><Input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="h-11 border-2 font-bold" /></div>
              <Button onClick={handleSaveAccount} disabled={saving} className="w-full h-12 rounded-2xl bg-primary text-white font-black shadow-xl border-b-4 border-orange-700">{saving ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5 me-2" />} {t('common.save')}</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}