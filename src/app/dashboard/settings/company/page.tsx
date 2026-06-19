
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Image as ImageIcon, FileText, 
  ArrowRight, Loader2, ShieldCheck, CheckCircle2,
  UploadCloud, X
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
    headerImageUrl: '',
    footerImageUrl: '',
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

    // التحقق من حجم الملف (أقصى حد 500 كيلوبايت لتجنب حدود Firestore)
    if (file.size > 500 * 1024) {
      toast({
        variant: "destructive",
        title: isRtl ? "حجم الملف كبير جداً" : "File too large",
        description: isRtl ? "يرجى رفع صورة أقل من 500 كيلوبايت لضمان الأداء." : "Please upload an image smaller than 500KB."
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev: any) => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (field: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: '' }));
  };

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

  const ImageUploadBox = ({ label, field, currentImage, height = "h-32" }: { label: string, field: string, currentImage: string, height?: string }) => (
    <div className="space-y-2 text-start">
      <Label className="font-black text-xs uppercase tracking-widest text-slate-500">{label}</Label>
      <div className={cn(
        "relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 overflow-hidden group transition-all hover:border-primary/30",
        height
      )}>
        {currentImage ? (
          <>
            <img src={currentImage} alt={label} className="w-full h-full object-contain p-2" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 rounded-lg"
                onClick={() => removeImage(field)}
              >
                <X className="h-4 w-4 me-1" /> {isRtl ? 'حذف' : 'Remove'}
              </Button>
            </div>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
            <UploadCloud className="h-8 w-8 text-slate-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black text-slate-500">{isRtl ? 'اضغط للرفع' : 'Click to Upload'}</span>
            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, field)} />
          </label>
        )}
      </div>
    </div>
  );

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* بيانات الإدخال */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
              <CardTitle className="text-xl font-black font-headline flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                {t('companyProfile')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('name')}</Label>
                  <input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-12 w-full rounded-xl bg-slate-50/50 border border-input px-3" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('commercialRegistry')}</Label>
                  <input 
                    value={formData.commercialRegistry} 
                    onChange={e => setFormData({...formData, commercialRegistry: e.target.value})} 
                    className="h-12 w-full rounded-xl bg-slate-50/50 border border-input px-3" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('licenseExpiry')}</Label>
                  <input 
                    type="date"
                    value={formData.licenseExpiryDate} 
                    onChange={e => setFormData({...formData, licenseExpiryDate: e.target.value})} 
                    className="h-12 w-full rounded-xl bg-slate-50/50 border border-input px-3 text-start" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('laborExpiry')}</Label>
                  <input 
                    type="date"
                    value={formData.laborAuthorityExpiryDate} 
                    onChange={e => setFormData({...formData, laborAuthorityExpiryDate: e.target.value})} 
                    className="h-12 w-full rounded-xl bg-slate-50/50 border border-input px-3 text-start" 
                  />
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="font-black text-sm mb-6 text-primary uppercase tracking-widest">{isRtl ? 'المظهر والهوية البصرية' : 'Branding & Assets'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <ImageUploadBox label={t('logo')} field="logoUrl" currentImage={formData.logoUrl} />
                   <ImageUploadBox label={isRtl ? "صورة الهيدر" : "Header Image"} field="headerImageUrl" currentImage={formData.headerImageUrl} />
                   <ImageUploadBox label={isRtl ? "صورة الفوتر" : "Footer Image"} field="footerImageUrl" currentImage={formData.footerImageUrl} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* المعاينة الحية */}
        <div className="lg:col-span-4 space-y-8">
           <Card className="border-2 border-primary/10 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col min-h-[600px]">
              {/* Header Preview */}
              <div className="h-24 bg-slate-50 border-b relative flex items-center justify-center overflow-hidden">
                {formData.headerImageUrl ? (
                   <img src={formData.headerImageUrl} className="w-full h-full object-cover" alt="Header" />
                ) : (
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{isRtl ? 'معاينة الهيدر' : 'Header Preview'}</span>
                )}
              </div>

              <div className="flex-1 p-8 text-center flex flex-col justify-center space-y-6">
                <div className="w-24 h-24 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden shadow-inner">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-black font-headline text-slate-900">{formData.name || t('name')}</h3>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-xs font-black uppercase mt-2">
                    {t('active')}
                  </Badge>
                </div>
                
                <div className="space-y-3 pt-6 border-t border-slate-100">
                   <div className="flex justify-between items-center text-[10px] font-bold">
                     <span className="text-slate-400 uppercase">{t('commercialRegistry')}</span>
                     <span className="font-mono text-slate-800">{formData.commercialRegistry || '---'}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-bold">
                     <span className="text-slate-400 uppercase">{t('licenseExpiry')}</span>
                     <span className="text-primary">{formData.licenseExpiryDate || '---'}</span>
                   </div>
                </div>
              </div>

              {/* Footer Preview */}
              <div className="h-16 bg-slate-50 border-t relative flex items-center justify-center overflow-hidden">
                {formData.footerImageUrl ? (
                   <img src={formData.footerImageUrl} className="w-full h-full object-cover" alt="Footer" />
                ) : (
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{isRtl ? 'معاينة الفوتر' : 'Footer Preview'}</span>
                )}
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
                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed text-start">
                   {isRtl ? "ملاحظة: الصور المرفوعة ستظهر تلقائياً في ترويسة وتذييل كافة التقارير الرسمية والمخاطبات الصادرة من النظام." : "Note: Uploaded images will automatically appear in the headers and footers of all official reports and communications."}
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
