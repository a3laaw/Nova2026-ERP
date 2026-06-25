'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserService } from '@/services/user-service';
import { Sparkles, Loader2, ShieldCheck, Key, UserCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function EmployeeJoinPage() {
  const params = useParams();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  
  const companyId = params.companyId as string;
  const inviteId = params.inviteId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function verify() {
      if (!db || !companyId || !inviteId) return;
      const service = new UserService(db, companyId);
      const data = await service.getInvitation(inviteId);
      if (!data || data.status !== 'pending') {
        toast({ variant: "destructive", title: "رابط منتهي أو غير صالح" });
        router.push('/login');
      } else {
        setInvite(data);
      }
      setLoading(false);
    }
    verify();
  }, [db, companyId, inviteId, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db || !invite) return;

    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, invite.email, password);
      const uid = cred.user.uid;

      await updateProfile(cred.user, { displayName: invite.employeeName });

      const batch = writeBatch(db);

      batch.set(doc(db, 'global_users', uid), {
        companyId: invite.companyId,
        roleId: invite.roleId,
        role: invite.roleCode,
        departmentId: invite.departmentId,
        employeeId: invite.employeeId,
        username: invite.email.split('@')[0],
        email: invite.email,
        isDeveloper: false,
        isActive: true,
        updatedAt: serverTimestamp()
      });

      batch.set(doc(db, 'companies', invite.companyId, 'users', uid), {
        displayName: invite.employeeName,
        email: invite.email,
        employeeId: invite.employeeId,
        roleId: invite.roleId,
        role: invite.roleCode,
        joinedAt: serverTimestamp(),
        isActive: true
      });

      batch.update(doc(db, 'companies', invite.companyId, 'invitations', invite.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        uid: uid
      });

      await batch.commit();
      
      toast({ title: "تم تفعيل حسابك بنجاح!" });
      document.cookie = `session=true; path=/; max-age=${60 * 60 * 24 * 7}`;
      router.push('/dashboard');

    } catch (error: any) {
      toast({ variant: "destructive", title: "فشل التفعيل", description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf3] p-6" dir="rtl">
      <Card className="w-full max-w-lg border-0 shadow-3xl rounded-[3rem] overflow-hidden bg-white">
        <div className="bg-slate-50 p-12 text-slate-900 text-center border-b">
           <div className="mx-auto w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary mb-6 shadow-inner ring-8 ring-white/50">
              <ShieldCheck className="h-12 w-12" />
           </div>
           <CardTitle className="text-4xl font-black font-headline tracking-tighter">تفعيل حساب الموظف</CardTitle>
           <CardDescription className="text-slate-500 mt-3 font-bold text-lg">مرحباً بك في منصة NovaFlow ERP السيادية</CardDescription>
        </div>

        <CardContent className="p-12 space-y-10">
           <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-primary/10 space-y-5">
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">الاسم الكامل</span>
                 <span className="font-black text-xl text-slate-800">{invite.employeeName}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">البريد الرسمي</span>
                 <span className="font-mono text-sm font-bold text-primary">{invite.email}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">الدور المخصص</span>
                 <Badge className="bg-slate-900 text-white font-black text-[10px] px-5 py-1 rounded-full uppercase tracking-tighter">{invite.roleCode}</Badge>
              </div>
           </div>

           <form onSubmit={handleJoin} className="space-y-8">
              <div className="space-y-3 text-start">
                 <Label className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Key className="h-4 w-4" /> تعيين كلمة المرور الخاصة بك
                 </Label>
                 <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="h-16 rounded-[1.5rem] border-2 text-2xl font-black pl-14 bg-slate-50/50 shadow-inner" 
                      placeholder="••••••••"
                      dir="ltr"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors">
                       {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                    </button>
                 </div>
                 <p className="text-[11px] text-slate-400 font-bold italic">يجب أن تتكون كلمة المرور من 6 خانات على الأقل لضمان الأمان السيادي.</p>
              </div>

              <Button type="submit" disabled={submitting || password.length < 6} className="w-full h-20 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-4 border-b-8 border-orange-700">
                 {submitting ? <Loader2 className="animate-spin h-8 w-8" /> : <UserCheck className="h-8 w-8" />}
                 تفعيل حسابي والدخول
              </Button>
           </form>
        </CardContent>
      </Card>
    </div>
  );
}
