'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  User, 
  Briefcase, 
  DollarSign, 
  Loader2, 
  Save, 
  Phone, 
  Mail, 
  CreditCard, 
  ShieldCheck,
  Wallet
} from "lucide-react";
import { Employee } from '@/types/hr';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { useLanguage } from '@/context/language-context';

const employeeSchema = z.object({
  employeeNumber: z.string().min(1, "Required"),
  fullName: z.string().min(3, "Required"),
  nameEn: z.string().optional(),
  civilId: z.string().length(12, "Must be 12 digits"),
  mobile: z.string().min(8, "Invalid mobile"),
  email: z.string().email().optional().or(z.literal('')),
  hireDate: z.string().min(1, "Required"),
  jobTitle: z.string().min(1, "Required"),
  departmentName: z.string().min(1, "Required"),
  paymentMethod: z.enum(['cash', 'transfer', 'check', 'payroll']),
  basicSalary: z.coerce.number().min(0),
  housingAllowance: z.coerce.number().min(0).optional(),
  transportAllowance: z.coerce.number().min(0).optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  contractExpiry: z.string().optional(),
  residencyExpiry: z.string().optional(),
});

interface Props {
  initialData?: Employee;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function EmployeeForm({ initialData, onSubmit, loading }: Props) {
  const { dir, lang } = useLanguage();
  const isRtl = lang === 'ar';

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
      jobTitle: '',
      departmentName: '',
      paymentMethod: 'cash',
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      bankName: '',
      iban: '',
      status: 'active',
      isActive: true
    }
  });

  const paymentMethod = form.watch('paymentMethod');
  const showBankFields = paymentMethod === 'payroll';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" dir={dir}>
      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-8 md:p-12 space-y-12">
          
          {/* Section 1: Personal Data */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-primary border-s-4 border-primary ps-4">
              <User className="h-6 w-6" />
              <h3 className="text-xl font-black font-headline">
                {isRtl ? 'البيانات الشخصية والاتصال' : 'Personal & Contact Information'}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'رقم الموظف' : 'Emp #'}</Label>
                <div className="relative">
                  <ShieldCheck className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input {...form.register('employeeNumber')} className="h-12 rounded-xl ps-11" placeholder="EMP-001" />
                </div>
              </div>
              
              <div className="space-y-2 text-start lg:col-span-2">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'الاسم الكامل' : 'Full Name'}</Label>
                <Input {...form.register('fullName')} className="h-12 rounded-xl" placeholder={isRtl ? 'أحمد محمد عبدالله' : 'Ahmad Mohamed'} />
              </div>

              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
                <Input {...form.register('civilId')} maxLength={12} className="h-12 rounded-xl font-mono" placeholder="29001010XXXX" />
              </div>

              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
                <div className="relative">
                  <Phone className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input {...form.register('mobile')} className="h-12 rounded-xl ps-11 font-mono" placeholder="965 XXXXXXXX" />
                </div>
              </div>

              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'البريد الإلكتروني' : 'Email'}</Label>
                <div className="relative">
                  <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input {...form.register('email')} type="email" className="h-12 rounded-xl ps-11 text-start" dir="ltr" placeholder="emp@company.com" />
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-100" />

          {/* Section 2: Job Data */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-blue-600 border-s-4 border-blue-600 ps-4">
              <Briefcase className="h-6 w-6" />
              <h3 className="text-xl font-black font-headline">
                {isRtl ? 'البيانات الوظيفية' : 'Professional Record'}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</Label>
                <Input {...form.register('jobTitle')} className="h-12 rounded-xl" placeholder={isRtl ? 'مهندس موقع' : 'Site Engineer'} />
              </div>
              
              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'القسم / الإدارة' : 'Department'}</Label>
                <Input {...form.register('departmentName')} className="h-12 rounded-xl" placeholder={isRtl ? 'القسم الإنشائي' : 'Construction Dept'} />
              </div>

              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</Label>
                <SmartDateInput value={form.watch('hireDate')} onChange={(v) => form.setValue('hireDate', v)} />
              </div>

              <div className="space-y-2 text-start">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'تاريخ انتهاء الإقامة' : 'Residency Expiry'}</Label>
                <SmartDateInput value={form.watch('residencyExpiry') || ''} onChange={(v) => form.setValue('residencyExpiry', v)} />
              </div>
            </div>
          </div>

          <Separator className="bg-slate-100" />

          {/* Section 3: Financial Data */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-emerald-600 border-s-4 border-emerald-600 ps-4">
              <DollarSign className="h-6 w-6" />
              <h3 className="text-xl font-black font-headline">
                {isRtl ? 'البيانات المالية والبنكية' : 'Financial & Banking'}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2 text-start lg:col-span-2">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'طريقة الصرف' : 'Payment Method'}</Label>
                <div className="relative">
                  <Wallet className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 z-10" />
                  <Select 
                    value={paymentMethod} 
                    onValueChange={(v) => form.setValue('paymentMethod', v as any)}
                  >
                    <SelectTrigger className="h-14 rounded-xl ps-11">
                      <SelectValue placeholder={isRtl ? "اختر طريقة الصرف" : "Select Method"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{isRtl ? 'نقدي' : 'Cash'}</SelectItem>
                      <SelectItem value="transfer">{isRtl ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                      <SelectItem value="check">{isRtl ? 'شيك' : 'Check'}</SelectItem>
                      <SelectItem value="payroll">{isRtl ? 'كشف رواتب' : 'Payroll List'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 text-start lg:col-span-2">
                <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'الراتب الأساسي (د.ك)' : 'Basic Salary (KWD)'}</Label>
                <div className="relative">
                  <span className="absolute start-4 top-1/2 -translate-y-1/2 font-black text-emerald-600">KD</span>
                  <Input {...form.register('basicSalary')} type="number" step="0.001" className="h-14 rounded-xl ps-12 font-black text-lg text-emerald-600 bg-emerald-50/30 border-emerald-100" />
                </div>
              </div>

              {showBankFields && (
                <div className="grid grid-cols-1 md:grid-cols-4 lg:col-span-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="space-y-2 text-start md:col-span-2">
                    <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'اسم البنك' : 'Bank Name'}</Label>
                    <Input {...form.register('bankName')} className="h-14 rounded-xl" placeholder={isRtl ? 'بنك الكويت الوطني' : 'NBK'} />
                  </div>

                  <div className="space-y-2 text-start md:col-span-2">
                    <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'رقم الحساب الدولي (IBAN)' : 'IBAN Number'}</Label>
                    <div className="relative">
                      <CreditCard className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      <Input {...form.register('iban')} className="h-14 rounded-xl ps-11 font-mono text-start uppercase tracking-wider" dir="ltr" placeholder="KWXXXXXXXXXXXXXXXXXXXXXX" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end pt-4 pb-10">
        <Button 
          type="submit" 
          disabled={loading}
          className="h-20 rounded-[2rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading ? <Loader2 className="animate-spin me-3 h-8 w-8" /> : <Save className="me-3 h-8 w-8" />}
          {isRtl ? 'اعتماد وحفظ ملف الموظف' : 'Save Employee Record'}
        </Button>
      </div>
    </form>
  );
}
