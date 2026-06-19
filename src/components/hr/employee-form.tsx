'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Briefcase, DollarSign, Calendar, Loader2, Save } from "lucide-react";
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
  const { t, dir, lang } = useLanguage();
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState("personal");

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
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      bankName: '',
      iban: '',
      status: 'active',
      isActive: true
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" dir={dir}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30 rounded-2xl h-14 p-1">
          <TabsTrigger value="personal" className="rounded-xl font-black gap-2 transition-all">
            <User className="h-4 w-4" /> {isRtl ? 'البيانات الشخصية' : 'Personal'}
          </TabsTrigger>
          <TabsTrigger value="job" className="rounded-xl font-black gap-2 transition-all">
            <Briefcase className="h-4 w-4" /> {isRtl ? 'البيانات الوظيفية' : 'Professional'}
          </TabsTrigger>
          <TabsTrigger value="financial" className="rounded-xl font-black gap-2 transition-all">
            <DollarSign className="h-4 w-4" /> {isRtl ? 'البيانات المالية' : 'Financial'}
          </TabsTrigger>
        </TabsList>

        <Card className="mt-6 border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardContent className="p-8">
            <TabsContent value="personal" className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'رقم الموظف' : 'Emp #'}</Label>
                  <Input {...form.register('employeeNumber')} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'الاسم الكامل' : 'Full Name'}</Label>
                  <Input {...form.register('fullName')} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
                  <Input {...form.register('civilId')} maxLength={12} className="h-12 rounded-xl font-mono" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
                  <Input {...form.register('mobile')} className="h-12 rounded-xl font-mono" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <Input {...form.register('email')} type="email" className="h-12 rounded-xl text-start" dir="ltr" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="job" className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</Label>
                  <Input {...form.register('jobTitle')} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'القسم' : 'Department'}</Label>
                  <Input {...form.register('departmentName')} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</Label>
                  <SmartDateInput value={form.watch('hireDate')} onChange={(v) => form.setValue('hireDate', v)} />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'انتهاء الإقامة' : 'Residency Expiry'}</Label>
                  <SmartDateInput value={form.watch('residencyExpiry') || ''} onChange={(v) => form.setValue('residencyExpiry', v)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'الراتب الأساسي' : 'Basic Salary'}</Label>
                  <div className="relative">
                    <DollarSign className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                    <Input {...form.register('basicSalary')} type="number" step="0.001" className="h-12 rounded-xl ps-10 font-black text-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'بدل السكن' : 'Housing'}</Label>
                  <Input {...form.register('housingAllowance')} type="number" step="0.001" className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">{isRtl ? 'اسم البنك' : 'Bank'}</Label>
                  <Input {...form.register('bankName')} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black text-xs text-slate-500 uppercase tracking-widest">IBAN</Label>
                  <Input {...form.register('iban')} className="h-12 rounded-xl font-mono text-start uppercase" dir="ltr" />
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button 
          type="submit" 
          disabled={loading}
          className="h-14 rounded-2xl px-12 bg-primary font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading ? <Loader2 className="animate-spin me-2" /> : <Save className="me-2 h-5 w-5" />}
          {isRtl ? 'حفظ بيانات الموظف' : 'Save Employee'}
        </Button>
      </div>
    </form>
  );
}
