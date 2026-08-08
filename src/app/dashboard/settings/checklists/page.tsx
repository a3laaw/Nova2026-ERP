
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, Building2, MapPin, Workflow, 
  ListTree, GitBranch, Settings2, Landmark
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import DepartmentsPage from './departments/page';
import GeoPage from './geo/page';
import TechnicalPathsPage from './technical-paths/page';
import GeneralListsPage from './general-lists/page';
import BOQNodesPage from './boq-nodes/page';
import HallsPage from './halls/page';
import { SeedTool } from './seed-tool';

export default function TechnicalSetupPage() {
  const { t, lang, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl md:text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Database className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            {t('settings.checklists') || t('checklists')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic text-start">
            {isRtl ? 'إدارة الدستور التشغيلي والقواعد المرجعية الموحدة للنظام' : 'Manage operational constitution and unified system references'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir={dir}>
        <div className="overflow-x-auto pb-4 scrollbar-hide">
          <TabsList className="flex w-fit min-w-full md:min-w-0 md:flex h-14 bg-white border border-primary/10 rounded-xl p-1 shadow-sm gap-2">
            <TabsTrigger 
              value="general" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <ListTree className="h-4 w-4" /> {t('referenceLists')}
            </TabsTrigger>
            <TabsTrigger 
              value="boq_nodes" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <GitBranch className="h-4 w-4" /> {t('boqMasterTree')}
            </TabsTrigger>
            <TabsTrigger 
              value="halls" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <Landmark className="h-4 w-4" /> {t('halls')}
            </TabsTrigger>
            <TabsTrigger 
              value="org" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <Building2 className="h-4 w-4" /> {t('orgRef')}
            </TabsTrigger>
            <TabsTrigger 
              value="technical" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <Workflow className="h-4 w-4" /> {t('techRef')}
            </TabsTrigger>
            <TabsTrigger 
              value="geo" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <MapPin className="h-4 w-4" /> {t('geoRef')}
            </TabsTrigger>
            <TabsTrigger 
              value="setup" 
              className="tab-sovereign rounded-lg font-black gap-2 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center px-6 h-full flex-1 text-xs"
            >
              <Settings2 className="h-4 w-4" /> {t('systemSetup')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-6">
          <GeneralListsPage />
        </TabsContent>

        <TabsContent value="boq_nodes" className="mt-6">
          <BOQNodesPage />
        </TabsContent>

        <TabsContent value="halls" className="mt-6">
          <HallsPage />
        </TabsContent>

        <TabsContent value="org" className="mt-6">
          <DepartmentsPage />
        </TabsContent>

        <TabsContent value="technical" className="mt-6">
           <TechnicalPathsPage />
        </TabsContent>

        <TabsContent value="geo" className="mt-6">
           <GeoPage />
        </TabsContent>

        <TabsContent value="setup" className="mt-6 max-w-4xl mx-auto">
           <SeedTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}
