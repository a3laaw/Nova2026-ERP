'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  UserCog, ShieldCheck, Mail, Key, 
  ArrowRight, Loader2, Save, UserCircle,
  Clock, CheckCircle2, AlertCircle
} from "lucide-react";
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  const { user, globalUser, loading: authLoading } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
  });

  useEffect(() => {
    if (globalUser) {
      setFormData({
        displayName: user?.displayName || '',
        username: globalUser.username || '',
      });
    }
  }, [globalUser, user]);

  const handleSave = async () => {
    if (!db || !user?.uid || !globalUser?.companyId) return;
    setSaving(true);
    try {
      // 1. تحديث في السجل العالمي
      const globalUserRef = doc(db, 'global_users', user.uid);
      await updateDoc(globalUserRef, {
        username: formData.username,
        updatedAt: serverTimestamp(),
      });

      // 2. تحديث في سجل الشركة (Tenant User)
      const tenantUserRef = doc(db, 'companies', globalUser.companyId, 'users', user.uid);
      await updateDoc(tenantUserRef, {
        displayName: formData.displayName,
        updatedAt: serverTimestamp(),
      });

      toast({ title: t('saved'), description: t('entryAdded') });
    } catch (error) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto" dir={dir}>
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
            <UserCog className="h-10 w-10 text-primary" />
            {t('profile')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة بياناتك الشخصية وتفضيلات الأمان' : 'Manage your personal data and security preferences'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Avatar & Role Summary */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
             <div className="h-24 bg-primary/10 relative" />
             <CardContent className="p-8 -mt-12 text-center flex flex-col items-center">
                <div className="relative group">
                   <Avatar className="h-24 w-24 rounded-[2rem] border-4 border-white shadow-2xl ring-4 ring-primary/5">
                      <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/100/100`} />
                      <AvatarFallback className="bg-slate-100 text-slate-400 font-black text-2xl uppercase">
                         {user?.email?.charAt(0)}
                      </AvatarFallback>
                   </Avatar>
                   <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Save className="h-6 w-6 text-white" />
                   </div>
                </div>
                
                <div className="mt-6 space-y-2">
                   <h3 className="text-xl font-black font-headline text-slate-900">{user?.displayName || 'Nova User'}</h3>
                   <Badge className="bg-blue-50 text-blue-600 font-black border-0 uppercase text-[9px] tracking-widest px-4">
                      {globalUser?.role || 'User'}
                   </Badge>
                </div>

                <div className="w-full mt-8 pt-8 border-t border-slate-50 space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                      <span>{t('lastLogin')}</span>
                      <span className="text-slate-800 font-mono">{new Date().toLocaleDateString()}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                      <span>{t('status')}</span>
                      <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {t('active')}</span>
                   </div>
                </div>
             </CardContent>
          </Card>

          <Card className="border-0 shadow-lg rounded-[2rem] bg-slate-900 text-white p-6">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-xl text-primary"><ShieldCheck className="h-5 w-5" /></div>
                <h4 className="font-black text-sm uppercase tracking-tight">{t('accountSecurity')}</h4>
             </div>
             <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                {t('passwordDesc')}
             </p>
             <Button variant="outline" className="w-full mt-6 rounded-xl font-black text-xs h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:text-white">
                <Key className="h-4 w-4 me-2" />
                {t('changePassword')}
             </Button>
          </Card>
        </div>

        {/* Right: Forms */}
        <div className="lg:col-span-2 space-y-6">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black font-headline flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    {t('personalInfo')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{t('displayName')}</Label>
                       <Input 
                         value={formData.displayName} 
                         onChange={e => setFormData({...formData, displayName: e.target.value})}
                         className="h-12 rounded-xl bg-slate-50/50 border-slate-100"
                         placeholder="Ahmad Mohammad"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{t('username')}</Label>
                       <Input 
                         value={formData.username} 
                         onChange={e => setFormData({...formData, username: e.target.value})}
                         className="h-12 rounded-xl bg-slate-50/50 border-slate-100 font-mono"
                         placeholder="ahmad_2024"
                       />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                       <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{t('email')}</Label>
                       <div className="relative">
                          <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                          <Input 
                            value={user?.email || ''} 
                            disabled 
                            className="h-12 rounded-xl bg-slate-100 border-slate-200 ps-11 cursor-not-allowed text-slate-400 font-mono" 
                          />
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-slate-50">
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm text-primary"><ShieldCheck className="h-4 w-4" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase">{t('currentRole')}</p>
                             <p className="text-sm font-black text-slate-800">{globalUser?.role || 'Basic User'}</p>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary hover:bg-primary/5">
                          {isRtl ? 'عرض صلاحياتي' : 'View My Permissions'}
                       </Button>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="flex justify-end gap-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="h-14 rounded-2xl px-12 bg-primary font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {saving ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
                {t('saveChanges')}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
