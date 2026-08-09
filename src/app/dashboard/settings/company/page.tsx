'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, FileText, Loader2, Save, 
  UploadCloud, X
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CompanyProfilePage() {
  const { globalUser } = useAuthContext();
  const { company, loading: companyLoading } = useCompanyContext();
  const { t, dir, isRtl } = useLanguage();
  const db = useFirestore();

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '', commercialRegistry: '', address: '', logoUrl: '', 
    headerImageUrl: '', footerImageUrl: '', headerText: '', footerText: '',
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        commercialRegistry: (company as any).commercialRegistry || '',
        address: (company as any).address || '',
        logoUrl: (company as any).logoUrl || '',
        headerImageUrl: (company as any).headerImageUrl || '',
        footerImageUrl: (company as any).footerImageUrl || '',
        headerText: (company as any).headerText || '',
        footerText: (company as any).footerText || '',
      });
    }
  }, [company]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast({ variant: "destructive", title: t('common.error'), description: isRtl ? "يرجى رفع صورة أقل من 1 ميجابايت." : "Image must be under 1MB." });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFormData((prev: any) => ({ ...prev, [field]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!db || !globalUser?.companyId) return;
    setSaving(true);
    try {
      const companyRef = doc(db, 'companies', globalUser.companyId);
      await updateDoc(companyRef, { ...formData, updatedAt: serverTimestamp() });
      toast({ title: t('common.saved') });
    } catch (error) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally { setSaving(false); }
  };

  if (companyLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3"><Building2 className="h-10 w-10 text-primary" /> {t('companyIdentity')}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic text-start">{t('manageCompanyData')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 text-start"><CardTitle className="text-lg font-black font-headline flex items-center gap-2 text-slate-800"><FileText className="h-5 w-5 text-primary" /> {t('companyProfile')}</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-8 text-start">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><Label className="font-black text-xs text-slate-400 uppercase tracking-widest">{t('common.name')}</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-black" /></div>
                <div className="space-y-2"><Label className="font-black text-xs text-slate-400 uppercase tracking-widest">{isRtl ? 'السجل التجاري' : 'Registry'}</Label><Input value={formData.commercialRegistry} onChange={e => setFormData({...formData, commercialRegistry: e.target.value})} className="h-12 rounded-xl border-2 font-black" /></div>
              </div>
              <div className="flex justify-end pt-4">
                 <Button onClick={handleSave} disabled={saving} className="h-14 rounded-2xl px-12 font-black text-lg gap-3 shadow-xl">{saving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}{t('common.save')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
