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
  Calendar as CalendarIcon
} from "lucide-react";
import { Employee } from '@/types/hr';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { Department, Job } from '@/types/reference';

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

  // 1. Fetch Reference Data
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
      paymentMethod: 'cash',
      basicSalary: 0,
      bankName: '',
      iban: '',
      status: 'active',
      isActive: true
    }
  });

  const selectedDeptId = form.watch('departmentId');
  const paymentMethod = form.watch('paymentMethod');

  // 2. Fetch Jobs based on selected Department
  const jobsQuery = useMemo(() => 
    companyId && db && selectedDeptId ? query(collection(db, paths.jobs(companyId, selectedDeptId)), orderBy('name')) : null, 
  [db, companyId, selectedDeptId]);

  const { data: jobs } = useCollection<Job>(jobsQuery);

  // Sync Names for IDs before submit
  useEffect(() => {
    if (selectedDeptId && departments) {
      const dept = departments.find(d => d.id === selectedDeptId);
      if (dept) form.setValue('departmentName', isRtl ? dept.name : dept.nameEn);
    }
  }, [selectedDeptId, departments, isRtl, form]);

  const selectedJobId = form.watch('jobId');
  useEffect(() => {
    if (selectedJobId && jobs) {
      const job = jobs.find(j => j.id === selectedJobId);
      if (job) form.setValue('jobTitle', isRtl ? job.name : job.nameEn);
    }
  }, [selectedJobId, jobs, isRtl, form]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-20" dir={dir}>
      
      {/* SECTION 1: Personal & Contact */}
      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-[#b8860b] mb-4">
             <h3 className="text-xl font-bold font-headline">{isRtl ? 'البيانات الشخصية والاتصال' : 'Personal & Contact Info'}</h3>
             <UserPlus className="h-6 w-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'رقم الموظف' : 'Employee Number'}</Label>
              <Input {...form.register('employeeNumber')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200" placeholder={isRtl ? "مثلاً: 1001" : "e.g. 1001"} />
            </div>
            
            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الاسم الكامل (Ar)' : 'Full Name (Ar)'}</Label>
              <Input {...form.register('fullName')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200" placeholder="أدخل الاسم الرباعي" />
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الاسم بالإنجليزية (En)' : 'Name (English)'}</Label>
              <Input {...form.register('nameEn')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 text-start" dir="ltr" placeholder="Full English Name" />
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
              <Input {...form.register('civilId')} maxLength={12} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-mono" placeholder="أدخل الرقم المدني" />
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'رقم الهاتف' : 'Mobile Number'}</Label>
              <div className="relative">
                <Phone className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input {...form.register('mobile')} className="h-12 rounded-xl ps-11 bg-slate-50/50 border-slate-200" placeholder="+965 0000 0000" />
              </div>
            </div>

            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</Label>
              <div className="relative">
                <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input {...form.register('email')} type="email" className="h-12 rounded-xl ps-11 bg-slate-50/50 border-slate-200 text-start" dir="ltr" placeholder="example@kinetic.com" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Professional Data */}
      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-[#b8860b] mb-4">
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
                <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200">
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
                <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200">
                  <SelectValue placeholder={isRtl ? "المسمى الوظيفي" : "Job Title"} />
                </SelectTrigger>
                <SelectContent>
                   {jobs?.map(j => (
                     <SelectItem key={j.id} value={j.id!}>{isRtl ? j.name : j.nameEn}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1 space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</Label>
              <SmartDateInput value={form.watch('hireDate')} onChange={(v) => form.setValue('hireDate', v)} />
            </div>

            <div className="md:col-span-1 space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'تاريخ انتهاء الإقامة' : 'Residency Expiry'}</Label>
              <SmartDateInput value={form.watch('residencyExpiry') || ''} onChange={(v) => form.setValue('residencyExpiry', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Financial Data */}
      <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white ring-1 ring-black/5">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-end gap-3 text-[#b8860b] mb-4">
             <h3 className="text-xl font-bold font-headline">{isRtl ? 'البيانات المالية والبنكية' : 'Financial & Banking'}</h3>
             <Building2 className="h-6 w-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 text-start">
              <Label className="font-bold text-xs text-slate-600">{isRtl ? 'الراتب الأساسي (د.ك)' : 'Basic Salary (KWD)'}</Label>
              <Input {...form.register('basicSalary')} type="number" step="0.001" className="h-12 rounded-xl bg-slate-50/50 border-slate-200 text-center font-bold text-emerald-600" placeholder="مثلاً: 1500" />
            </div>

            <div className="space-y-2 text-start">
               <Label className="font-bold text-xs text-slate-600">{isRtl ? 'طريقة الصرف' : 'Payment Method'}</Label>
               <Select value={paymentMethod} onValueChange={(v: any) => form.setValue('paymentMethod', v)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{isRtl ? 'نقدي' : 'Cash'}</SelectItem>
                    <SelectItem value="transfer">{isRtl ? 'تحويل بنكي' : 'Transfer'}</SelectItem>
                    <SelectItem value="check">{isRtl ? 'شيك' : 'Check'}</SelectItem>
                    <SelectItem value="payroll">{isRtl ? 'كشف رواتب' : 'Payroll'}</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {paymentMethod === 'payroll' && (
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2 text-start">
                  <Label className="font-bold text-xs text-slate-600">{isRtl ? 'اسم البنك' : 'Bank Name'}</Label>
                  <Input {...form.register('bankName')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200" placeholder="بنك الكويت الوطني" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-bold text-xs text-slate-600">{isRtl ? 'رقم الحساب الدولي (IBAN)' : 'IBAN Number'}</Label>
                  <Input {...form.register('iban')} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-mono uppercase" placeholder="KW00 0000 0000 0000 0000 0000 00" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-6">
        <Button 
          type="submit" 
          disabled={loading}
          className="h-16 rounded-2xl px-12 bg-[#b8860b] hover:bg-[#a67c00] text-white font-black text-xl shadow-xl shadow-[#b8860b]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading ? <Loader2 className="animate-spin me-3 h-6 w-6" /> : <Save className="me-3 h-6 w-6" />}
          {isRtl ? 'حفظ سجل الموظف' : 'Save Record'}
        </Button>
      </div>
    </form>
  );
}
