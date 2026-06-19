'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Settings2, ClipboardList, Building2, ShieldCheck, 
  UserCog, BellRing, Database, ChevronLeft, ArrowLeft
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function SettingsHubPage() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const settingsCards = [
    {
      id: 'checklists',
      title: t('checklists'),
      description: isRtl ? 'إدارة الدستور التشغيلي والقواعد المرجعية للنظام' : 'Manage operational constitution and system references',
      icon: Database,
      color: 'text-primary',
      bg: 'bg-primary/10',
      path: '/dashboard/settings/checklists'
    },
    {
      id: 'profile',
      title: t('profile'),
      description: isRtl ? 'تعديل بيانات الحساب الشخصي وكلمة المرور' : 'Edit personal profile and password',
      icon: UserCog,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/settings/profile'
    },
    {
      id: 'notifications',
      title: isRtl ? 'التنبيهات' : 'Notifications',
      description: isRtl ? 'ضبط إشعارات النظام والبريد الإلكتروني' : 'Configure system and email notifications',
      icon: BellRing,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      path: '/dashboard/settings/notifications'
    }
  ];

  return (
    <div className="space-y-8" dir={dir}>
      <div className="text-start">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3">
          <Settings2 className="h-10 w-10 text-primary" />
          {t('settings')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'إدارة تفضيلات النظام وإعدادات المنشأة' : 'Manage system preferences and organization settings'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCards.map((card) => (
          <Card 
            key={card.id} 
            className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-[2.5rem] bg-white cursor-pointer group overflow-hidden"
            onClick={() => router.push(card.path)}
          >
            <CardHeader className="p-8 pb-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", card.bg, card.color)}>
                <card.icon className="h-7 w-7" />
              </div>
              <CardTitle className="text-xl font-black font-headline">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <p className="text-muted-foreground text-sm font-bold leading-relaxed mb-6 h-10 overflow-hidden">
                {card.description}
              </p>
              <div className="flex items-center gap-2 text-primary font-black text-sm group-hover:gap-4 transition-all">
                {isRtl ? 'الانتقال للضبط' : 'Go to settings'}
                <ArrowLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
