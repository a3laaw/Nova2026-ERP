'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  disabled?: boolean;
}

/**
 * مكون البحث الذكي الموحد لنظام NovaFlow.
 * يحل مشاكل Focus Trap داخل الـ Dialog ويغلق آلياً بعد الاختيار.
 */
export function SearchableDropdown({ options, value, onChange, multiple = false, placeholder = 'اختر...', disabled = false }: SearchableDropdownProps) {
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

  // تفريغ حقل البحث عند الفتح
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const filteredOptions = search.trim() === '' 
    ? options.slice(0, 20) 
    : options.filter(opt => 
        opt.name.toLowerCase().includes(search.toLowerCase()) || 
        (opt.subText?.toLowerCase().includes(search.toLowerCase()))
      );

  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(id)) {
        onChange(currentValues.filter(v => v !== id));
      } else {
        onChange([...currentValues, id]);
      }
    } else {
      onChange(id);
      setOpen(false); // إغلاق فوري بعد الاختيار
    }
  };

  const selectedOptions = options.filter(opt => 
    multiple ? (Array.isArray(value) && value.includes(opt.id)) : value === opt.id
  );

  return (
    <div className="relative w-full" ref={ref}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        className="w-full h-12 rounded-xl border-2 font-bold bg-white justify-between items-center px-4"
      >
        <div className="flex items-center gap-2 truncate text-start">
          {selectedOptions.length > 0 ? (
            multiple ? (
              <div className="flex gap-1 flex-wrap">
                {selectedOptions.slice(0, 2).map(opt => (
                  <Badge key={opt.id} className="bg-primary/10 text-primary border-0">{opt.name}</Badge>
                ))}
              </div>
            ) : (
              <span className="truncate text-slate-900">{selectedOptions[0]?.name}</span>
            )
          ) : (
            <span className="text-slate-400 font-bold">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div 
          className="absolute z-[999] mt-2 w-full bg-white border-2 border-slate-100 rounded-2xl shadow-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onPointerDown={(e) => e.stopPropagation()} 
        >
          <div className="p-3 bg-slate-50 border-b border-slate-100 relative">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ابحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-10 ps-10 rounded-xl border-2 font-bold focus:border-primary"
            />
          </div>
          <ScrollArea className="max-h-60 overflow-y-auto p-2">
            <div className="space-y-1">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">لا توجد نتائج</div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = multiple 
                    ? (Array.isArray(value) && value.includes(opt.id))
                    : value === opt.id;

                  return (
                    <div
                      key={opt.id}
                      onClick={(e) => handleSelect(opt.id, e)}
                      className={cn(
                        "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                        isSelected ? "bg-primary/5 text-primary border-primary/10" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex flex-col text-start">
                        <span className="font-bold text-sm">{opt.name}</span>
                        {opt.subText && <span className="text-[10px] text-slate-400">{opt.subText}</span>}
                      </div>
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
