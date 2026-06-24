'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, Building2, MapPin, Workflow, Settings2, ArrowRight,
  ListTree
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import DepartmentsPage from './departments/page';
import GeoPage from './geo/page';
import TechnicalPathsPage from './technical-paths/page';
import GeneralListsPage from './general-lists/page';
import { SeedTool } from './seed-tool';

export default function TechnicalSetupPage() {
  const { t, lang, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");
  const router = useRouter();
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 text-start">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/dashboard/settings')}
            className="rounded-xl h-10 w-10 bg-white shadow-sm border"
          >
            <ArrowRight className={cn("h-5 w-5", isRtl ? "rotate-0" : "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
              <Database className="h-10 w-10 text-primary" />
              {t('checklists')}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? 'إدارة الدستور التشغيلي والقواعد المرجعية الموحدة للنظام' : 'Manage operational constitution and unified system references'}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir={dir}>
        <div className="overflow-x-auto pb-4 scrollbar-hide">
          <TabsList className="flex w-fit min-w-full md:min-w-0 md:grid md:grid-cols-5 h-14 bg-white border-2 border-slate-100 rounded-xl p-1 shadow-sm gap-1">
            <TabsTrigger 
              value="general" 
              className="rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-xl flex items-center justify-center px-6 h-full"
            >
              <ListTree className="h-4 w-4" /> {t('referenceLists')}
            </TabsTrigger>
            <TabsTrigger 
              value="org" 
              className="rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-xl flex items-center justify-center px-6 h-full"
            >
              <Building2 className="h-4 w-4" /> {t('orgRef')}
            </TabsTrigger>
            <TabsTrigger 
              value="technical" 
              className="rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-xl flex items-center justify-center px-6 h-full"
            >
              <Workflow className="h-4 w-4" /> {t('techRef')}
            </TabsTrigger>
            <TabsTrigger 
              value="geo" 
              className="rounded-lg font-black gap-2 transition-all data-[state=active]:bg-[#F57C00] data-[state=active]:text-white data-[state=active]:shadow-xl flex items-center justify-center px-6 h-full"
            >
              <MapPin className="h-4 w-4" /> {t('geoRef')}
            </TabsTrigger>
            <TabsTrigger 
              value="setup" 
              className="rounded-lg font-black gap-2 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-xl flex items-center justify-center px-6 h-full"
            >
              <Settings2 className="h-4 w-4" /> {t('systemSetup')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-6">
          <GeneralListsPage />
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
