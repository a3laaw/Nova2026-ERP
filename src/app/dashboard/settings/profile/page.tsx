
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  UserCog, ShieldCheck, Mail, Key, 
  Loader2, Save, UserCircle,
  CheckCircle2
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
      const globalUserRef = doc(db, 'global_users', user.uid);
      await updateDoc(globalUserRef, {
        username: formData.username,
        updatedAt: serverTimestamp(),
      });

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
                </div>
                <div className="mt-6 space-y-2">
                   <h3 className="text-xl font-black font-headline text-slate-900">{user?.displayName || 'Nova User'}</h3>
                   <Badge className="bg-blue-50 text-blue-600 font-black border-0 uppercase text-[9px] tracking-widest px-4">
                      {globalUser?.role || 'User'}
                   </Badge>
                </div>
             </CardContent>
          </Card>
        </div>

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
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{t('username')}</Label>
                       <Input 
                         value={formData.username} 
                         onChange={e => setFormData({...formData, username: e.target.value})}
                         className="h-12 rounded-xl bg-slate-50/50 border-slate-100 font-mono"
                       />
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
