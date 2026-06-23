'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  LayoutTemplate, FileText, Gavel, FileSpreadsheet, 
  ArrowRight, Sparkles, ChevronRight, Plus,
  ShieldCheck, Zap, Layers
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

/**
 * مركز القوالب الموحد (Templates Hub)
 * يجمع عروض الأسعار، العقود، والمقايسات في واجهة سيادية واحدة.
 */
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
      count: '8 Active'
    },
    {
      id: 'contracts',
      title: t('contractTemplates'),
      desc: isRtl ? 'صياغة العقود القانونية وربط الدفعات المالية بالمراحل الفنية.' : 'Draft legal contracts and link installments to technical stages.',
      icon: Gavel,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      path: '/dashboard/settings/templates/contracts',
      count: '5 Legal'
    },
    {
      id: 'boq',
      title: t('boqTemplates'),
      desc: isRtl ? 'توصيف بنود الأعمال الهندسية، الكميات، والأسعار المرجعية.' : 'Define engineering work items, quantities, and reference rates.',
      icon: FileSpreadsheet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/settings/templates/boq',
      count: '12 Estim.'
    }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/dashboard/settings')}
            className="rounded-xl h-12 w-12 bg-white shadow-sm border"
          >
            <ArrowRight className={cn("h-6 w-6", isRtl ? "rotate-0" : "rotate-180")} />
          </Button>
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
                  <Badge variant="secondary" className="bg-slate-50 text-slate-400 font-black text-[9px] uppercase tracking-widest">{module.count}</Badge>
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

      <div className="bg-slate-900 text-white rounded-[3rem] p-12 flex flex-col md:flex-row justify-between items-center gap-10 shadow-3xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:rotate-12 transition-transform duration-700">
            <Sparkles className="h-48 w-48 text-primary" />
         </div>
         <div className="text-start space-y-4 relative z-10">
            <h2 className="text-3xl font-black font-headline tracking-tight">{isRtl ? 'المحرك الذكي للمستندات' : 'Smart Document Engine'}</h2>
            <p className="text-slate-400 text-lg font-bold max-w-xl leading-relaxed">
               {isRtl ? 'جميع القوالب التي تنشئها هنا مرتبطة آلياً بالمسارات الفنية لمشاريعك، مما يضمن أتمتة إصدار العروض والعقود الفعلية.' : 'All templates created here are automatically linked to technical paths, ensuring automated generation of quotes and contracts.'}
            </p>
            <div className="flex gap-6 pt-4">
               <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest"><ShieldCheck className="h-4 w-4" /> Legal Compliance</div>
               <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest"><Zap className="h-4 w-4" /> Auto-Instantiation</div>
            </div>
         </div>
      </div>
    </div>
  );
}
