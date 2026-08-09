'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Settings2, Building2, UserCog, Database, ArrowLeft, ShieldCheck, Clock, Users,
  LayoutTemplate
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

export default function SettingsHubPage() {
  const { t, dir, isRtl } = useLanguage();
  const { isAdmin, check } = usePermissions();
  const router = useRouter();

  const settingsCards = [
    {
      id: 'company',
      title: t('companyidentity'),
      description: t('managecompanydata'),
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/settings/company',
      visible: isAdmin
    },
    {
      id: 'users',
      title: t('usersmanagement'),
      description: t('users.management'),
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      path: '/dashboard/settings/users',
      visible: isAdmin
    },
    {
      id: 'checklists',
      title: t('settings.checklists'),
      description: t('settings.checklists.desc'),
      icon: Database,
      color: 'text-primary',
      bg: 'bg-primary/5',
      path: '/dashboard/settings/checklists',
      visible: check('ref', 'view').can
    },
    {
      id: 'templates',
      title: t('templates'),
      description: t('templatesdesc'),
      icon: LayoutTemplate,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/settings/templates',
      visible: true
    },
    {
      id: 'roles',
      title: t('rolespermissions'),
      description: t('rolespermissions'),
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      path: '/dashboard/settings/roles',
      visible: isAdmin
    },
    {
      id: 'work-hours',
      title: t('workhours'),
      description: t('workhours'),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      path: '/dashboard/settings/work-hours',
      visible: true
    },
    {
      id: 'profile',
      title: t('userprofile'),
      description: t('userprofile'),
      icon: UserCog,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/settings/profile',
      visible: true
    }
  ].filter(card => card.visible);

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Settings2 className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('settings')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">
               {isRtl ? 'إدارة تفضيلات النظام، الهوية البصرية، وقواعد العمل الأساسية.' : 'Manage system preferences and organization settings.'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {settingsCards.map((card) => (
          <Card 
            key={card.id} 
            className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-[2.5rem] bg-white cursor-pointer group overflow-hidden"
            onClick={() => router.push(card.path)}
          >
            <CardHeader className="p-8 pb-4 text-start">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-lg", card.bg, card.color)}>
                <card.icon className="h-7 w-7" />
              </div>
              <CardTitle className="text-xl font-black font-headline">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 text-start">
              <p className="text-muted-foreground text-sm font-bold leading-relaxed mb-6 h-12 overflow-hidden">
                {card.description}
              </p>
              <div className="flex items-center gap-2 text-primary font-black text-sm group-hover:gap-4 transition-all">
                {isRtl ? 'ضبط الإعدادات' : 'Configure'}
                <ArrowLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
