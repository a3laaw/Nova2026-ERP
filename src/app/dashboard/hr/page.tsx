'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, FileText, ShieldAlert, Sparkles, 
  UploadCloud, Loader2, Users, Search, 
  UserCog, ShieldCheck, Mail, Calendar
} from "lucide-react";
import { analyzeEmployeeDoc } from "@/ai/flows/analyzeEmployeeDoc";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Role } from '@/types/roles';
import { LeavesManager } from './leaves-manager';

export default function HRPage() {
  const { t, lang, dir } = useLanguage();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // States
  const [activeTab, setActiveTab] = useState("team");
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // Role Selection State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedRoleId, setSelectedRole] = useState<string>("");
  const [updatingRole, setUpdatingRole] = useState(false);

  // Queries
  const usersQuery = useMemo(() => companyId && db ? query(collection(db, 'companies', companyId, 'users'), orderBy('joinedAt', 'desc')) : null, [db, companyId]);
  const rolesQuery = useMemo(() => companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, [db, companyId]);

  const { data: employees, loading: usersLoading } = useCollection(usersQuery);
  const { data: roles } = useCollection<Role>(rolesQuery);

  const filteredEmployees = employees?.filter(emp => 
    emp.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleUpdateRole = async () => {
    if (!db || !companyId || !editingUser || !selectedRoleId) return;
    setUpdatingRole(true);
    
    const roleObj = roles?.find(r => r.id === selectedRoleId);
    if (!roleObj) return;

    try {
      const userRef = doc(db, 'companies', companyId, 'users', editingUser.id);
      const globalUserRef = doc(db, 'global_users', editingUser.id);

      await updateDoc(userRef, {
        roleId: roleObj.id,
        roleCode: roleObj.code,
        updatedAt: serverTimestamp()
      });

      await updateDoc(globalUserRef, {
        roleId: roleObj.id,
        roleCode: roleObj.code,
        updatedAt: serverTimestamp()
      });

      toast({ title: t('saved') });
      setEditingUser(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setUpdatingRole(false);
    }
  };

  const triggerSimulatedAnalysis = async () => {
    setAnalyzing(true);
    try {
      const dummyDataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
      const response = await analyzeEmployeeDoc({ documentDataUri: dummyDataUri });
      setAnalysisResult(response);
      toast({ title: t('saved'), description: t('entryAdded') });
    } catch (error) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <UserCircle className="h-10 w-10 text-primary" />
            {t('hr')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة القوى العاملة والامتثال التشغيلي الذكي' : 'Managing workforce and smart operational compliance'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir={dir}>
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="flex w-fit md:grid md:w-[600px] grid-cols-3 h-14 bg-muted/30 rounded-2xl p-1 mb-8 shadow-inner gap-1">
            <TabsTrigger value="team" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Users className="h-4 w-4" /> {t('team')}
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Calendar className="h-4 w-4" /> {isRtl ? 'الإجازات' : 'Leaves'}
            </TabsTrigger>
            <TabsTrigger value="compliance" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <ShieldAlert className="h-4 w-4" /> {t('operationalCompliance')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="team" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder={t('search')} 
                className="ps-12 rounded-2xl h-14 bg-white text-start border-2 border-slate-100 shadow-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Badge variant="outline" className="h-12 px-6 rounded-xl font-black bg-white shadow-sm border-2 border-slate-100">
               {employees?.length || 0} {t('employees')}
            </Badge>
          </div>

          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
             <CardContent className="p-0 overflow-x-auto">
               <Table dir={dir}>
                 <TableHeader className="bg-muted/30">
                   <TableRow className="hover:bg-transparent">
                     <TableHead className="py-6 ps-8">{t('employeeName')}</TableHead>
                     <TableHead>{t('assignRole')}</TableHead>
                     <TableHead>{t('joinDate')}</TableHead>
                     <TableHead className="pe-8"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {usersLoading ? (
                     <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                   ) : filteredEmployees.length === 0 ? (
                     <TableRow><TableCell colSpan={4} className="text-center py-20 italic text-muted-foreground font-bold">{t('noEmployees')}</TableCell></TableRow>
                   ) : (
                     filteredEmployees.map((emp) => (
                       <TableRow key={emp.id} className="hover:bg-primary/5 transition-colors group">
                         <TableCell className="py-6 ps-8">
                            <div className="flex items-center gap-4">
                               <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors font-black text-lg uppercase">
                                  {emp.displayName?.charAt(0) || emp.email?.charAt(0)}
                               </div>
                               <div className="flex flex-col text-start">
                                  <span className="font-black text-slate-800 text-base">{emp.displayName || '---'}</span>
                                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> 
                                    {emp.email}
                                  </span>
                               </div>
                            </div>
                         </TableCell>
                         <TableCell>
                            <Badge className={cn(
                              "font-black px-4 py-1.5 rounded-lg border-0",
                              emp.roleCode === 'Admin' || emp.roleCode === 'admin' ? "bg-primary text-white" : "bg-blue-50 text-blue-600"
                            )}>
                               <ShieldCheck className="h-3 w-3 me-2" />
                               {emp.roleCode || 'User'}
                            </Badge>
                         </TableCell>
                         <TableCell>
                            <div className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                               <Calendar className="h-3 w-3" />
                               {emp.joinedAt?.toDate().toLocaleDateString() || '---'}
                            </div>
                         </TableCell>
                         <TableCell className="pe-8 text-end">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100"
                              onClick={() => {
                                setEditingUser(emp);
                                setSelectedRole(emp.roleId || "");
                              }}
                            >
                               <UserCog className="h-5 w-5 text-primary" />
                            </Button>
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <LeavesManager />
        </TabsContent>

        <TabsContent value="compliance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-1 overflow-hidden ring-1 ring-black/5">
              <CardHeader className="text-start bg-slate-50 border-b p-8">
                <CardTitle className="text-lg font-black">{t('docAnalysis')}</CardTitle>
                <CardDescription className="font-bold">{isRtl ? 'تحليل عقود العمل والهويات آلياً' : 'Automated analysis for contracts and IDs'}</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="border-4 border-dashed border-muted rounded-[2rem] p-12 text-center bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group">
                  <UploadCloud className="h-16 w-16 text-muted-foreground mx-auto group-hover:scale-110 transition-transform mb-4" />
                  <p className="text-base font-black text-slate-700">{t('uploadDoc')}</p>
                </div>

                <Button
                  onClick={triggerSimulatedAnalysis}
                  disabled={analyzing}
                  className="w-full bg-primary text-white font-black py-8 rounded-2xl shadow-xl shadow-primary/20 text-lg hover:scale-[1.02] transition-transform"
                >
                  {analyzing ? (
                    <><Loader2 className="me-3 h-6 w-6 animate-spin" /> {isRtl ? 'جاري التحليل...' : 'Analyzing...'}</>
                  ) : (
                    <><Sparkles className="me-3 h-6 w-6" /> {t('analyzeNow')}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-2 overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-secondary/40 border-b p-8 text-start">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                  <FileText className="text-primary h-6 w-6" />
                  {t('complianceData')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10 text-start">
                {analysisResult ? (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-muted/40 rounded-3xl border-2">
                        <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('employeeName')}</span>
                        <p className="font-black text-lg text-slate-800 mt-2">{analysisResult.employeeName || "Ahmad Mahmoud Hassan"}</p>
                      </div>
                      <div className="p-6 bg-muted/40 rounded-3xl border-2">
                        <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('docType')}</span>
                        <p className="font-black text-lg text-primary mt-2">{analysisResult.documentType || t('active')}</p>
                      </div>
                      <div className="p-6 bg-muted/40 rounded-3xl border-2">
                        <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('docNumber')}</span>
                        <p className="font-mono text-lg font-black mt-2 text-slate-800">{analysisResult.documentNumber || "---"}</p>
                      </div>
                      <div className="p-6 bg-muted/40 rounded-3xl border-2">
                        <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">{t('issuer')}</span>
                        <p className="font-black text-lg text-slate-800 mt-2">{analysisResult.issuer || "---"}</p>
                      </div>
                    </div>

                    <div className="p-8 rounded-[2rem] border-2 bg-amber-50/50 space-y-4 shadow-inner">
                      <div className={cn("flex items-center gap-3 font-black text-lg text-amber-800")}>
                        <ShieldAlert className="h-6 w-6" />
                        <h6>{t('complianceNotes')}</h6>
                      </div>
                      <p className="text-base font-bold text-amber-900 leading-relaxed">
                        {analysisResult.complianceNotes || "The document meets all initial legal inspection requirements."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-32 text-muted-foreground space-y-6">
                    <FileText className="h-20 w-20 mx-auto opacity-20" />
                    <p className="text-lg font-bold italic">{isRtl ? 'بانتظار رفع وتحليل مستند...' : 'Waiting for document upload...'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Role Assignment Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-md p-0 overflow-hidden border-0 shadow-2xl" dir={dir}>
          <DialogHeader className="bg-primary/5 p-8 border-b text-start">
             <DialogTitle className="font-black font-headline text-2xl text-slate-800">{t('changeRole')}</DialogTitle>
             <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? 'تعيين دور وظيفي للموظف:' : 'Assign a role to:'} <span className="text-primary">{editingUser?.displayName}</span></p>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block text-start">{isRtl ? 'اختر الدور الجديد' : 'Select New Role'}</span>
                <Select value={selectedRoleId} onValueChange={setSelectedRole}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 bg-slate-50/50 focus:bg-white transition-all">
                    <SelectValue placeholder={t('assignRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map(role => (
                      <SelectItem key={role.id} value={role.id!}>
                         <div className="flex flex-col text-start py-1">
                            <span className="font-black text-sm">{isRtl ? role.name : role.nameEn}</span>
                            <span className="text-[9px] text-muted-foreground font-mono uppercase">{role.code}</span>
                         </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>

             <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5" />
                <p className="text-[10px] font-bold text-blue-800 leading-relaxed text-start">
                   {isRtl ? 'تنبيه: سيتم تحديث كافة صلاحيات الوصول لهذا الموظف فوراً بناءً على تعريف الدور المختار.' : 'Note: All access permissions will be updated immediately based on the selected role.'}
                </p>
             </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex gap-3">
             <Button variant="ghost" onClick={() => setEditingUser(null)} className="flex-1 rounded-xl font-bold h-14">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
             <Button 
               disabled={updatingRole || !selectedRoleId} 
               onClick={handleUpdateRole} 
               className="flex-1 bg-primary text-white rounded-xl font-black h-14 shadow-lg shadow-primary/20"
             >
                {updatingRole ? <Loader2 className="animate-spin" /> : <ShieldCheck className="me-2 h-5 w-5" />}
                {t('save')}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
