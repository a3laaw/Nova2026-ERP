'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink, ShieldAlert } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function DeveloperDashboard() {
  const { t, lang } = useLanguage();
  const db = useFirestore();
  const requestsQuery = db ? query(collection(db, 'company_requests'), orderBy('createdAt', 'desc')) : null;
  const { data: requests, loading } = useCollection(requestsQuery);

  const handleUpdateStatus = async (requestId: string, newStatus: 'activated' | 'rejected') => {
    if (!db) return;
    const requestRef = doc(db, 'company_requests', requestId);
    
    updateDoc(requestRef, { status: newStatus })
      .then(() => {
        toast({
          title: newStatus === 'activated' ? t('live') : t('declined'),
          description: "Success",
        });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: `company_requests/${requestId}`,
          operation: 'update',
          requestResourceData: { status: newStatus },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const isRtl = lang === 'ar';

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <div className={cn("flex justify-between items-end", isRtl ? "flex-row" : "flex-row")}>
        <div className={isRtl ? "text-right" : "text-left"}>
          <h2 className="text-3xl font-black font-headline text-slate-900">{t('devConsole')}</h2>
          <p className="text-slate-500">{t('devSubTitle')}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-white px-4 py-2 font-bold border-primary/20 text-primary">
            {t('pending')}: {requests?.filter((r: any) => r.status === 'pending').length || 0}
          </Badge>
          <Badge variant="outline" className="bg-white px-4 py-2 font-bold">
            {t('totalRequests')}: {requests?.length || 0}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-0 rounded-3xl p-6 shadow-xl">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">{t('activeTenants')}</h4>
          <p className="text-4xl font-black font-headline">24</p>
          <div className={cn("mt-4 flex items-center gap-1 text-emerald-400 text-xs font-bold", isRtl ? "flex-row-reverse" : "flex-row")}>
            <CheckCircle className="h-3 w-3" /> System Healthy
          </div>
        </Card>
        
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">{t('activatedToday')}</h4>
          <p className="text-4xl font-black font-headline text-slate-900">
            {requests?.filter((r: any) => r.status === 'activated').length || 0}
          </p>
          <div className={cn("mt-4 flex items-center gap-1 text-blue-500 text-xs font-bold", isRtl ? "flex-row-reverse" : "flex-row")}>
            <ExternalLink className="h-3 w-3" /> Growth +12%
          </div>
        </Card>

        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">{t('rejected')}</h4>
          <p className="text-4xl font-black font-headline text-slate-900">
            {requests?.filter((r: any) => r.status === 'rejected').length || 0}
          </p>
          <div className={cn("mt-4 flex items-center gap-1 text-rose-500 text-xs font-bold", isRtl ? "flex-row-reverse" : "flex-row")}>
            <ShieldAlert className="h-3 w-3" /> Compliance filter
          </div>
        </Card>

        <Card className="bg-primary text-white border-0 shadow-xl rounded-3xl p-6">
          <h4 className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest mb-2">{t('infrastructure')}</h4>
          <div className={cn("flex items-center gap-2 mt-2", isRtl ? "flex-row-reverse" : "flex-row")}>
            <Badge className="bg-white/20 border-0 text-white">Firebase</Badge>
            <Badge className="bg-white/20 border-0 text-white">Genkit</Badge>
          </div>
          <p className="text-[10px] mt-4 opacity-80">Region: europe-west3</p>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className={cn("border-b p-6", isRtl ? "text-right" : "text-left")}>
          <CardTitle className="text-lg font-bold">{t('pipelineTitle')}</CardTitle>
          <CardDescription>{t('pipelineDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className={isRtl ? "text-right" : "text-left"}>{t('org')}</TableHead>
                <TableHead className={isRtl ? "text-right" : "text-left"}>{t('contact')}</TableHead>
                <TableHead className={isRtl ? "text-right" : "text-left"}>Email</TableHead>
                <TableHead className={isRtl ? "text-right" : "text-left"}>{t('industry')}</TableHead>
                <TableHead className={isRtl ? "text-right" : "text-left"}>{t('status')}</TableHead>
                <TableHead className={isRtl ? "text-left" : "text-right"}>{t('decision')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-slate-400 font-medium">Syncing...</p>
                  </TableCell>
                </TableRow>
              ) : requests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-slate-400">
                    No requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests?.map((req: any) => (
                  <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className={cn("font-bold text-slate-900", isRtl ? "text-right" : "text-left")}>{req.companyName}</TableCell>
                    <TableCell className={isRtl ? "text-right" : "text-left"}>{req.contactName}</TableCell>
                    <TableCell className={cn("font-mono text-xs text-slate-500", isRtl ? "text-right" : "text-left")}>{req.email}</TableCell>
                    <TableCell className={isRtl ? "text-right" : "text-left"}>
                      <Badge variant="secondary" className="capitalize bg-slate-100">{req.activity}</Badge>
                    </TableCell>
                    <TableCell className={isRtl ? "text-right" : "text-left"}>
                      {req.status === 'pending' && (
                        <Badge className={cn("bg-amber-100 text-amber-700 border-amber-200 flex w-fit items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                          <Clock className="h-3 w-3" /> {t('waiting')}
                        </Badge>
                      )}
                      {req.status === 'activated' && (
                        <Badge className={cn("bg-emerald-100 text-emerald-700 border-emerald-200 flex w-fit items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                          <CheckCircle className="h-3 w-3" /> {t('live')}
                        </Badge>
                      )}
                      {req.status === 'rejected' && (
                        <Badge className={cn("bg-rose-100 text-rose-700 border-rose-200 flex w-fit items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                          <XCircle className="h-3 w-3" /> {t('declined')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={isRtl ? "text-left" : "text-right"}>
                      {req.status === 'pending' ? (
                        <div className={cn("flex gap-2", isRtl ? "justify-start" : "justify-end")}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleUpdateStatus(req.id, 'rejected')}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            <XCircle className="h-4 w-4 ml-1" /> {t('reject')}
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateStatus(req.id, 'activated')}
                            className="bg-primary hover:bg-primary/90 text-white font-bold"
                          >
                            <CheckCircle className="h-4 w-4 ml-1" /> {t('activate')}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" disabled className="text-slate-300">
                          {t('processed')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
