
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, Image as ImageIcon, FileText, 
  Loader2, CheckCircle2,
  UploadCloud, X, Link as LinkIcon, Type
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SmartDateInput } from '@/components/ui/smart-date-input';

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
        commercialRegistry: (company as any).commercialRegistry || '',
        address: (company as any).address || '',
        licenseExpiryDate: (company as any).licenseExpiryDate || '',
        laborAuthorityExpiryDate: (company as any).laborAuthorityExpiryDate || '',
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
      toast({
        variant: "destructive",
        title: isRtl ? "حجم الملف كبير جداً" : "File too large",
        description: isRtl ? "يرجى رفع صورة أقل من 1 ميجابايت لضمان الأداء." : "Please upload an image smaller than 1MB."
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

  const AssetManager = ({ label, imgField, textField, height = "h-28", showTextTab = false }: { label: string, imgField: string, textField?: string, height?: string, showTextTab?: boolean }) => {
    const currentImage = formData[imgField];
    const currentText = textField ? formData[textField] : '';

    return (
      <div className="space-y-3">
        <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">{label}</Label>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className={cn("grid w-full rounded-lg bg-slate-100 p-0.5 h-8", showTextTab ? "grid-cols-3" : "grid-cols-2")}>
            <TabsTrigger value="upload" className="rounded-md text-[9px] font-bold gap-1.5 h-7 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <UploadCloud className="h-3 w-3" /> {isRtl ? 'رفع صورة' : 'Upload'}
            </TabsTrigger>
            <TabsTrigger value="url" className="rounded-md text-[9px] font-bold gap-1.5 h-7 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <LinkIcon className="h-3 w-3" /> {isRtl ? 'رابط' : 'URL'}
            </TabsTrigger>
            {showTextTab && (
              <TabsTrigger value="text" className="rounded-md text-[9px] font-bold gap-1.5 h-7 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <Type className="h-3 w-3" /> {isRtl ? 'نص' : 'Text'}
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="upload" className="mt-2">
            <div className={cn(
              "relative rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 overflow-hidden group transition-all hover:border-primary/30",
              height
            )}>
              {currentImage && currentImage.startsWith('data:') ? (
                <>
                  <img src={currentImage} alt={label} className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="destructive" size="sm" className="h-7 text-[10px]" onClick={() => setFormData({...formData, [imgField]: ''})}>
                      <X className="h-3 w-3 me-1" /> {isRtl ? 'حذف' : 'Remove'}
                    </Button>
                  </div>
                </>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                  <UploadCloud className="h-6 w-6 text-slate-300 mb-1" />
                  <span className="text-[9px] font-black text-slate-400">{isRtl ? 'اضغط للرفع (1MB كحد أقصى)' : 'Click to Upload (Max 1MB)'}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, imgField)} />
                </label>
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-2">
            <div className="space-y-2">
              <input 
                value={(!currentImage || currentImage.startsWith('data:')) ? '' : currentImage}
                onChange={(e) => setFormData({...formData, [imgField]: e.target.value})}
                placeholder="https://example.com/image.png"
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-[9px] font-mono ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                dir="ltr"
              />
            </div>
          </TabsContent>

          {showTextTab && textField && (
            <TabsContent value="text" className="mt-2">
              <Textarea 
                value={currentText}
                onChange={(e) => setFormData({...formData, [textField]: e.target.value, [imgField]: ''})}
                placeholder={isRtl ? "اكتب النص هنا..." : "Type text here..."}
                className="min-h-[80px] rounded-lg text-xs p-3 bg-slate-50/50"
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex items-center gap-4">
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
          <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-6 text-start">
              <CardTitle className="text-lg font-black font-headline flex items-center gap-2 text-slate-800">
                <FileText className="h-5 w-5 text-primary" />
                {t('companyProfile')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-600">{t('name')}</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white" 
                  />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-600">{t('commercialRegistry')}</Label>
                  <Input 
                    value={formData.commercialRegistry} 
                    onChange={e => setFormData({...formData, commercialRegistry: e.target.value})} 
                    className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white" 
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50">
                <h3 className="font-black text-[10px] mb-6 text-primary uppercase tracking-widest">{isRtl ? 'المظهر والهوية البصرية' : 'Branding & Assets'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <AssetManager label={t('logo')} imgField="logoUrl" />
                   <AssetManager label={isRtl ? "الهيدر (الرأس)" : "Header"} imgField="headerImageUrl" textField="headerText" showTextTab />
                   <AssetManager label={isRtl ? "الفوتر (التذييل)" : "Footer"} imgField="footerImageUrl" textField="footerText" showTextTab />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
