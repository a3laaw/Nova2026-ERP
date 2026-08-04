'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  UserPlus, 
  Briefcase, 
  DollarSign, 
  Loader2, 
  Save, 
  Phone, 
  Mail, 
  CreditCard, 
  ShieldCheck,
  Building2,
  Calendar as CalendarIcon,
  RefreshCw,
  Lock,
  HardHat,
  Construction,
  Wallet,
  Landmark
} from "lucide-react";
import { Employee } from '@/types/hr';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Department, Job } from '@/types/reference';
import { HRService } from '@/services/hr-service';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";

const employeeSchema = z.object({
  employeeNumber: z.string().min(1, "Required"),
  fullName: z.string().min(3, "Required"),
  nameEn: z.string().min(3, "Required"),
  civilId: z.string().length(12, "Must be 12 digits"),
  mobile: z.string().min(8, "Invalid mobile"),
  email: z.string().email().optional().or(z.literal('')),
  hireDate: z.string().min(1, "Required"),
  residencyExpiry: z.string().optional(),
  departmentId: z.string().min(1, "Required"),
  departmentName: z.string().optional(),
  jobId: z.string().min(1, "Required"),
  jobTitle: z.string().optional(),
  roleId: z.string().optional(),
  roleName: z.string().optional(),
  employeeType: z.enum(['internal', 'external']),
  paymentBasis: z.enum(['monthly', 'daily']),
  paymentMethod: z.enum(['cash', 'check', 'site_petty_cash', 'lead_engineer', 'payroll', 'transfer']),
  basicSalary: z.coerce.number().min(0),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  status: z.string().default('active'),
  isActive: z.boolean().default(true)
});

interface Props {
  initialData?: Employee;
  onSubmit: (data: any) => void;
  loading?: boolean;
  readOnly?: boolean;
}

export function EmployeeForm({ initialData, onSubmit, loading, readOnly = false }: Props) {
  const { dir, lang, t } = useLanguage();
  const { globalUser } = useAuthContext();
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [generatingNum, setGeneratingNum] = useState(false);

  const hrService = useMemo(() => 
    db && companyId ? new HRService(db, companyId) : null, 
  [db, companyId]);

  const deptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  
  const { data: departments } = useCollection<Department>(deptsQuery);

  const form = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: initialData || {
      employeeNumber: '',
      fullName: '',
      nameEn: '',
      civilId: '',
      mobile: '',
      email: '',
      hireDate: new Date().toISOString().split('T')[0],
      residencyExpiry: '',
      departmentId: '',
      jobId: '',
      roleId: '',
      roleName: '',
      employeeType: 'internal',
      paymentBasis: 'monthly',
      paymentMethod: 'cash',
      basicSalary: 0,
      bankName: '',
      iban: '',
      status: 'active',
      isActive: true
    }
  });

  const employeeType = form.watch('employeeType');
  const paymentBasis = form.watch('paymentBasis');
  const selectedDeptId = form.watch('departmentId');
  const selectedJobId = form.watch('jobId');
  const paymentMethod = form.watch('paymentMethod');

  const jobsQuery = useMemo(() => 
    companyId && db && selectedDeptId ? query(collection(db, paths.jobs(companyId, selectedDeptId)), orderBy('order')) : null, 
  [db, companyId, selectedDeptId]);

  const { data: jobs } = useCollection<Job>(jobsQuery);

  useEffect(() => {
    if (!initialData && hrService && !form.getValues('employeeNumber')) {
      setGeneratingNum(true);
      hrService.getNextEmployeeNumber().then(num => {
        form.setValue('employeeNumber', num);
        setGeneratingNum(false);
      });
    }
  }, [hrService, initialData, form]);

  useEffect(() => {
    if (selectedDeptId && departments) {
      const dept = departments.find(d => d.id === selectedDeptId);
      if (dept) form.setValue('departmentName', isRtl ? dept.name : dept.nameEn);
    }
  }, [selectedDeptId, departments, isRtl, form]);

  useEffect(() => {
    if (selectedJobId && jobs) {
      const job = jobs.find(j => j.id === selectedJobId);
      if (job) {
        form.setValue('jobTitle', isRtl ? job.name : job.nameEn);
        form.setValue('roleId', job.roleId || '');
        form.setValue('roleName', job.roleName || '');
      }
    }
  }, [selectedJobId, jobs, isRtl, form]);

  const isExternal = employeeType === 'external';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" dir={dir}>
      
      {readOnly && (
        <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4 flex items-center gap-3 text-amber-800 mb-6 text-start">
           <Lock className="h-5 w-5 shrink-0" />
           <p className="text-xs font-bold">{isRtl ? 'هذا الملف معلق للعرض فقط.' : 'This profile is read-only.'}</p>
        </div>
      )}

      {/* نوع التوظيف - رادار سيادي */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card 
           onClick={() => !readOnly && form.setValue('employeeType', 'internal')}
           className={cn(
             "border-2 cursor-pointer transition-all rounded-[2.5rem] p-6 text-start relative overflow-hidden group",
             employeeType === 'internal' ? "border-primary bg-primary/5 shadow-xl" : "border-slate-100 bg-white opacity-60"
           )}
         >
            <div className="flex items-center gap-4">
               <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg", employeeType === 'internal' ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                  <ShieldCheck className="h-6 w-6" />
               </div>
               <div>
                  <h4 className="font-black text-lg leading-none">{isRtl ? 'موظف داخلي (رسمي)' : 'Internal Staff'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Full Identity & Residency</p>
               </div>
            </div>
            {employeeType === 'internal' && <div className="absolute top-2 right-6"><Badge className="bg-primary text-white text-[8px] font-black uppercase">Standard</Badge></div>}
         </Card>

         <Card 
           onClick={() => !readOnly && form.setValue('employeeType', 'external')}
           className={cn(
             "border-2 cursor-pointer transition-all rounded-[2.5rem] p-6 text-start relative overflow-hidden group",
             employeeType === 'external' ? "border-primary bg-primary/5 shadow-xl" : "border-slate-100 bg-white opacity-60"
           )}
         >
            <div className="flex items-center gap-4">
               <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg", employeeType === 'external' ? "bg-[#1e1b4b] text-[#e87c24]" : "bg-slate-100 text-slate-400")}>
                  <Construction className="h-6 w-6" />
               </div>
               <div>
                  <h4 className="font-black text-lg leading-none">{isRtl ? 'عامل خارجي (ميداني)' : 'External Labor'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Daily / Site Based</p>
               </div>
            </div>
            {employeeType === 'external' && <div className="absolute top-2 right-6"><Badge className="bg-[#1e1b4b] text-[#e87c24] text-[8px] font-black uppercase">Simplified</Badge></div>}
         </Card>
      </div>

      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-primary mb-4 border-b pb-4">
             <h3 className="text-xl font-black font-headline">{isRtl ? 'البيانات الأساسية' : 'Personal Identity'}</h3>
             <UserPlus className="h-6 w-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'رقم الموظف' : 'Emp #'}</Label>
              <div className="relative">
                <Input {...form.register('employeeNumber')} readOnly className="h-12 rounded-xl bg-slate-100 font-black text-primary border-0" />
                {generatingNum && <Loader2 className="absolute end-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/30" />}
              </div>
            </div>
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'الاسم الكامل' : 'Full Name'}</Label>
              <Input {...form.register('fullName')} readOnly={readOnly} className="h-12 rounded-xl border-2 font-bold bg-slate-50/30" />
            </div>
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
              <Input {...form.register('civilId')} readOnly={readOnly} maxLength={12} className="h-12 rounded-xl font-mono border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
              <Input {...form.register('mobile')} readOnly={readOnly} className="h-12 rounded-xl border-2 font-bold bg-slate-50/30" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-primary mb-4 border-b pb-4">
             <h3 className="text-xl font-black font-headline">{isRtl ? 'البيانات الوظيفية' : 'Work Context'}</h3>
             <Briefcase className="h-6 w-6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'القسم' : 'Department'}</Label>
              <Select disabled={readOnly} value={selectedDeptId} onValueChange={(v) => { form.setValue('departmentId', v); form.setValue('jobId', ''); }}>
                <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent className="rounded-xl">{departments?.map(d => <SelectItem key={d.id} value={d.id!} className="font-bold">{isRtl ? d.name : d.nameEn}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</Label>
              <Select disabled={readOnly || !selectedDeptId} value={selectedJobId} onValueChange={(v) => form.setValue('jobId', v)}>
                <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent className="rounded-xl">{jobs?.map(j => <SelectItem key={j.id} value={j.id!} className="font-bold">{isRtl ? j.name : j.nameEn}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 text-start">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'تاريخ المباشرة' : 'Start Date'}</Label>
              <SmartDateInput value={form.watch('hireDate')} onChange={(v) => form.setValue('hireDate', v)} />
            </div>
          </div>

          {!isExternal && (
            <div className="space-y-2 text-start pt-4 border-t animate-in fade-in">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'تاريخ انتهاء الإقامة' : 'Residency Expiry'}</Label>
              <SmartDateInput value={form.watch('residencyExpiry') || ''} onChange={(v) => form.setValue('residencyExpiry', v)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-8">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex gap-2">
               <Button type="button" onClick={() => !readOnly && form.setValue('paymentBasis', 'monthly')} variant={paymentBasis === 'monthly' ? 'default' : 'outline'} size="sm" className="rounded-xl font-bold h-9 px-6">
                  {isRtl ? 'راتب شهري' : 'Monthly'}
               </Button>
               <Button type="button" onClick={() => !readOnly && form.setValue('paymentBasis', 'daily')} variant={paymentBasis === 'daily' ? 'default' : 'outline'} size="sm" className="rounded-xl font-bold h-9 px-6">
                  {isRtl ? 'يومية' : 'Daily'}
               </Button>
            </div>
            <div className="flex items-center gap-3 text-emerald-600">
              <h3 className="text-xl font-black font-headline">{isRtl ? 'الاتفاق المالي' : 'Financial Terms'}</h3>
              <Wallet className="h-6 w-6" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-start">
            <div className="space-y-2">
              <Label className="font-black text-xs text-slate-400 uppercase">
                {paymentBasis === 'monthly' ? (isRtl ? 'قيمة الراتب (د.ك)' : 'Monthly Rate') : (isRtl ? 'قيمة اليومية (د.ك)' : 'Daily Rate')}
              </Label>
              <div className="relative">
                 <Input {...form.register('basicSalary')} type="number" step="0.001" className="h-16 rounded-2xl text-center font-black text-emerald-600 text-4xl bg-slate-50 border-2" />
                 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">KWD</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-xs text-slate-400 uppercase">{isRtl ? 'طريقة صرف المستحقات الميدانية' : 'Payout Method'}</Label>
              <Select value={paymentMethod} onValueChange={(v: any) => form.setValue('paymentMethod', v)} disabled={readOnly}>
                  <SelectTrigger className="h-16 rounded-2xl border-2 font-black text-lg bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-0 shadow-3xl">
                    <SelectItem value="cash" className="font-bold py-3">{isRtl ? 'نقدي (كاش)' : 'Cash'}</SelectItem>
                    <SelectItem value="site_petty_cash" className="font-bold py-3 text-primary">{isRtl ? 'عهدة الموقع' : 'Site Petty Cash'}</SelectItem>
                    <SelectItem value="lead_engineer" className="font-bold py-3">{isRtl ? 'المهندس المسؤول' : 'Lead Engineer'}</SelectItem>
                    <SelectItem value="check" className="font-bold py-3">{isRtl ? 'شيك' : 'Check'}</SelectItem>
                    {!isExternal && <SelectItem value="payroll" className="font-bold py-3 text-blue-600">{isRtl ? 'تحويل راتب رسمي' : 'Bank Payroll'}</SelectItem>}
                  </SelectContent>
              </Select>
            </div>
          </div>

          {!isExternal && paymentMethod === 'payroll' && (
            <div className="pt-8 border-t grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-500">
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase flex items-center gap-1.5"><Landmark className="h-3 w-3" /> {isRtl ? 'اسم البنك' : 'Bank'}</Label>
                <Input {...form.register('bankName')} readOnly={readOnly} className="h-12 rounded-xl border-2 bg-slate-50/30" />
              </div>
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-400 uppercase flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> {isRtl ? 'رقم الحساب (IBAN)' : 'IBAN'}</Label>
                <Input {...form.register('iban')} readOnly={readOnly} className="h-12 rounded-xl font-mono text-sm border-2 bg-slate-50/30" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end pt-6">
          <Button type="submit" disabled={loading} className="h-20 rounded-[2.5rem] px-24 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700">
            {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
            {initialData ? (isRtl ? 'تحديث البيانات' : 'Update Profile') : (isRtl ? 'اعتماد التوظيف' : 'Commit Registration')}
          </Button>
        </div>
      )}
    </form>
  );
}