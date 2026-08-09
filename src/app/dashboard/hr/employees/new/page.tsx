'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { HRService } from '@/services/hr-service';
import { EmployeeForm } from '@/components/hr/employee-form';
import { toast } from '@/hooks/use-toast';

export default function NewEmployeePage() {
  const { globalUser } = useAuthContext();
  const { t, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const companyId = globalUser?.companyId;
  const hrService = useMemo(() => 
    db && companyId ? new HRService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const handleSubmit = async (data: any) => {
    if (!hrService) return;
    setLoading(true);
    try {
      await hrService.addEmployee(data);
      toast({ title: t('common.saved') });
      router.push('/dashboard/hr/employees');
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error'), description: t('common.error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto" dir={dir}>
      <div className="flex items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-primary" />
            {t('hr.addNew')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {t('hr.createIntegratedProfile')}
          </p>
        </div>
      </div>

      <EmployeeForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
