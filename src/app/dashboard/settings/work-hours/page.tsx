'use client';

import { WorkHoursManager } from '@/components/settings/work-hours-manager';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function WorkHoursSettingsPage() {
  const router = useRouter();
  const { lang, dir } = useLanguage();
  const isRtl = lang === 'ar';

  return (
    <div className="container mx-auto max-w-6xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/dashboard/settings')}
          className="rounded-xl h-10 gap-2 bg-white shadow-sm border border-slate-100 hover:bg-slate-50"
        >
          <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          العودة للإعدادات
        </Button>
      </div>
      <WorkHoursManager />
    </div>
  );
}
