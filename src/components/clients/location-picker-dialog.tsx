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
import { 
  Search, 
  Loader2, 
  Crosshair,
  X,
  MapPin,
  LocateFixed
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import dynamic from 'next/dynamic';
import { toast } from '@/hooks/use-toast';

const MapView = dynamic(() => import('./map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full rounded-2xl bg-slate-50 flex items-center justify-center border-4 border-slate-100">
      <div className="flex flex-col items-center gap-3">
         <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Initializing Map...</p>
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
  const { lang, dir, t } = useLanguage();
  
  const [position, setPosition] = useState<[number, number]>([29.3759, 47.9774]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

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

  const handleSearch = async () => {
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    const coordRegex = /^([-+]?\d+\.\d+)[,\s]+([-+]?\d+\.\d+)$/;
    const coordMatch = queryStr.match(coordRegex);

    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setPosition([lat, lng]);
        return;
      }
    }

    setIsSearching(true);
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr + ' Kuwait')}&limit=1`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setPosition([lat, lng]);
      } else {
        toast({ variant: "destructive", title: t('common.error') });
      }
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
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
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white flex flex-col max-h-[90vh]" dir={dir}>
        <DialogHeader className="bg-slate-50/80 p-6 text-slate-900 border-b flex flex-row items-center justify-between shrink-0">
           <div className="flex items-center gap-4 text-start">
              <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-sm">
                 <LocateFixed className="h-6 w-6" />
              </div>
              <div className="text-start">
                 <DialogTitle className="text-xl font-black font-headline">{t('clients.form.locationRadar')}</DialogTitle>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('clients.form.openMap')}</p>
              </div>
           </div>
           <Button variant="ghost" onClick={onClose} className="rounded-full h-8 w-8 text-slate-400"><X className="h-5 w-5" /></Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
           <div className="flex gap-2">
              <div className="relative flex-1">
                 <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSearch()}
                   placeholder={t('common.search')}
                   className="h-10 rounded-xl border-2 ps-10 font-bold bg-slate-50 focus:bg-white transition-all shadow-inner"
                 />
                 {isSearching && <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-10 px-6 rounded-xl font-bold">بحث</Button>
              <Button 
                variant="outline" 
                onClick={handleLocateMe} 
                disabled={isLocating}
                className="h-10 w-10 p-0 rounded-xl border-2 text-blue-600 shrink-0"
              >
                 {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
              </Button>
           </div>

           <div className="h-[400px] w-full rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner relative group bg-slate-100">
              {isOpen && <MapView position={position} setPosition={setPosition} />}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex justify-center">
                 <div className="bg-slate-900/90 text-white backdrop-blur-md px-4 py-2 rounded-xl font-mono text-[9px] shadow-2xl flex items-center gap-4 border border-white/10" dir="ltr">
                    <span className="flex items-center gap-1.5 border-e border-white/10 pe-3"><MapPin className="h-3 w-3 text-primary" /> {position[0].toFixed(6)}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> {position[1].toFixed(6)}</span>
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
           <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl border-2 font-bold bg-white">{t('common.cancel')}</Button>
           <Button onClick={handleConfirm} className="flex-[2] h-12 rounded-xl font-black shadow-xl shadow-primary/20 border-b-4 border-orange-700">
              <CheckCircle2 className="h-5 w-5 me-2" />
              {t('common.confirm')}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
