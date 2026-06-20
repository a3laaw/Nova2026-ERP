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
  RefreshCw
} from "lucide-react";
import { Employee } from '@/types/hr';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { Department, Job } from '@/types/reference';
import { HRService } from '@/services/hr-service';

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
  paymentMethod: z.enum(['cash', 'transfer', 'check', 'payroll']),
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
}

export function EmployeeForm({ initialData, onSubmit, loading }: Props) {
  const { dir, lang, t } = useLanguage();
  const { globalUser } = useAuthContext();
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
      paymentMethod: 'cash',
      basicSalary: 0,
      bankName: '',
      iban: '',
      status: 'active',
      isActive: true
    }
  });

  const selectedDeptId = form.watch('departmentId');
  const selectedJobId = form.watch('jobId');
  const paymentMethod = form.watch('paymentMethod');

  const jobsQuery = useMemo(() => 
    companyId && db && selectedDeptId ? query(collection(db, paths.jobs(companyId, selectedDeptId)), orderBy('order')) : null, 
  [db, companyId, selectedDeptId]);

  const { data: jobs } = useCollection<Job>(jobsQuery);

  // توليد رقم الموظف تلقائياً للموظف الجديد
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-20" dir={dir}>
      
      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-primary mb-4">
             <h3 className="text-xl font-bold font-headline">{isRtl ? 'البيانات الشخصية والاتصال' : 'Personal & Contact Info'}</h3>
             <UserPlus className="h-6 w-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'رقم الموظف (تلقائي)' : 'Employee Number (Auto)'}</Label>
              <div className="relative">
                <Input 
                  {...form.register('employeeNumber')} 
                  readOnly 
                  className="h-12 rounded-xl bg-slate-100 border-slate-200 font-black text-primary cursor-not-allowed" 
                  placeholder={generatingNum ? "..." : "1001"} 
                />
                {generatingNum && <RefreshCw className="absolute end-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/40" />}
              </div>
            </div>
            
            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الاسم الكامل (Ar)' : 'Full Name (Ar)'}</Label>
              <Input {...form.register('fullName')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold" />
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الاسم بالإنجليزية (En)' : 'Name (English)'}</Label>
              <Input {...form.register('nameEn')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 text-start font-bold" dir="ltr" />
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
              <Input {...form.register('civilId')} maxLength={12} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-mono" />
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'رقم الهاتف' : 'Mobile Number'}</Label>
              <div className="relative">
                <Phone className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input {...form.register('mobile')} className="h-12 rounded-xl ps-11 bg-slate-50/50 border-slate-200 font-bold" />
              </div>
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</Label>
              <div className="relative">
                <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input {...form.register('email')} type="email" className="h-12 rounded-xl ps-11 bg-slate-50/50 border-slate-200 text-start font-bold" dir="ltr" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-primary mb-4">
             <h3 className="text-xl font-bold font-headline">{isRtl ? 'البيانات الوظيفية' : 'Professional Data'}</h3>
             <Briefcase className="h-6 w-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'القسم / الإدارة' : 'Department'}</Label>
              <Select 
                value={selectedDeptId} 
                onValueChange={(v) => { form.setValue('departmentId', v); form.setValue('jobId', ''); }}
              >
                <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold">
                  <SelectValue placeholder={isRtl ? "اختر القسم" : "Select Dept"} />
                </SelectTrigger>
                <SelectContent>
                   {departments?.map(d => (
                     <SelectItem key={d.id} value={d.id!}>{isRtl ? d.name : d.nameEn}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1 space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</Label>
              <Select 
                value={selectedJobId} 
                onValueChange={(v) => form.setValue('jobId', v)}
                disabled={!selectedDeptId}
              >
                <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold">
                  <SelectValue placeholder={isRtl ? "المسمى الوظيفي" : "Job Title"} />
                </SelectTrigger>
                <SelectContent>
                   {jobs?.map(j => (
                     <SelectItem key={j.id} value={j.id!} className="font-bold">{isRtl ? j.name : j.nameEn}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2 text-start">
               <Label className="font-bold text-xs text-slate-600 opacity-50">{isRtl ? 'الصلاحيات المكتسبة (تلقائي)' : 'Inherited Permissions'}</Label>
               <div className="h-12 rounded-xl bg-primary/5 border-2 border-primary/10 flex items-center px-4 gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="font-black text-sm">{form.watch('roleName') || (isRtl ? 'سيتم الربط عند اختيار الوظيفة' : 'Linked via Job Title')}</span>
               </div>
            </div>

            <div className="md:col-span-2 space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</Label>
              <SmartDateInput value={form.watch('hireDate')} onChange={(v) => form.setValue('hireDate', v)} />
            </div>

            <div className="md:col-span-2 space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'تاريخ انتهاء الإقامة' : 'Residency Expiry'}</Label>
              <SmartDateInput value={form.watch('residencyExpiry') || ''} onChange={(v) => form.setValue('residencyExpiry', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-primary mb-4">
             <h3 className="text-xl font-bold font-headline">{isRtl ? 'البيانات المالية والبنكية' : 'Financial & Banking'}</h3>
             <Building2 className="h-6 w-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الراتب الأساسي (د.ك)' : 'Basic Salary (KWD)'}</Label>
              <Input {...form.register('basicSalary')} type="number" step="0.001" className="h-12 rounded-xl bg-slate-50/50 border-slate-200 text-center font-black text-emerald-600 text-xl" />
            </div>

            <div className="space-y-2 text-start">
               <Label className="font-bold text-xs text-slate-600">{isRtl ? 'طريقة الصرف' : 'Payment Method'}</Label>
               <Select value={paymentMethod} onValueChange={(v: any) => form.setValue('paymentMethod', v)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash" className="font-bold">{isRtl ? 'نقدي' : 'Cash'}</SelectItem>
                    <SelectItem value="transfer" className="font-bold">{isRtl ? 'تحويل بنكي' : 'Transfer'}</SelectItem>
                    <SelectItem value="check" className="font-bold">{isRtl ? 'شيك' : 'Check'}</SelectItem>
                    <SelectItem value="payroll" className="font-bold">{isRtl ? 'كشف رواتب' : 'Payroll'}</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {paymentMethod === 'payroll' && (
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2 text-start">
                  <Label className="font-bold text-xs text-slate-600">{isRtl ? 'اسم البنك' : 'Bank Name'}</Label>
                  <Input {...form.register('bankName')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-bold text-xs text-slate-600">{isRtl ? 'رقم الحساب الدولي (IBAN)' : 'IBAN Number'}</Label>
                  <Input {...form.register('iban')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-mono uppercase text-sm" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-6">
        <Button 
          type="submit" 
          disabled={loading || generatingNum}
          className="h-20 rounded-[2.5rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
          {initialData ? (isRtl ? 'تحديث بيانات الموظف' : 'Update Record') : (isRtl ? 'توظيف الموظف الآن' : 'Commit Hire')}
        </Button>
      </div>
    </form>
  );
}