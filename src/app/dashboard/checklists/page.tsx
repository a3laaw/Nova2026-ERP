'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, Building2, MapPin, Workflow, ShieldCheck
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import DepartmentsPage from './departments/page';
import GeoPage from './geo/page';

export default function ReferenceHubPage() {
  const { t, lang, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState("org");
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Database className="h-10 w-10 text-primary" />
            {t('checklists')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة الدستور التشغيلي والقواعد المرجعية للنظام' : 'Manage operational constitution and system references'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir={dir}>
        <TabsList className="grid grid-cols-3 w-full max-w-3xl mx-auto h-16 bg-muted/30 rounded-3xl p-2 shadow-inner">
          <TabsTrigger value="org" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center">
            <Building2 className="h-5 w-5" /> {t('orgRef')}
          </TabsTrigger>
          <TabsTrigger value="technical" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center">
            <Workflow className="h-5 w-5" /> {t('techRef')}
          </TabsTrigger>
          <TabsTrigger value="geo" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center">
            <MapPin className="h-5 w-5" /> {t('geoRef')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-8">
          <DepartmentsPage />
        </TabsContent>

        <TabsContent value="technical" className="mt-8 text-center py-20 bg-white rounded-[3rem] shadow-xl">
           <Workflow className="h-20 w-20 mx-auto text-muted-foreground/20 mb-4" />
           <p className="font-bold text-muted-foreground italic">{isRtl ? 'قيد التطوير - المسارات الفنية' : 'Under Development - Technical Paths'}</p>
        </TabsContent>

        <TabsContent value="geo" className="mt-8">
           <GeoPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
