'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  UserCog, ShieldCheck, Mail, Key, 
  Loader2, Save, UserCircle,
  Camera, X, CheckCircle2, Lock, Info
} from "lucide-react";
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useAuth } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  const { user, globalUser, loading: authLoading } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    photoUrl: ''
  });

  useEffect(() => {
    if (globalUser) {
      setFormData({
        fullName: globalUser.fullName || user?.displayName || '',
        username: globalUser.username || '',
        photoUrl: globalUser.photoUrl || ''
      });
    }
  }, [globalUser, user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "حجم الصورة كبير" : "Image too large", 
        description: isRtl ? "يرجى اختيار صورة أقل من 1 ميجابايت." : "Max 1MB" 
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!db || !user?.uid || !globalUser?.companyId || !auth?.currentUser) return;
    setSaving(true);

    const globalUserRef = doc(db, 'global_users', user.uid);
    const tenantUserRef = doc(db, 'companies', globalUser.companyId, 'users', user.uid);

    // توحيد قسري لبيانات الهوية
    const unifiedRoleCode = (globalUser.roleCode || globalUser.role || 'USER').toUpperCase();

    const globalPayload = {
      fullName: formData.fullName,
      username: formData.username,
      photoUrl: formData.photoUrl,
      roleCode: unifiedRoleCode,
      role: unifiedRoleCode.toLowerCase(),
      updatedAt: serverTimestamp(),
    };

    const tenantPayload = {
      displayName: formData.fullName,
      username: formData.username,
      photoUrl: formData.photoUrl,
      roleCode: unifiedRoleCode,
      role: unifiedRoleCode.toLowerCase(),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateProfile(auth.currentUser, { 
        displayName: formData.fullName,
        photoURL: formData.photoUrl 
      });

      await updateDoc(globalUserRef, globalPayload).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: globalUserRef.path, operation: 'update', requestResourceData: globalPayload
        }));
      });

      await updateDoc(tenantUserRef, tenantPayload).then(() => {
        toast({ title: t('saved') });
      }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: tenantUserRef.path, operation: 'update', requestResourceData: tenantPayload
        }));
      });

    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  const isAdmin = globalUser?.role?.toLowerCase() === 'admin' || globalUser?.roleCode === 'ADMIN';

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20" dir={dir}>
      <div className="text-start">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
          <UserCog className="h-10 w-10 text-primary" />
          {t('profile')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'إدارة هويتك الفنية وبياناتك الشخصية' : 'Manage your technical identity and profile data'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
             <div className="h-24 bg-gradient-to-br from-primary to-accent relative" />
             <CardContent className="p-8 -mt-12 text-center flex flex-col items-center">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                   <Avatar className="h-28 w-28 rounded-[2rem] border-4 border-white shadow-2xl ring-4 ring-primary/5 transition-transform group-hover:scale-105">
                      <AvatarImage src={formData.photoUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-2xl uppercase">
                         {formData.fullName?.charAt(0)}
                      </AvatarFallback>
                   </Avatar>
                   <div className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-8 w-8 text-white" />
                   </div>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
                <div className="mt-6 space-y-2">
                   <h3 className="text-xl font-black font-headline text-slate-900 leading-tight">{formData.fullName}</h3>
                   <Badge className="bg-primary/5 text-primary font-black border-primary/20 uppercase text-[9px] tracking-widest px-4 py-1 rounded-full">
                      {globalUser?.roleCode || globalUser?.role || 'User'}
                   </Badge>
                </div>
             </CardContent>
          </Card>
          
          <div className="p-6 rounded-[2rem] bg-blue-50/50 border-2 border-dashed border-blue-100 flex items-start gap-4 text-start">
             <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
             <p className="text-[10px] font-bold text-blue-700 leading-relaxed italic">
                {isRtl ? 'يتم استخدام الاسم الكامل في كافة المراسلات الرسمية والتقارير الميدانية بدلاً من البريد الإلكتروني.' : 'Full name is used in all official communications and field reports instead of email.'}
             </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black font-headline flex items-center gap-2 text-slate-800">
                    <UserCircle className="h-5 w-5 text-primary" />
                    {t('personalInfo')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8 text-start">
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">{isRtl ? 'الاسم الكامل المعتمد' : 'Official Full Name'}</Label>
                    <Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="h-14 rounded-2xl bg-slate-50/50 border-2 font-black text-lg" />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">{t('username')}</Label>
                       <Input value={formData.username} readOnly={!isAdmin} onChange={e => setFormData({...formData, username: e.target.value})} className={cn("h-12 rounded-xl border-2 font-mono font-bold", !isAdmin && "bg-slate-100")} />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Email (Read-only)</Label>
                       <Input value={user?.email || ''} readOnly className="h-12 rounded-xl bg-slate-100 border-slate-200 text-slate-400 font-bold font-mono text-xs cursor-not-allowed" />
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving} className="h-16 rounded-2xl px-16 bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700">
                {saving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                {t('saveChanges')}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}