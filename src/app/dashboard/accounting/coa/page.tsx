
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, Plus, Loader2, Folder, 
  FileText, Search, ChevronRight, ChevronDown,
  ShieldCheck 
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Account } from '@/types/accounting';
import { cn } from '@/lib/utils';

export default function ChartOfAccountsPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const { data: accounts, loading } = useCollection<Account>(accountsQuery);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
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
                "flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all border-b border-slate-50",
                account.isGroup ? "font-black text-slate-900" : "font-medium text-slate-600"
              )}
              style={{ paddingInlineStart: `${level * 24 + 8}px` }}
              onClick={() => account.isGroup && toggleExpand(account.id)}
            >
              {account.isGroup ? (
                isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className={cn("h-4 w-4 text-slate-400", isRtl && "rotate-180")} />
              ) : (
                <div className="w-4" />
              )}
              
              {account.isGroup ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-blue-400" />}
              
              <span className="text-[10px] font-mono bg-slate-100 px-1.5 rounded text-slate-400">{account.code}</span>
              <span className="text-xs">{isRtl ? account.nameAr : account.nameEn}</span>
              
              <Badge variant="outline" className="ms-auto text-[8px] uppercase h-4 px-1.5 opacity-40">
                {account.type}
              </Badge>
            </div>
            
            {(isExpanded || searchTerm !== "") && renderTree(account.id, level + 1)}
          </div>
        );
      });
  };

  return (
    <div className="space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <GitBranch className="h-6 w-6 text-primary" /> {isRtl ? 'دليل الحسابات' : 'Chart of Accounts'}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">إدارة الهيكل المالي الشجري للمنشأة</p>
        </div>
        <Button size="sm" className="h-9 px-6 font-bold gap-2">
           <Plus className="h-4 w-4" /> {isRtl ? 'إضافة حساب' : 'Add Account'}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 rounded-lg shadow-sm border bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 p-4 border-b">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder={t('search')} 
                className="ps-10 h-9 bg-white" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-2 min-h-[500px]">
            {loading ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
            ) : (
              <div className="border rounded-xl overflow-hidden bg-white">
                {renderTree(null)}
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="lg:col-span-4 space-y-4">
           <Card className="rounded-lg shadow-sm border-2 border-primary/10 bg-primary/5 p-6 text-start">
              <h3 className="font-black text-sm mb-2 flex items-center gap-2 text-primary">
                 <ShieldCheck className="h-4 w-4" /> السيادة المالية
              </h3>
              <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                 هذا الدليل مصمم وفقاً لمعايير المحاسبة الدولية (IFRS). لا يسمح بحذف الحسابات التي تحتوي على حركات مالية مسجلة، بل يمكن تجميدها فقط لضمان سلامة الأرشيف.
              </p>
           </Card>
        </aside>
      </div>
    </div>
  );
}
