
'use client';

import { WorkHoursManager } from '@/components/settings/work-hours-manager';
import { useLanguage } from '@/context/language-context';

export default function WorkHoursSettingsPage() {
  const { dir } = useLanguage();

  return (
    <div className="container mx-auto max-w-6xl" dir={dir}>
      <WorkHoursManager />
    </div>
  );
}
