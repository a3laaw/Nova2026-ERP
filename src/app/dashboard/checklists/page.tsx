'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, Building2, MapPin, Workflow, LayoutGrid, Settings2
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import DepartmentsPage from './departments/page';
import GeoPage from './geo/page';
import ServiceTypesPage from './service-types/page';
import TechnicalPathsPage from './technical-paths/page';
import { SeedTool } from './seed-tool';

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
        <div className="overflow-x-auto pb-4 scrollbar-hide">
          <TabsList className="flex w-fit min-w-full md:min-w-0 md:grid md:grid-cols-5 h-16 bg-muted/30 rounded-3xl p-2 shadow-inner gap-2">
            <TabsTrigger value="org" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center px-6">
              <Building2 className="h-5 w-5" /> {t('orgRef')}
            </TabsTrigger>
            <TabsTrigger value="services" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center px-6">
              <LayoutGrid className="h-5 w-5" /> {isRtl ? 'أنشطة الأعمال' : 'Service Types'}
            </TabsTrigger>
            <TabsTrigger value="technical" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center px-6">
              <Workflow className="h-5 w-5" /> {t('techRef')}
            </TabsTrigger>
            <TabsTrigger value="geo" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center px-6">
              <MapPin className="h-5 w-5" /> {t('geoRef')}
            </TabsTrigger>
            <TabsTrigger value="setup" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center px-6">
              <Settings2 className="h-5 w-5" /> {isRtl ? 'تهيئة النظام' : 'System Setup'}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="org" className="mt-8">
          <DepartmentsPage />
        </TabsContent>

        <TabsContent value="services" className="mt-8">
          <ServiceTypesPage />
        </TabsContent>

        <TabsContent value="technical" className="mt-8">
           <TechnicalPathsPage />
        </TabsContent>

        <TabsContent value="geo" className="mt-8">
           <GeoPage />
        </TabsContent>

        <TabsContent value="setup" className="mt-8 max-w-4xl mx-auto">
           <SeedTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}
