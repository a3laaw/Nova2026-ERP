'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Building2, Image as ImageIcon, FileText, 
  ArrowRight, Loader2, ShieldCheck, CheckCircle2,
  UploadCloud, X, Link as LinkIcon
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
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        commercialRegistry: (company as any).commercialRegistry || '',
        address: (company as any).address || '',
        licenseExpiryDate: (company as any).licenseExpiryDate || '',
        laborAuthorityExpiryDate: (company as any).laborAuthorityExpiryDate || '',
        logoUrl: (company as any).logoUrl || '',
        headerImageUrl: (company as any).headerImageUrl || '',
        footerImageUrl: (company as any).footerImageUrl || '',
      });
    }
  }, [company]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const AssetManager = ({ label, field, currentImage, height = "h-32" }: { label: string, field: string, currentImage: string, height?: string }) => (
    <div className="space-y-4">
      <Label className="font-black text-xs uppercase tracking-widest text-slate-500">{label}</Label>
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="upload" className="rounded-lg text-[10px] font-bold gap-2">
            <UploadCloud className="h-3 w-3" /> {isRtl ? 'رفع صورة' : 'Upload'}
          </TabsTrigger>
          <TabsTrigger value="url" className="rounded-lg text-[10px] font-bold gap-2">
            <LinkIcon className="h-3 w-3" /> {isRtl ? 'رابط خارجي' : 'Image URL'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="mt-4">
          <div className={cn(
            "relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 overflow-hidden group transition-all hover:border-primary/30",
            height
          )}>
            {currentImage && currentImage.startsWith('data:') ? (
              <>
                <img src={currentImage} alt={label} className="w-full h-full object-contain p-2" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="destructive" size="sm" onClick={() => setFormData({...formData, [field]: ''})}>
                    <X className="h-4 w-4 me-1" /> {isRtl ? 'حذف' : 'Remove'}
                  </Button>
                </div>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-[10px] font-black text-slate-500">{isRtl ? 'اضغط للرفع' : 'Click to Upload'}</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, field)} />
              </label>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <div className="space-y-2">
            <Input 
              value={(!currentImage || currentImage.startsWith('data:')) ? '' : currentImage}
              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
              placeholder="https://example.com/image.png"
              className="h-10 rounded-xl text-[10px] font-mono"
              dir="ltr"
            />
            {currentImage && !currentImage.startsWith('data:') && (
               <div className={cn("rounded-xl border bg-slate-50 overflow-hidden flex items-center justify-center", height)}>
                  <img src={currentImage} alt="Preview" className="max-h-full max-w-full object-contain p-2" />
               </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
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
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
              <CardTitle className="text-xl font-black font-headline flex items-center gap-2 text-slate-800">
                <FileText className="h-6 w-6 text-primary" />
                {t('companyProfile')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 text-start">
                  <Label className="font-black text-slate-700">{t('name')}</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-slate-700">{t('commercialRegistry')}</Label>
                  <Input 
                    value={formData.commercialRegistry} 
                    onChange={e => setFormData({...formData, commercialRegistry: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-slate-700">{t('licenseExpiry')}</Label>
                  <Input 
                    type="date"
                    value={formData.licenseExpiryDate} 
                    onChange={e => setFormData({...formData, licenseExpiryDate: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white text-start" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-slate-700">{t('laborExpiry')}</Label>
                  <Input 
                    type="date"
                    value={formData.laborAuthorityExpiryDate} 
                    onChange={e => setFormData({...formData, laborAuthorityExpiryDate: e.target.value})} 
                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white text-start" 
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                <h3 className="font-black text-sm mb-8 text-primary uppercase tracking-widest">{isRtl ? 'المظهر والهوية البصرية' : 'Branding & Assets'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <AssetManager label={t('logo')} field="logoUrl" currentImage={formData.logoUrl} />
                   <AssetManager label={isRtl ? "صورة الهيدر" : "Header Image"} field="headerImageUrl" currentImage={formData.headerImageUrl} />
                   <AssetManager label={isRtl ? "صورة الفوتر" : "Footer Image"} field="footerImageUrl" currentImage={formData.footerImageUrl} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-2 border-primary/10 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col min-h-[600px] ring-1 ring-black/5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="h-28 bg-slate-50 border-b relative flex items-center justify-center overflow-hidden shadow-inner">
                {formData.headerImageUrl ? (
                   <img src={formData.headerImageUrl} className="w-full h-full object-contain" alt="Header" />
                ) : (
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{isRtl ? 'معاينة الهيدر' : 'Header Preview'}</span>
                )}
              </div>

              <div className="flex-1 p-10 text-center flex flex-col justify-center space-y-8">
                <div className="w-28 h-28 bg-white rounded-3xl mx-auto flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden shadow-xl ring-4 ring-slate-50 transition-all hover:scale-105">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-slate-200" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black font-headline text-slate-900 tracking-tight">{formData.name || t('name')}</h3>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-wider py-1 px-4 rounded-full">
                    {t('active')}
                  </Badge>
                </div>
                
                <div className="space-y-4 pt-8 border-t border-slate-50">
                   <div className="flex justify-between items-center text-[10px] font-black">
                     <span className="text-slate-400 uppercase tracking-tighter">{t('commercialRegistry')}</span>
                     <span className="font-mono text-slate-800">{formData.commercialRegistry || '---'}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-black">
                     <span className="text-slate-400 uppercase tracking-tighter">{t('licenseExpiry')}</span>
                     <span className="text-primary">{formData.licenseExpiryDate || '---'}</span>
                   </div>
                </div>
              </div>

              <div className="h-20 bg-slate-50 border-t relative flex items-center justify-center overflow-hidden shadow-inner">
                {formData.footerImageUrl ? (
                   <img src={formData.footerImageUrl} className="w-full h-full object-contain" alt="Footer" />
                ) : (
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{isRtl ? 'معاينة الفوتر' : 'Footer Preview'}</span>
                )}
              </div>
           </Card>

           <div className="space-y-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full h-16 rounded-[2rem] font-black text-lg bg-primary shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="me-2 h-6 w-6" />}
                {t('saveChanges')}
              </Button>
              <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 flex items-start gap-4 shadow-sm">
                 <ShieldCheck className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed text-start">
                   {isRtl ? "ملاحظة: الصور المرفوعة أو الروابط ستظهر تلقائياً في ترويسة وتذييل كافة التقارير الرسمية الصادرة من النظام." : "Note: Uploaded images or links will automatically appear in the headers and footers of all official reports."}
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
