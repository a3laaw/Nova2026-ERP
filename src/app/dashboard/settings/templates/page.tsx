
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutTemplate, FileText, Gavel, FileSpreadsheet, 
  Sparkles, ChevronRight, Plus,
  ShieldCheck, Zap, Layers
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function TemplatesHubPage() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const templateModules = [
    {
      id: 'quotations',
      title: t('quotationTemplates'),
      desc: isRtl ? 'بناء قوالب تسعير مرنة مع صلاحيات العرض وشروط الدفع.' : 'Build flexible pricing templates with validity and payment terms.',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/settings/templates/quotations',
      count: isRtl ? '8 نشط' : '8 Active'
    },
    {
      id: 'contracts',
      title: t('contractTemplates'),
      desc: isRtl ? 'صياغة العقود القانونية وربط الدفعات المالية بالمراحل الفنية.' : 'Draft legal contracts and link installments to technical stages.',
      icon: Gavel,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      path: '/dashboard/settings/templates/contracts',
      count: isRtl ? '5 قانوني' : '5 Legal'
    },
    {
      id: 'boq',
      title: t('boqTemplates'),
      desc: isRtl ? 'توصيف بنود الأعمال الهندسية، الكميات، والأسعار المرجعية.' : 'Define engineering work items, quantities, and reference rates.',
      icon: FileSpreadsheet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/settings/templates/boq',
      count: isRtl ? '12 مقايسة' : '12 Estim.'
    }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-1">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <LayoutTemplate className="h-10 w-10 text-primary" />
            {t('templates')}
          </h1>
          <p className="text-muted-foreground font-bold text-sm opacity-80 italic">
            {t('templatesDesc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {templateModules.map((module) => (
          <Card 
            key={module.id} 
            className="border-0 shadow-2xl rounded-[3rem] bg-white group hover:shadow-primary/5 transition-all cursor-pointer overflow-hidden border-b-8"
            style={{ borderBottomColor: `var(--${module.id}-color)` }}
            onClick={() => router.push(module.path)}
          >
            <CardHeader className="p-10 pb-6 text-start">
               <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-lg", module.bg, module.color)}>
                  <module.icon className="h-8 w-8" />
               </div>
               <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl font-black font-headline text-slate-900">{module.title}</CardTitle>
               </div>
               <CardDescription className="text-base font-bold leading-relaxed mt-4">
                  {module.desc}
               </CardDescription>
            </CardHeader>
            <CardContent className="p-10 pt-0 text-start">
               <div className={cn("flex items-center gap-2 font-black text-xs transition-all mt-8", module.color)}>
                  {isRtl ? 'إدارة المكتبة' : 'Manage Library'}
                  <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
