
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function DeveloperDashboard() {
  const db = useFirestore();
  const requestsQuery = db ? query(collection(db, 'company_requests'), orderBy('createdAt', 'desc')) : null;
  const { data: requests, loading } = useCollection(requestsQuery);

  const handleActivate = async (requestId: string) => {
    if (!db) return;
    try {
      const requestRef = doc(db, 'company_requests', requestId);
      await updateDoc(requestRef, {
        status: 'activated'
      });
      toast({
        title: "تم تحديث الحالة",
        description: "تم نقل الطلب إلى حالة 'مفعل'. يرجى إكمال إجراءات الـ Onboarding يدوياً للمرحلة الحالية.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "فشل التحديث",
        description: "حدث خطأ أثناء محاولة تحديث حالة الطلب.",
      });
    }
  };

  return (
    <div className="space-y-8" dir="ltr">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black font-headline text-slate-900">Onboarding Requests</h2>
          <p className="text-slate-500">Manage pending company registrations and tenant activation.</p>
        </div>
        <Badge variant="outline" className="bg-white px-4 py-2 font-bold">
          Total: {requests?.length || 0}
        </Badge>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-white border-b p-6">
          <CardTitle className="text-lg font-bold">Registration Pipeline</CardTitle>
          <CardDescription>Review and approve new organization access requests.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-slate-400 font-medium">Fetching requests...</p>
                  </TableCell>
                </TableRow>
              ) : requests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-slate-400">
                    No onboarding requests found in the pipeline.
                  </TableCell>
                </TableRow>
              ) : (
                requests?.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-bold text-slate-900">{req.companyName}</TableCell>
                    <TableCell>{req.contactName}</TableCell>
                    <TableCell className="font-mono text-xs">{req.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{req.activity}</Badge>
                    </TableCell>
                    <TableCell>
                      {req.status === 'pending' && (
                        <Badge className="bg-amber-100 text-amber-700 flex w-fit items-center gap-1">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                      {req.status === 'activated' && (
                        <Badge className="bg-emerald-100 text-emerald-700 flex w-fit items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Activated
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleActivate(req.id)}
                          className="bg-primary hover:bg-primary/90 text-white font-bold rounded-lg"
                        >
                          Activate Tenant
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled className="text-slate-400">
                          <CheckCircle className="h-4 w-4 mr-2" /> Complete
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 text-white border-0 rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Active Tenants</h4>
          <p className="text-4xl font-black font-headline">24</p>
          <div className="mt-4 flex items-center gap-1 text-emerald-400 text-xs font-bold">
            <CheckCircle className="h-3 w-3" /> All systems operational
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-xl rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Pending Review</h4>
          <p className="text-4xl font-black font-headline text-slate-900">
            {requests?.filter((r: any) => r.status === 'pending').length || 0}
          </p>
          <div className="mt-4 flex items-center gap-1 text-amber-500 text-xs font-bold">
            <Clock className="h-3 w-3" /> Actions required
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-xl rounded-3xl p-6">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Infrastructure</h4>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-blue-500">Firebase</Badge>
            <Badge className="bg-orange-500">Genkit AI</Badge>
          </div>
          <Button variant="link" className="px-0 mt-4 text-primary font-bold h-auto">
            View Cloud Console <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
