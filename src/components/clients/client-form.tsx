'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  UserPlus, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  HardHat,
  Save,
  Loader2,
  FileText,
  Building2
} from "lucide-react";
import { Client } from '@/types/client';
import { Employee } from '@/types/hr';
import { Governorate, Area } from '@/types/reference';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';

const clientSchema = z.object({
  fileNumber: z.string().min(1, "رقم الملف مطلوب"),
  nameAr: z.string().min(3, "الاسم بالعربي مطلوب"),
  nameEn: z.string().optional(),
  mobile: z.string().min(8, "رقم الهاتف غير صحيح"),
  email: z.string().email().optional().or(z.literal('')),
  civilId: z.string().optional(),
  governorateId: z.string().optional(),
  governorateName: z.string().optional(),
  areaId: z.string().optional(),
  areaName: z.string().optional(),
  block: z.string().optional(),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  assignedEngineerId: z.string().optional(),
  assignedEngineerName: z.string().optional(),
  status: z.enum(['prospective', 'registered', 'contracted', 'inactive']),
  source: z.string().optional(),
  notes: z.string().optional(),
});

interface Props {
  initialData?: Client;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function ClientForm({ initialData, onSubmit, loading }: Props) {
  const { dir, lang, t } = useLanguage();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // جلب المرجعيات
  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  
  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId]);
  
  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const form = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || {
      fileNumber: '',
      nameAr: '',
      nameEn: '',
      mobile: '',
      email: '',
      civilId: '',
      governorateId: '',
      governorateName: '',
      areaId: '',
      areaName: '',
      block: '',
      street: '',
      houseNumber: '',
      assignedEngineerId: '',
      assignedEngineerName: '',
      status: 'prospective',
      source: '',
      notes: '',
    }
  });

  const selectedGovId = form.watch('governorateId');
  const areasQuery = useMemo(() => 
    companyId && db && selectedGovId ? query(collection(db, paths.areas(companyId, selectedGovId)), orderBy('name')) : null, 
  [db, companyId, selectedGovId]);
  const { data: areas } = useCollection<Area>(areasQuery);

  // تحديث الأسماء عند تغيير الـ IDs لضمان توفرها في Dossier لاحقاً دون Join
  const handleGovChange = (id: string) => {
    const gov = governorates?.find(g => g.id === id);
    form.setValue('governorateId', id);
    form.setValue('governorateName', gov ? (isRtl ? gov.name : gov.nameEn) : '');
    form.setValue('areaId', '');
    form.setValue('areaName', '');
  };

  const handleAreaChange = (id: string) => {
    const area = areas?.find(a => a.id === id);
    form.setValue('areaId', id);
    form.setValue('areaName', area ? (isRtl ? area.name : area.nameEn) : '');
  };

  const handleEngineerChange = (id: string) => {
    const emp = employees?.find(e => e.id === id);
    form.setValue('assignedEngineerId', id);
    form.setValue('assignedEngineerName', emp ? emp.fullName : '');
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" dir={dir}>
      
      {/* Identity Card */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-primary/5 p-8 border-b flex items-center justify-between">
           <div className="text-start">
              <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'الهوية والبيانات الأساسية' : 'Basic Identity'}</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? 'المعلومات الجوهرية لفتح ملف العميل' : 'Core information for client file'}</p>
           </div>
           <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
              <UserPlus className="h-6 w-6" />
           </div>
        </div>
        <CardContent className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2 text-start">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الملف' : 'File Number'}</Label>
              <Input {...form.register('fileNumber')} className="h-14 rounded-2xl border-2 font-mono text-lg font-black" placeholder="C-1001" />
            </div>
            <div className="md:col-span-2 space-y-2 text-start">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الاسم باللغة العربية' : 'Name (Arabic)'}</Label>
              <Input {...form.register('nameAr')} className="h-14 rounded-2xl border-2 text-lg font-black" placeholder="أدخل اسم العميل كاملاً" />
            </div>
            <div className="md:col-span-2 space-y-2 text-start">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الاسم بالإنجليزية (اختياري)' : 'Name (English)'}</Label>
              <Input {...form.register('nameEn')} className="h-14 rounded-2xl border-2 text-lg font-black text-start" dir="ltr" placeholder="Full English Name" />
            </div>
            <div className="space-y-2 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'حالة العميل' : 'Client Status'}</Label>
               <Select value={form.watch('status')} onValueChange={(v: any) => form.setValue('status', v)}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospective" className="font-bold">{isRtl ? 'فرصة (جديد)' : 'Prospective'}</SelectItem>
                    <SelectItem value="registered" className="font-bold">{isRtl ? 'مسجل (دائم)' : 'Registered'}</SelectItem>
                    <SelectItem value="contracted" className="font-bold text-emerald-600">{isRtl ? 'متعاقد (نشط)' : 'Contracted'}</SelectItem>
                    <SelectItem value="inactive" className="font-bold text-slate-400">{isRtl ? 'غير نشط' : 'Inactive'}</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-50">
             <div className="space-y-2 text-start">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
                <div className="relative">
                   <Phone className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                   <Input {...form.register('mobile')} className="h-14 rounded-2xl border-2 ps-12 text-lg font-black" placeholder="+965 00000000" />
                </div>
             </div>
             <div className="space-y-2 text-start">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'البريد الإلكتروني' : 'Email'}</Label>
                <div className="relative">
                   <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                   <Input {...form.register('email')} className="h-14 rounded-2xl border-2 ps-12 text-lg font-bold text-start" dir="ltr" placeholder="client@example.com" />
                </div>
             </div>
             <div className="space-y-2 text-start">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
                <Input {...form.register('civilId')} maxLength={12} className="h-14 rounded-2xl border-2 font-mono text-lg" />
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Card */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-blue-50/50 p-8 border-b flex items-center justify-between">
           <div className="text-start">
              <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'الموقع الجغرافي والعنوان' : 'Geographic Location'}</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? 'تحديد موقع القسيمة أو المشروع المرتبط' : 'Locate plot or project site'}</p>
           </div>
           <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
              <MapPin className="h-6 w-6" />
           </div>
        </div>
        <CardContent className="p-10 space-y-8 text-start">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المحافظة' : 'Governorate'}</Label>
                 <Select value={form.watch('governorateId')} onValueChange={handleGovChange}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                       <SelectValue placeholder={isRtl ? "اختر المحافظة" : "Select Gov"} />
                    </SelectTrigger>
                    <SelectContent>
                       {governorates?.map(g => <SelectItem key={g.id} value={g.id!}>{isRtl ? g.name : g.nameEn}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المنطقة' : 'Area'}</Label>
                 <Select value={form.watch('areaId')} onValueChange={handleAreaChange} disabled={!selectedGovId}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                       <SelectValue placeholder={isRtl ? "اختر المنطقة" : "Select Area"} />
                    </SelectTrigger>
                    <SelectContent>
                       {areas?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
              {['block', 'street', 'houseNumber'].map((field) => (
                <div key={field} className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {isRtl ? (field === 'block' ? 'القطعة' : field === 'street' ? 'الشارع' : 'قسيمة/منزل') : field}
                   </Label>
                   <Input {...form.register(field as any)} className="h-12 rounded-xl border-2" />
                </div>
              ))}
           </div>
        </CardContent>
      </Card>

      {/* Assignments Card */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-amber-50/50 p-8 border-b flex items-center justify-between">
           <div className="text-start">
              <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'المهام والملاحظات' : 'Assignments & Notes'}</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? 'ربط العميل بمهندس وتوثيق الملاحظات' : 'Assign engineer and track notes'}</p>
           </div>
           <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
              <HardHat className="h-6 w-6" />
           </div>
        </div>
        <CardContent className="p-10 space-y-8 text-start">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المهندس المسؤول' : 'Assigned Engineer'}</Label>
                 <Select value={form.watch('assignedEngineerId')} onValueChange={handleEngineerChange}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                       <SelectValue placeholder={isRtl ? "اختر مهندساً" : "Select Engineer"} />
                    </SelectTrigger>
                    <SelectContent>
                       {employees?.map(e => <SelectItem key={e.id} value={e.id!}>{e.fullName}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'مصدر العميل' : 'Source'}</Label>
                 <Input {...form.register('source')} className="h-14 rounded-2xl border-2" placeholder={isRtl ? "مثلاً: إعلان انستقرام" : "e.g. Ad"} />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات إضافية' : 'General Notes'}</Label>
                 <Textarea {...form.register('notes')} className="min-h-[120px] rounded-[2rem] border-2 p-6 text-lg focus:bg-slate-50 transition-all" />
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-6">
        <Button 
          type="submit" 
          disabled={loading}
          className="h-20 rounded-[2.5rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
          {initialData ? (isRtl ? 'تحديث بيانات العميل' : 'Update Profile') : (isRtl ? 'إنشاء ملف العميل' : 'Create Profile')}
        </Button>
      </div>
    </form>
  );
}
