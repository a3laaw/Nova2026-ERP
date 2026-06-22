'use client';

import { useState, useEffect } from 'react';
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
  CheckCircle2
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import dynamic from 'next/dynamic';

// استيراد مكون الخريطة بشكل ديناميكي لتجنب مشاكل التصيير في جهة الخادم (SSR)
const MapView = dynamic(() => import('./map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full rounded-[2rem] bg-slate-50 flex items-center justify-center border-4 border-slate-100">
      <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
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

  // تحليل الرابط الأولي لاستخراج الإحداثيات إن وجدت
  useEffect(() => {
    if (initialUrl && isOpen) {
      const match = initialUrl.match(/q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/) || initialUrl.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
      if (match) {
        setPosition([parseFloat(match[1]), parseFloat(match[2])]);
      }
    }
  }, [initialUrl, isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ' Kuwait')}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      }
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => setIsLocating(false)
    );
  };

  const handleConfirm = () => {
    const googleUrl = `https://www.google.com/maps?q=${position[0]},${position[1]}`;
    onSelect(googleUrl);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl" dir={dir}>
        <div className="bg-slate-900 p-6 text-white text-start flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                 <MapIcon className="h-6 w-6" />
              </div>
              <div>
                 <DialogTitle className="text-xl font-black font-headline">{isRtl ? 'رادار تحديد المواقع' : 'Live Location Radar'}</DialogTitle>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isRtl ? 'قم بالبحث أو النقر على الخريطة لتثبيت الموقع' : 'Search or click on map to pin location'}</p>
              </div>
           </div>
        </div>

        <div className="p-6 space-y-4">
           {/* شريط البحث والتحكم */}
           <div className="flex gap-2">
              <div className="relative flex-1">
                 <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                 <Input 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSearch()}
                   placeholder={isRtl ? "ابحث عن منطقة، شارع، أو اسم معلم..." : "Search for area, street..."}
                   className="h-12 rounded-xl border-2 ps-11 font-bold"
                 />
                 {isSearching && <Loader2 className="absolute end-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-12 px-6 rounded-xl bg-slate-900 text-white font-bold">{isRtl ? 'بحث' : 'Search'}</Button>
              <Button 
                variant="outline" 
                onClick={handleLocateMe} 
                disabled={isLocating}
                className="h-12 w-12 p-0 rounded-xl border-2 text-blue-600 hover:bg-blue-50"
              >
                 {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
              </Button>
           </div>

           {/* منطقة الخريطة (MapView المستورد ديناميكياً) */}
           <div className="h-[400px] w-full rounded-[2rem] overflow-hidden border-4 border-slate-100 shadow-inner relative">
              {isOpen && <MapView position={position} setPosition={setPosition} />}
              <div className="absolute bottom-4 left-4 right-4 z-[1000] pointer-events-none flex justify-center">
                 <Badge className="bg-slate-900/90 text-white backdrop-blur-md border-0 px-4 py-2 rounded-full font-mono text-[10px] shadow-2xl pointer-events-auto">
                    GPS: {position[0].toFixed(6)}, {position[1].toFixed(6)}
                 </Badge>
              </div>
           </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-4">
           <Button variant="outline" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 font-black">
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button onClick={handleConfirm} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2">
              <CheckCircle2 className="h-6 w-6" />
              {isRtl ? 'اعتماد الموقع المختار' : 'Confirm Location'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
