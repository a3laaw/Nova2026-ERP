'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Building2, Image as ImageIcon, FileText, 
  Calendar as CalendarIcon, ArrowRight, Loader2,
  ShieldCheck, MapPin, CheckCircle2
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function CompanyProfilePage() {
  const { globalUser } = useAuthContext();
  const { company, loading: companyLoading } = useCompanyContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    commercialRegistry: '',
    address: '',
    licenseExpiryDate: '',
    laborAuthorityExpiryDate: '',
    logoUrl: '',
    headerText: '',
    footerText: '',
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        commercialRegistry: company.commercialRegistry || '',
        address: company.address || '',
        licenseExpiryDate: company.licenseExpiryDate || '',
        laborAuthorityExpiryDate: company.laborAuthorityExpiryDate || '',
        logoUrl: company.logoUrl || '',
        headerText: company.headerText || '',
        footerText: company.footerText || '',
      });
    }
  }, [company]);

  const handleSave = async () => {
    if (!db || !globalUser?.companyId) return;
    setSaving(true);
    try {
      const companyRef = doc(db, 'companies', globalUser.companyId);
      await updateDoc(companyRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      toast({ title: t('saved'), description: t('entryAdded') });
    } catch (error) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  if (companyLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/dashboard/settings')}
          className="rounded-xl h-10 w-10 bg-white shadow-sm border"
        >
          <ArrowRight className={cn("h-5 w-5", isRtl ? "rotate-0" : "rotate-180")} />
        </Button>
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Building2 className="h-10 w-10 text-primary" />
            {t('companyIdentity')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {t('manageCompanyData')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* البيانات الأساسية */}
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8">
              <CardTitle className="text-xl font-black font-headline flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                {t('companyProfile')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('name')}</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('commercialRegistry')}</Label>
                  <Input 
                    value={formData.commercialRegistry} 
                    onChange={e => setFormData({...formData, commercialRegistry: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('licenseExpiry')}</Label>
                  <Input 
                    type="date"
                    value={formData.licenseExpiryDate} 
                    onChange={e => setFormData({...formData, licenseExpiryDate: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 text-start" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('laborExpiry')}</Label>
                  <Input 
                    type="date"
                    value={formData.laborAuthorityExpiryDate} 
                    onChange={e => setFormData({...formData, laborAuthorityExpiryDate: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 text-start" 
                  />
                </div>
                <div className="md:col-span-2 space-y-2 text-start">
                  <Label className="font-black">{t('address')}</Label>
                  <Input 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50" 
                    placeholder={isRtl ? "شارع فهد السالم، برج..." : "Fahad Al-Salem St, Tower..."}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* الترويسة والتذييل */}
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-primary/5 border-b p-8 text-start">
              <CardTitle className="text-xl font-black font-headline flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-primary" />
                {t('logo')} & {isRtl ? 'المظهر' : 'Theming'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
               <div className="space-y-2 text-start">
                  <Label className="font-black">{t('logo')} (URL)</Label>
                  <Input 
                    value={formData.logoUrl} 
                    onChange={e => setFormData({...formData, logoUrl: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 text-start" 
                    dir="ltr"
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-start">
                    <Label className="font-black">{t('header')}</Label>
                    <Input 
                      value={formData.headerText} 
                      onChange={e => setFormData({...formData, headerText: e.target.value})} 
                      className="h-12 rounded-xl bg-slate-50/50" 
                    />
                  </div>
                  <div className="space-y-2 text-start">
                    <Label className="font-black">{t('footer')}</Label>
                    <Input 
                      value={formData.footerText} 
                      onChange={e => setFormData({...formData, footerText: e.target.value})} 
                      className="h-12 rounded-xl bg-slate-50/50" 
                    />
                  </div>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* الجانب الأيمن: معاينة وأزرار - تحديث للألوان الفاتحة */}
        <div className="space-y-8">
           <Card className="border-2 border-primary/10 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden p-8 text-center space-y-6">
              <div className="w-24 h-24 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black font-headline text-slate-900">{formData.name || t('name')}</h3>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-xs font-black uppercase mt-2">
                  {t('active')}
                </Badge>
              </div>
              <div className="pt-6 border-t border-slate-100 space-y-4">
                 <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-500 font-bold">{t('commercialRegistry')}</span>
                   <span className="font-mono font-black text-slate-700">{formData.commercialRegistry || '---'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-500 font-bold">{t('licenseExpiry')}</span>
                   <span className={cn("font-black", formData.licenseExpiryDate ? "text-primary" : "text-slate-400")}>
                     {formData.licenseExpiryDate || '---'}
                   </span>
                 </div>
              </div>
           </Card>

           <div className="space-y-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full h-16 rounded-[2rem] font-black text-lg bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
              >
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="me-2 h-6 w-6" />}
                {t('saveChanges')}
              </Button>
              <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 flex items-start gap-4">
                 <ShieldCheck className="h-6 w-6 text-amber-600 shrink-0" />
                 <p className="text-xs font-bold text-amber-800 leading-relaxed text-start">
                   {isRtl ? "تنبيه: سيتم استخدام هذه البيانات في كافة التقارير الرسمية والمستندات المولدة آلياً من النظام." : "Warning: This data will be used in all official reports and generated documents."}
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
