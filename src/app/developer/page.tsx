
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

export default function DeveloperDashboard() {
  const db = useFirestore();
  const requestsQuery = db ? query(collection(db, 'company_requests'), orderBy('createdAt', 'desc')) : null;
  const { data: requests, loading } = useCollection(requestsQuery);

  const handleUpdateStatus = async (requestId: string, newStatus: 'activated' | 'rejected') => {
    if (!db) return;
    const requestRef = doc(db, 'company_requests', requestId);
    
    updateDoc(requestRef, { status: newStatus })
      .then(() => {
        toast({
          title: newStatus === 'activated' ? "تم تفعيل المنشأة" : "تم رفض الطلب",
          description: `تم تحديث حالة الطلب بنجاح إلى ${newStatus === 'activated' ? 'مفعل' : 'مرفوض'}.`,
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

  return (
    <div className="space-y-8" dir="ltr">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black font-headline text-slate-900">Developer Control Center</h2>
          <p className="text-slate-500">Manage onboarding requests and tenant lifecycle.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-white px-4 py-2 font-bold border-primary/20 text-primary">
            Pending: {requests?.filter((r: any) => r.status === 'pending').length || 0}
          </Badge>
          <Badge variant="outline" className="bg-white px-4 py-2 font-bold">
            Total Requests: {requests?.length || 0}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-0 rounded-3xl p-6 shadow-xl">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Active Tenants</h4>
          <p className="text-4xl font-black font-headline">24</p>
          <div className="mt-4 flex items-center gap-1 text-emerald-400 text-xs font-bold">
            <CheckCircle className="h-3 w-3" /> System Healthy
          </div>
        </Card>
        
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Activated Today</h4>
          <p className="text-4xl font-black font-headline text-slate-900">
            {requests?.filter((r: any) => r.status === 'activated').length || 0}
          </p>
          <div className="mt-4 flex items-center gap-1 text-blue-500 text-xs font-bold">
            <ExternalLink className="h-3 w-3" /> Growth +12%
          </div>
        </Card>

        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Rejected</h4>
          <p className="text-4xl font-black font-headline text-slate-900">
            {requests?.filter((r: any) => r.status === 'rejected').length || 0}
          </p>
          <div className="mt-4 flex items-center gap-1 text-rose-500 text-xs font-bold">
            <ShieldAlert className="h-3 w-3" /> Compliance filter
          </div>
        </Card>

        <Card className="bg-primary text-white border-0 shadow-xl rounded-3xl p-6">
          <h4 className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest mb-2">Infrastructure</h4>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-white/20 border-0 text-white">Firebase</Badge>
            <Badge className="bg-white/20 border-0 text-white">Genkit</Badge>
          </div>
          <p className="text-[10px] mt-4 opacity-80">Region: europe-west3</p>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="border-b p-6">
          <CardTitle className="text-lg font-bold">Incoming Requests Pipeline</CardTitle>
          <CardDescription>Review, Activate or Reject new company registrations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Decision Tool</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-slate-400 font-medium">Syncing with Cloud Firestore...</p>
                  </TableCell>
                </TableRow>
              ) : requests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-slate-400">
                    The request pipeline is currently empty.
                  </TableCell>
                </TableRow>
              ) : (
                requests?.map((req: any) => (
                  <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-900">{req.companyName}</TableCell>
                    <TableCell>{req.contactName}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{req.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize bg-slate-100">{req.activity}</Badge>
                    </TableCell>
                    <TableCell>
                      {req.status === 'pending' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex w-fit items-center gap-1">
                          <Clock className="h-3 w-3" /> Waiting
                        </Badge>
                      )}
                      {req.status === 'activated' && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 flex w-fit items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Live
                        </Badge>
                      )}
                      {req.status === 'rejected' && (
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200 flex w-fit items-center gap-1">
                          <XCircle className="h-3 w-3" /> Declined
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleUpdateStatus(req.id, 'rejected')}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateStatus(req.id, 'activated')}
                            className="bg-primary hover:bg-primary/90 text-white font-bold"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Activate
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" disabled className="text-slate-300">
                          Processed
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
