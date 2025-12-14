import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FilterState } from '../types';
import { ChevronDown, ChevronUp, Zap, Calendar, RefreshCcw, SlidersHorizontal, BarChart2, Share2, Activity, Target, DollarSign, HelpCircle, X } from 'lucide-react';
import GelSlider from './GelSlider';

const DATE_PRESETS = [
  { label: 'ALL', days: null },
  { label: '7D', days: 7 },
  { label: '15D', days: 15 },
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
];

interface FilterPanelProps {
  tempFilters: FilterState;
  appliedFilters: FilterState;
  setTempFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  applyFilters: () => void;
  resetFilters: () => void;
  initialFilters: FilterState;
  dateBounds: { start: string; end: string };
}

const FilterSection: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isOpen?: boolean;
  description?: string;
  summary?: string;
  onHelp?: (info: { title: string; description: string; anchor: DOMRect }) => void;
}> = ({ title, icon: Icon, children, isOpen = false, description, summary, onHelp }) => {
  const [open, setOpen] = useState(isOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  // Measure content height only when opening/closing
  useEffect(() => {
    if (open && contentRef.current) {
      // Use requestAnimationFrame to ensure layout is stable
      requestAnimationFrame(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      });
    } else if (!open) {
      setContentHeight(0);
    }
  }, [open]);

  // Update height when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (contentRef.current && open) {
        setContentHeight(contentRef.current.scrollHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  const getSectionStyle = () => {
    return {
      border: 'none',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden'
    };
  };

  return (
    <div 
      className={`transition-all duration-300 ease-out ${open ? 'mb-2' : 'mb-0'}`} 
      style={{
        ...getSectionStyle(),
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0, // flex shrink 방지
        flexShrink: 0,
        position: 'relative',
        zIndex: 1
      }}
    >
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-4 glass-button group transition-all duration-300" style={{
          background: 'transparent'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <Icon size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors duration-200" />
          <span className="text-xs font-bold tracking-wider text-gray-800 uppercase group-hover:text-gray-900 transition-colors duration-200">{title}</span>
          {description && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onHelp?.({ title, description, anchor: rect });
              }}
              className="p-1 rounded-full hover:bg-white/20 transition-colors duration-200"
              aria-label="Show description"
            >
              <HelpCircle size={12} className="text-gray-400 hover:text-gray-600 transition-colors duration-200" />
            </button>
          )}
        </div>
        <div className="transition-transform duration-400 ease-out" style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transformOrigin: 'center'
        }}>
          <ChevronDown size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors duration-200" />
        </div>
      </button>
      {!open && summary && (
        <div className="px-4 pt-0 pb-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          {summary}
        </div>
      )}
      <div 
        ref={contentRef}
        style={{
          maxHeight: open ? (contentHeight > 0 ? `${contentHeight}px` : '9999px') : '0px',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: contentHeight > 0
            ? 'max-height 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          borderTop: open ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
          paddingTop: open ? '16px' : '0px',
          paddingBottom: open ? '32px' : '0px',
          paddingLeft: '16px',
          paddingRight: '16px'
        }}
      >
        <div className="space-y-5" style={{
          transform: open ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          paddingTop: '16px',
          paddingBottom: '20px',
          paddingLeft: '8px',
          paddingRight: '8px'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const FilterSummary: React.FC<{ applied: FilterState }> = ({ applied }) => {
  const { dateRange, totalVolume, txCount, netBuyRatio, atomShare, timingType } = applied;
  const chips = [
    {
      label: '기간',
      value: `${dateRange.start.slice(5)} ~ ${dateRange.end.slice(5)}`,
    },
    {
      label: '규모',
      value: `${totalVolume[0].toLocaleString()}~${totalVolume[1].toLocaleString()}`,
    },
    {
      label: '거래횟수',
      value: `${txCount[0]}~${txCount[1]}`,
    },
    {
      label: 'Net Flow',
      value: `${netBuyRatio[0].toFixed(2)}~${netBuyRatio[1].toFixed(2)}`,
    },
    {
      label: 'Chain Bias',
      value: `${Math.round(atomShare[0] * 100)}~${Math.round(atomShare[1] * 100)}% ATOM`,
    },
    {
      label: 'Timing',
      value: timingType === 'ALL' ? 'ALL' : timingType,
    },
  ];

  return (
    <div className="w-full flex flex-wrap justify-center gap-2 text-center">
      {chips.map((chip) => (
        <div
          key={`${chip.label}-${chip.value}`}
          className="px-3 py-1 rounded-full text-[10px] font-semibold text-gray-700 bg-white/70 shadow-sm"
        >
          <span className="text-gray-500 mr-1">{chip.label}</span>
          <span>{chip.value}</span>
        </div>
      ))}
    </div>
  );
};

const FilterPanel: React.FC<FilterPanelProps> = ({
  tempFilters,
  appliedFilters,
  setTempFilters,
  applyFilters,
  resetFilters,
  initialFilters,
  dateBounds,
}) => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const [helpBubble, setHelpBubble] = useState<{ title: string; description: string; anchor: DOMRect } | null>(null);

  const clampDate = (date: Date) => {
    const min = new Date(dateBounds.start);
    const max = new Date(dateBounds.end);
    if (date < min) return min;
    if (date > max) return max;
    return date;
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const parseOrBound = (value: string, fallback: string) => {
    const parsed = value ? new Date(value) : new Date(fallback);
    return clampDate(parsed);
  };
  const clampDateString = (value: string, fallback: string) =>
    formatDate(parseOrBound(value, fallback));

  const computePresetRange = (days: number | null) => {
    if (days === null) {
      return {
        start: dateBounds.start,
        end: dateBounds.end,
      };
    }
    const endRaw = new Date(dateBounds.end);
    const startRaw = new Date(endRaw);
    startRaw.setDate(startRaw.getDate() - (days - 1));
    const clampedStart = clampDate(startRaw);
    const clampedEnd = clampDate(endRaw);
    return {
      start: formatDate(clampedStart),
      end: formatDate(clampedEnd),
    };
  };

  const setDatePreset = (days: number | null) => {
    const nextRange = computePresetRange(days);
    setTempFilters((prev) => ({
      ...prev,
      dateRange: nextRange,
    }));
  };

  const handleDateClick = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current && 'showPicker' in ref.current) {
      (ref.current as HTMLInputElement).showPicker();
    }
  };

  const activePreset = useMemo(() => {
    return DATE_PRESETS.find((preset) => {
      const range = computePresetRange(preset.days);
      return (
        range.start === tempFilters.dateRange.start &&
        range.end === tempFilters.dateRange.end
      );
    });
  }, [tempFilters.dateRange, dateBounds]);

  const hasPendingChanges = useMemo(() => {
    return JSON.stringify(tempFilters) !== JSON.stringify(appliedFilters);
  }, [tempFilters, appliedFilters]);

  const summaryTime = useMemo(() => {
    const start = tempFilters.dateRange.start.slice(5);
    const end = tempFilters.dateRange.end.slice(5);
    const label = activePreset?.label ? ` (${activePreset.label})` : '';
    return `${start} → ${end}${label}`;
  }, [tempFilters.dateRange, activePreset]);

  const summaryScale = useMemo(() => {
    const vol = `${tempFilters.totalVolume[0].toLocaleString()}~${tempFilters.totalVolume[1].toLocaleString()}`;
    const avg = `${tempFilters.avgTradeSize[0].toLocaleString()}~${tempFilters.avgTradeSize[1].toLocaleString()}`;
    return `VOL ${vol} / AVG ${avg}`;
  }, [tempFilters.totalVolume, tempFilters.avgTradeSize]);

  const summaryBehavior = useMemo(() => {
    const net = `${tempFilters.netBuyRatio[0].toFixed(2)}~${tempFilters.netBuyRatio[1].toFixed(2)}`;
    const tx = `${tempFilters.txCount[0]}~${tempFilters.txCount[1]}`;
    return `NET ${net} / TX ${tx}`;
  }, [tempFilters.netBuyRatio, tempFilters.txCount]);

  const summaryChain = useMemo(() => {
    const atom = `${Math.round(tempFilters.atomShare[0] * 100)}~${Math.round(tempFilters.atomShare[1] * 100)}%`;
    const atone = `${Math.round(tempFilters.oneShare[0] * 100)}~${Math.round(tempFilters.oneShare[1] * 100)}%`;
    const ibc = `${Math.round(tempFilters.ibcShare[0] * 100)}~${Math.round(tempFilters.ibcShare[1] * 100)}%`;
    return `ATOM ${atom} / ATONE ${atone} / IBC ${ibc}`;
  }, [tempFilters.atomShare, tempFilters.oneShare, tempFilters.ibcShare]);

  const summaryActivity = useMemo(() => {
    const days = `${tempFilters.activeDays[0]}~${tempFilters.activeDays[1]}d`;
    return `${days} / ${tempFilters.recentActivity}`;
  }, [tempFilters.activeDays, tempFilters.recentActivity]);

  const summaryImpact = useMemo(() => {
    const aii = `${tempFilters.aiiScore[0]}~${tempFilters.aiiScore[1]}`;
    const corr = `${tempFilters.correlation[0].toFixed(1)}~${tempFilters.correlation[1].toFixed(1)}`;
    return `AII ${aii} / ${tempFilters.timingType} / Corr ${corr}`;
  }, [tempFilters.aiiScore, tempFilters.timingType, tempFilters.correlation]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelpBubble(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const helpPosition = useMemo(() => {
    if (!helpBubble) return null;
    if (typeof window === 'undefined') return null;
    const width = 280;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    let left = helpBubble.anchor.right + scrollX + 16;
    if (left + width > window.innerWidth - 16) {
      left = helpBubble.anchor.left + scrollX - width - 16;
    }
    let top = helpBubble.anchor.top + scrollY - 8;
    if (top < 16) top = 16;
    return { top, left, width };
  }, [helpBubble]);

  return (
    <div className="h-full flex flex-col glass-card-light rounded-[32px] relative overflow-hidden" style={{ 
      boxShadow: 'none', 
      border: '1px solid rgba(255, 255, 255, 0.1)', 
      isolation: 'isolate',
      width: '100%',
      minWidth: '340px',
      maxWidth: '340px',
      boxSizing: 'border-box'
    }}>
      
      {/* Header */}
      <div className="px-6 pt-4 pb-2 border-b border-white/20 flex flex-col gap-2 relative backdrop-blur-sm" style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'none'
      }}>
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-gray-900 leading-none text-sm">FILTER</h1>
          </div>
          <button onClick={resetFilters} className="text-[9px] font-bold text-gray-700 hover:text-red-600 flex items-center gap-1.5 px-2 py-1 rounded-full glass-button transition-all" style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
          }}>
            <RefreshCcw size={10} /> Reset
          </button>
        </div>
        <FilterSummary applied={appliedFilters} />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar" style={{
        width: '100%',
        boxSizing: 'border-box'
      }}>
        
        {/* 0. TIME PERIOD */}
        <FilterSection
          title="Time Range"
          icon={Calendar}
          description="조회 기간을 지정하면 그 구간 안에서만 모든 지표가 다시 계산됩니다."
          summary={summaryTime}
          isOpen
          onHelp={(info) =>
            setHelpBubble((prev) =>
              prev && prev.title === info.title ? null : info
            )
          }
        >
           <div className="flex gap-2 text-[11px] text-gray-700 font-medium glass-input p-3 rounded-xl items-center justify-between mb-3 overflow-hidden">
             <input 
               ref={startDateRef}
               type="date" 
               value={tempFilters.dateRange.start} 
               onChange={e => {
                 const clampedStart = clampDateString(e.target.value, dateBounds.start);
                 setTempFilters(p => {
                   const currentEnd = clampDateString(p.dateRange.end, dateBounds.end);
                   const adjustedEnd =
                     new Date(currentEnd) < new Date(clampedStart) ? clampedStart : currentEnd;
                   return {
                     ...p,
                     dateRange: {
                       start: clampedStart,
                       end: adjustedEnd,
                     },
                   };
                 });
               }} 
               onClick={() => handleDateClick(startDateRef)}
               className="bg-transparent focus:outline-none flex-1 text-center date-input date-input-no-icon text-gray-700 [color-scheme:light] cursor-pointer" 
               style={{ color: 'rgb(55, 65, 81)' }}
               min={dateBounds.start}
               max={dateBounds.end}
             />
             <span className="text-gray-300 flex-shrink-0">→</span>
             <input 
               ref={endDateRef}
               type="date" 
               value={tempFilters.dateRange.end} 
               onChange={e => {
                 const clampedEnd = clampDateString(e.target.value, dateBounds.end);
                 setTempFilters(p => {
                   const start = p.dateRange.start;
                   const nextEnd = new Date(clampedEnd) < new Date(start) ? start : clampedEnd;
                   return { ...p, dateRange: { ...p.dateRange, end: nextEnd } };
                 });
               }} 
               onClick={() => handleDateClick(endDateRef)}
               className="bg-transparent focus:outline-none flex-1 text-center date-input date-input-no-icon text-gray-700 [color-scheme:light] cursor-pointer" 
               style={{ color: 'rgb(55, 65, 81)' }}
               min={tempFilters.dateRange.start || dateBounds.start}
               max={dateBounds.end}
             />
           </div>
           <div className="grid grid-cols-5 gap-1.5">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setDatePreset(preset.days)}
                className={`py-2 rounded-xl text-[10px] font-bold glass-button transition-all duration-200 ${
                  activePreset?.label === preset.label ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900'
                }`}
                style={
                  activePreset?.label === preset.label
                    ? {
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '2px solid #10b981',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                      }
                    : {
                        background: 'rgba(255, 255, 255, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                      }
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* 1. SCALE */}
        <FilterSection
          title="Scale"
          icon={DollarSign}
          isOpen={false}
          description="거래 규모 및 거래량 지표를 기준으로 노드를 필터링합니다. Total Tx Quantity는 기간 내 매수·매도 합계(토큰 수량)이며, Average Tx Size는 총 거래 수량을 거래 횟수로 나눈 평균 거래 크기입니다."
          summary={summaryScale}
          onHelp={(info) =>
            setHelpBubble((prev) =>
              prev && prev.title === info.title ? null : info
            )
          }
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Tx Quantity</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.totalVolume[0].toLocaleString()} ~ {tempFilters.totalVolume[1].toLocaleString()}</span></div>
            <div style={{ paddingTop: '8px', paddingBottom: '8px', marginTop: '-4px', marginBottom: '-4px' }}>
              <GelSlider isDual min={0} max={2000000} value={tempFilters.totalVolume} onChange={(v) => setTempFilters(p => ({...p, totalVolume: v as [number, number]}))} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Average Tx Size</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.avgTradeSize[0].toLocaleString()} ~ {tempFilters.avgTradeSize[1].toLocaleString()}</span></div>
            <GelSlider isDual min={0} max={200000} value={tempFilters.avgTradeSize} onChange={(v) => setTempFilters(p => ({...p, avgTradeSize: v as [number, number]}))} />
          </div>
        </FilterSection>

        {/* 2. BEHAVIOR */}
        <FilterSection
          title="Behavior"
          icon={BarChart2}
          description="거래 패턴 및 거래 빈도를 기준으로 노드를 필터링합니다. Net Buy Ratio는 -1(순매도)부터 +1(순매수)까지 범위를 가지며, Tx Count는 기간 내 거래 횟수 범위를 나타냅니다."
          summary={summaryBehavior}
          onHelp={(info) =>
            setHelpBubble((prev) =>
              prev && prev.title === info.title ? null : info
            )
          }
        >
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Net Buy Ratio</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.netBuyRatio[0].toFixed(1)} ~ {tempFilters.netBuyRatio[1].toFixed(1)}</span></div>
              <GelSlider isDual min={-1} max={1} value={tempFilters.netBuyRatio} onChange={(v) => setTempFilters(p => ({...p, netBuyRatio: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tx Count</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.txCount[0]} ~ {tempFilters.txCount[1]}</span></div>
              <GelSlider isDual min={0} max={500} value={tempFilters.txCount} onChange={(v) => setTempFilters(p => ({...p, txCount: v as [number, number]}))} />
            </div>
        </FilterSection>
        
        {/* 3. CHAIN MOBILITY */}
        <FilterSection
          title="Chain · Mobility"
          icon={Share2}
          description="체인별 거래량 분포와 IBC 비중으로 계정의 활동 타입을 필터링합니다."
          summary={summaryChain}
          onHelp={(info) =>
            setHelpBubble((prev) =>
              prev && prev.title === info.title ? null : info
            )
          }
        >
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">ATOM Volume Share</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.atomShare[0].toFixed(2)} ~ {tempFilters.atomShare[1].toFixed(2)}</span></div>
              <GelSlider isDual min={0} max={1} value={tempFilters.atomShare} onChange={(v) => setTempFilters(p => ({...p, atomShare: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">ATOMONE Volume Share</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.oneShare[0].toFixed(2)} ~ {tempFilters.oneShare[1].toFixed(2)}</span></div>
              <GelSlider isDual min={0} max={1} value={tempFilters.oneShare} onChange={(v) => setTempFilters(p => ({...p, oneShare: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">IBC Ratio</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.ibcShare[0].toFixed(2)} ~ {tempFilters.ibcShare[1].toFixed(2)}</span></div>
              <GelSlider isDual min={0} max={1} value={tempFilters.ibcShare} onChange={(v) => setTempFilters(p => ({...p, ibcShare: v as [number, number]}))} />
            </div>
        </FilterSection>

        {/* 4. ACTIVITY */}
        <FilterSection
          title="Activity"
          icon={Activity}
          description="활동 일수와 최근 거래 여부로 현재도 움직이는 계정을 추립니다."
          summary={summaryActivity}
          onHelp={(info) =>
            setHelpBubble((prev) =>
              prev && prev.title === info.title ? null : info
            )
          }
        >
           <div className="space-y-2">
             <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Active Days</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.activeDays[0]} ~ {tempFilters.activeDays[1]}</span></div>
             <GelSlider isDual min={0} max={60} value={tempFilters.activeDays} onChange={(v) => setTempFilters(p => ({...p, activeDays: v as [number, number]}))} />
           </div>
           <div className="pt-4">
             <span className="text-[11px] font-semibold text-gray-500 uppercase block mb-2 px-1">Recent Activity</span>
             <div className="flex gap-1 glass-input p-1 rounded-xl">
               {(['3D', '7D', '30D', 'ALL'] as const).map(opt => (
                 <button key={opt} onClick={() => setTempFilters(p => ({...p, recentActivity: opt}))} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg glass-button transition-all duration-200 ${tempFilters.recentActivity === opt ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900'}`} style={tempFilters.recentActivity === opt ? {
                   background: 'rgba(255, 255, 255, 0.5)',
                   backdropFilter: 'blur(12px)',
                   WebkitBackdropFilter: 'blur(12px)',
                   border: '2px solid #10b981',
                   boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6), 0 2px 8px rgba(110, 231, 183, 0.2)'
                 } : {
                   background: 'transparent',
                   border: '2px solid transparent'
                 }}>
                   {opt}
                 </button>
               ))}
             </div>
           </div>
        </FilterSection>

        {/* 5. IMPACT */}
        <FilterSection
          title="Impact"
          icon={Target}
          description="영향력 점수, 타이밍, 상관도를 기반으로 전략 후보를 압축합니다."
          summary={summaryImpact}
          onHelp={(info) =>
            setHelpBubble((prev) =>
              prev && prev.title === info.title ? null : info
            )
          }
        >
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">AII Score</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.aiiScore[0]} ~ {tempFilters.aiiScore[1]}</span></div>
              <GelSlider isDual min={0} max={100} value={tempFilters.aiiScore} onChange={(v) => setTempFilters(p => ({...p, aiiScore: v as [number, number]}))} />
            </div>
            <div className="pt-4">
               <span className="text-[11px] font-semibold text-gray-500 uppercase block mb-2 px-1">Timing Profile</span>
               <div className="grid grid-cols-4 gap-1 glass-input p-1 rounded-xl">
                  {(['LEADING', 'SYNC', 'LAGGING', 'ALL'] as const).map(opt => (
                     <button key={opt} onClick={() => setTempFilters(p => ({...p, timingType: opt}))} className={`py-1.5 text-[10px] font-bold rounded-lg glass-button transition-all duration-200 ${tempFilters.timingType === opt ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900'}`} style={tempFilters.timingType === opt ? {
                       background: 'rgba(255, 255, 255, 0.5)',
                       backdropFilter: 'blur(12px)',
                       WebkitBackdropFilter: 'blur(12px)',
                       border: '2px solid #10b981',
                       boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6), 0 2px 8px rgba(110, 231, 183, 0.2)'
                     } : {
                       background: 'transparent',
                       border: '2px solid transparent'
                     }}>
                        {opt}
                     </button>
                  ))}
               </div>
            </div>
            <div className="space-y-2 pt-6">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Correlation</span><span className="text-[11px] font-bold text-gray-700">{tempFilters.correlation[0].toFixed(1)} ~ {tempFilters.correlation[1].toFixed(1)}</span></div>
              <GelSlider isDual min={-1} max={1} value={tempFilters.correlation} onChange={(v) => setTempFilters(p => ({...p, correlation: v as [number, number]}))} />
            </div>
        </FilterSection>

      </div>

      {helpBubble && helpPosition &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setHelpBubble(null)}
              style={{ cursor: 'pointer' }}
            ></div>
            <div
              className="fixed z-50 rounded-2xl p-4 text-[11px] text-gray-700 shadow-2xl border border-white/40 bg-white/95"
              style={{
                top: helpPosition.top,
                left: helpPosition.left,
                width: helpPosition.width,
              }}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {helpBubble.title} Info
                </span>
                <button
                  onClick={() => setHelpBubble(null)}
                  className="p-1 rounded-full hover:bg-white/40 transition-colors"
                  aria-label="Close description"
                >
                  <X size={12} className="text-gray-500" />
                </button>
              </div>
              <p className="text-[11px] text-gray-700 leading-relaxed">{helpBubble.description}</p>
            </div>
          </>,
          document.body
        )}

      {/* Apply Button */}
      <div className="px-6 py-5 border-t border-white/20 relative" style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'none'
      }}>
        {hasPendingChanges && (
          <div className="absolute top-2 right-6 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            변경됨
          </div>
        )}
        <button
          onClick={applyFilters}
          disabled={!hasPendingChanges}
          className={`w-full py-4 glass-button rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest relative overflow-hidden ${
            hasPendingChanges ? 'text-gray-800' : 'text-gray-500 cursor-not-allowed opacity-60'
          }`}
          style={{
            background: 'transparent',
            backdropFilter: 'blur(24px) saturate(160%) brightness(1.02)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%) brightness(1.02)',
            border: '2px solid #10b981',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 24px -8px rgba(16, 185, 129, 0.3)',
          }}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
