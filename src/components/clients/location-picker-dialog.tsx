'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Loader2, 
  Crosshair,
  Map as MapIcon,
  CheckCircle2,
  MapPin,
  LocateFixed
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import dynamic from 'next/dynamic';
import { toast } from '@/hooks/use-toast';

const MapView = dynamic(() => import('./map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full rounded-[2.5rem] bg-slate-50 flex items-center justify-center border-4 border-slate-100">
      <div className="flex flex-col items-center gap-3">
         <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Initializing Smart Radar...</p>
      </div>
    </div>
  )
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  initialUrl?: string;
}

export function LocationPickerDialog({ isOpen, onClose, onSelect, initialUrl }: Props) {
  const { lang, dir } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [position, setPosition] = useState<[number, number]>([29.3759, 47.9774]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // استخراج الإحداثيات من الرابط عند الفتح (Sovereign Parser)
  useEffect(() => {
    if (initialUrl && isOpen) {
      const match = initialUrl.match(/q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/) || initialUrl.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          setPosition([lat, lng]);
        }
      }
    }
  }, [initialUrl, isOpen]);

  /**
   * خوارزمية البحث الذكية (Smart Search & Coordinate Detection)
   */
  const handleSearch = async () => {
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    // 1. فحص ما إذا كان المدخل عبارة عن إحداثيات (Lat, Lng)
    // يدعم الصيغ: 29.3, 47.9 أو 29.3 47.9
    const coordRegex = /^([-+]?\d+\.\d+)[,\s]+([-+]?\d+\.\d+)$/;
    const coordMatch = queryStr.match(coordRegex);

    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setPosition([lat, lng]);
        toast({ title: isRtl ? "تم اكتشاف إحداثيات مباشرة" : "Coordinates Detected" });
        return;
      }
    }

    // 2. البحث النصي المتقدم (منطقة، قطعة، شارع)
    setIsSearching(true);
    try {
      // تعزيز البحث بكلمة الكويت لضمان دقة النتائج المحلية
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr + ' Kuwait')}&limit=1`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setPosition([lat, lng]);
        toast({ title: isRtl ? "تم العثور على الموقع" : "Location Found" });
      } else {
        toast({ 
          variant: "destructive", 
          title: isRtl ? "لم يتم العثور على الموقع" : "Location Not Found",
          description: isRtl ? "حاول كتابة اسم المنطقة والقطعة بشكل أوضح." : "Try adding area and block details."
        });
      }
    } catch (e) {
      console.error("Search failed", e);
      toast({ variant: "destructive", title: isRtl ? "فشل محرك البحث" : "Search Engine Failure" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast({ variant: "destructive", title: "GPS Not Supported" });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
        toast({ title: isRtl ? "تم تحديد موقعك الحالي" : "Location Fixed" });
      },
      () => {
        setIsLocating(false);
        toast({ variant: "destructive", title: isRtl ? "تم رفض الوصول للموقع" : "GPS Access Denied" });
      }
    );
  };

  const handleConfirm = () => {
    // توليد رابط جوجل ماب سيادي دقيق للاستخدام في الملاحة
    const googleUrl = `https://www.google.com/maps?q=${position[0]},${position[1]}`;
    onSelect(googleUrl);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
        <div className="bg-primary/5 p-8 text-slate-900 text-start flex items-center justify-between border-b shrink-0 relative">
           <div className="flex items-center gap-4 relative z-10">
              <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg ring-4 ring-primary/5">
                 <LocateFixed className="h-7 w-7" />
              </div>
              <div>
                 <DialogTitle className="text-2xl font-black font-headline">{isRtl ? 'رادار المواقع الذكي' : 'Smart Location Radar'}</DialogTitle>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">{isRtl ? 'ابحث بالمنطقة والقطعة أو الصق الإحداثيات مباشرة' : 'Search by Area/Block or Paste Coordinates'}</p>
              </div>
           </div>
           <Button variant="ghost" onClick={onClose} className="rounded-full h-10 w-10 text-slate-400 relative z-10"><X className="h-6 w-6" /></Button>
        </div>

        <div className="p-8 space-y-6">
           <div className="flex gap-3">
              <div className="relative flex-1">
                 <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                 <Input 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSearch()}
                   placeholder={isRtl ? "مثال: الروضة قطعة 2، أو 29.3, 47.9" : "e.g. Rawda Block 2, or 29.3, 47.9"}
                   className="h-14 rounded-2xl border-2 ps-12 font-bold text-lg bg-slate-50/50 focus:bg-white transition-all shadow-inner"
                 />
                 {isSearching && <Loader2 className="absolute end-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-14 px-10 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:scale-105 transition-all">{isRtl ? 'بحث ذكي' : 'Smart Search'}</Button>
              <Button 
                variant="outline" 
                onClick={handleLocateMe} 
                disabled={isLocating}
                className="h-14 w-14 p-0 rounded-2xl border-2 text-blue-600 hover:bg-blue-50 bg-white shadow-sm shrink-0"
              >
                 {isLocating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Crosshair className="h-6 w-6" />}
              </Button>
           </div>

           <div className="h-[450px] w-full rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-2xl relative group bg-slate-100">
              {isOpen && <MapView position={position} setPosition={setPosition} />}
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none w-full px-10 flex justify-center">
                 <div className="bg-slate-900/90 text-white backdrop-blur-md border-0 px-6 py-3 rounded-2xl font-mono text-xs shadow-3xl pointer-events-auto flex items-center gap-4 border border-white/10">
                    <div className="flex items-center gap-2 border-e border-white/10 pe-4">
                       <MapPin className="h-3.5 w-3.5 text-primary" />
                       <span className="font-black">LAT: {position[0].toFixed(6)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <MapPin className="h-3.5 w-3.5 text-primary" />
                       <span className="font-black">LNG: {position[1].toFixed(6)}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-2xl border-2 font-black text-lg bg-white shadow-sm">
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button onClick={handleConfirm} className="flex-[2] h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700">
              <CheckCircle2 className="h-7 w-7" />
              {isRtl ? 'تثبيت الموقع واعتماده' : 'Pin & Confirm Location'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
