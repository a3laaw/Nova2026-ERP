'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  name: string;
  subText?: string;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}

export function SearchableDropdown({ options, value, onChange, multiple = false, placeholder = 'اختر...' }: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // تفريغ حقل البحث كلما تم فتح القائمة
  useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  // إذا كان حقل البحث فارغاً، لا تعرض أي بيانات. اعرضها فقط عند الكتابة.
  const filteredOptions = search.trim() === '' ? [] : options.filter(opt => 
    opt.name.toLowerCase().includes(search.toLowerCase()) || 
    (opt.subText?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (id: string) => {
    if (multiple) {
      const currentValues = value as string[];
      if (currentValues.includes(id)) {
        onChange(currentValues.filter(v => v !== id));
      } else {
        onChange([...currentValues, id]);
      }
    } else {
      onChange(id);
      setOpen(false);
    }
    setSearch('');
  };

  const selectedOptions = options.filter(opt => 
    multiple ? (value as string[]).includes(opt.id) : value === opt.id
  );

  return (
    <div className="relative w-full" ref={ref}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="w-full h-12 rounded-xl border-2 font-bold bg-slate-50 hover:bg-slate-100 justify-between items-center px-4"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOptions.length > 0 ? (
            multiple ? (
              <div className="flex gap-1 flex-wrap">
                {selectedOptions.slice(0, 2).map(opt => (
                  <Badge key={opt.id} className="bg-primary/10 text-primary border-0">{opt.name}</Badge>
                ))}
                {selectedOptions.length > 2 && <Badge className="bg-primary/10 text-primary border-0">+{selectedOptions.length - 2}</Badge>}
              </div>
            ) : (
              <span className="truncate">{selectedOptions[0]?.name}</span>
            )
          ) : (
            <span className="text-slate-400 font-bold">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute z-[9999] mt-2 w-full bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-100 relative">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ابحث لعرض النتائج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-10 ps-10 rounded-xl border-2 font-bold focus:border-primary"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                {search.trim() === '' ? 'ابحث لعرض النتائج...' : 'لا توجد نتائج'}
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                    multiple ? (value as string[]).includes(opt.id) ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                             : value === opt.id ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex flex-col text-start">
                    <span className="font-bold text-sm">{opt.name}</span>
                    {opt.subText && <span className="text-[10px] text-slate-400">{opt.subText}</span>}
                  </div>
                  {multiple ? (value as string[]).includes(opt.id) && <Check className="h-4 w-4" /> 
                            : value === opt.id && <Check className="h-4 w-4" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}