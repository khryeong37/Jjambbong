import React, { useState, useRef } from 'react';
import { FilterState } from '../types';
import { ChevronDown, ChevronUp, Zap, Calendar, RefreshCcw, SlidersHorizontal, BarChart2, Share2, Activity, Target, DollarSign, Sun, Moon, HelpCircle, X } from 'lucide-react';
import GelSlider from './GelSlider';

interface FilterPanelProps {
  tempFilters: FilterState;
  setTempFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  applyFilters: () => void;
  resetFilters: () => void;
  initialFilters: FilterState;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const FilterSection: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; isOpen?: boolean; description?: string }> = ({ title, icon: Icon, children, isOpen = false, description }) => {
  const [open, setOpen] = useState(isOpen);
  const [showDescription, setShowDescription] = useState(false);

  const getSectionStyle = () => {
    if (!open) return {
      border: 'none',
      borderRadius: '0',
      background: 'transparent',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: 'none',
      overflow: 'hidden'
    };
    
    // Light mode
    const lightStyle = {
      border: '1px solid rgba(255, 255, 255, 0.4)',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.4), 0 4px 16px rgba(196, 181, 253, 0.15)',
      overflow: 'hidden'
    };
    
    // Dark mode - will be overridden by CSS
    return lightStyle;
  };

  return (
    <div 
      className={`transition-all duration-300 ease-out ${open ? 'mb-3 filter-section-open' : 'mb-0'}`} 
      style={getSectionStyle()}
    >
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-4 glass-button group transition-all duration-300" style={{
          background: 'transparent'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <Icon size={14} className="text-gray-400 dark:text-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
          <span className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-200 uppercase group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">{title}</span>
          {description && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDescription(!showDescription);
              }}
              className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
              aria-label="Show description"
            >
              <HelpCircle size={12} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-300 dark:text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-200" /> : <ChevronDown size={14} className="text-gray-300 dark:text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-200" />}
      </button>
      {showDescription && description && (
        <div className="px-4 py-3 mx-4 mb-3 rounded-xl relative" style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.2) 100%)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.4), 0 4px 16px rgba(196, 181, 253, 0.15)'
        }}>
          <button
            onClick={() => setShowDescription(false)}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
            aria-label="Close description"
          >
            <X size={12} className="text-gray-500 dark:text-gray-400" />
          </button>
          <p className="text-[11px] text-gray-700 dark:text-gray-300 pr-6">{description}</p>
        </div>
      )}
      {open && (
        <div className="px-4 pb-6 space-y-5 animate-in slide-in-from-top-2 duration-300 ease-out" style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          marginTop: '0',
          paddingTop: '16px'
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

const FilterPanel: React.FC<FilterPanelProps> = ({ tempFilters, setTempFilters, applyFilters, resetFilters, initialFilters, theme, setTheme }) => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const setDatePreset = (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      setTempFilters(prev => ({
          ...prev,
          dateRange: {
              start: start.toISOString().split('T')[0],
              end: end.toISOString().split('T')[0]
          }
      }));
  };

  const handleDateClick = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current && 'showPicker' in ref.current) {
      (ref.current as HTMLInputElement).showPicker();
    }
  };

  return (
    <div className="h-full flex flex-col glass-card-light dark:glass-card-dark rounded-[32px] overflow-hidden relative">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between relative backdrop-blur-sm" style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-8 h-8 flex items-center justify-center glass-button rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.2) 100%)',
              backdropFilter: 'blur(12px) saturate(180%)',
              WebkitBackdropFilter: 'blur(12px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6), 0 4px 16px rgba(196, 181, 253, 0.2)'
            }}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 leading-none text-sm">FILTER</h1>
        </div>
        <button onClick={resetFilters} className="text-[9px] font-bold text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 px-2 py-1 rounded-full glass-button transition-all" style={{
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}>
          <RefreshCcw size={10} /> RESET
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-3">
        
        {/* 0. TIME PERIOD */}
        <div className="rounded-2xl p-5 mb-5 relative" style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.15) 100%)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.5), 0 4px 16px rgba(196, 181, 253, 0.15)'
        }}>
           <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-3">
             <div className="p-1.5 bg-white dark:bg-aether-dark-card rounded-lg shadow-sm"><Calendar size={12} /></div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">Time Period</span>
           </div>
           <div className="flex gap-2 text-[11px] text-gray-700 dark:text-gray-200 font-medium glass-input p-3 rounded-xl items-center justify-between mb-3 overflow-hidden">
             <input 
               ref={startDateRef}
               type="date" 
               value={tempFilters.dateRange.start} 
               onChange={e => setTempFilters(p => ({...p, dateRange: {...p.dateRange, start: e.target.value}}))} 
               onClick={() => handleDateClick(startDateRef)}
               className="bg-transparent focus:outline-none flex-1 text-center date-input date-input-no-icon text-gray-700 dark:text-gray-200 [color-scheme:light] dark:[color-scheme:dark] cursor-pointer" 
               style={{ color: 'rgb(55, 65, 81)' }} 
             />
             <span className="text-gray-300 dark:text-gray-300 flex-shrink-0">→</span>
             <input 
               ref={endDateRef}
               type="date" 
               value={tempFilters.dateRange.end} 
               onChange={e => setTempFilters(p => ({...p, dateRange: {...p.dateRange, end: e.target.value}}))} 
               onClick={() => handleDateClick(endDateRef)}
               className="bg-transparent focus:outline-none flex-1 text-center date-input date-input-no-icon text-gray-700 dark:text-gray-200 [color-scheme:light] dark:[color-scheme:dark] cursor-pointer" 
               style={{ color: 'rgb(55, 65, 81)' }} 
             />
           </div>
           <div className="grid grid-cols-2 gap-1.5">
            {[7, 30].map((d) => (
              <button key={d} onClick={() => setDatePreset(d)} className="py-2 rounded-xl text-[10px] font-bold glass-button text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100" style={{
                background: 'rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.4)'
              }}>
                {d}D
              </button>
            ))}
          </div>
        </div>

        {/* 1. SCALE */}
        <FilterSection title="Scale" icon={DollarSign} isOpen={true} description="거래 규모 및 거래량 지표를 기준으로 노드를 필터링합니다. Total Tx Quantity는 기간 내 매수·매도 합계(토큰 수량)이며, Average Tx Size는 총 거래 수량을 거래 횟수로 나눈 평균 거래 크기입니다.">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Total Tx Quantity</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.totalVolume[0].toLocaleString()} ~ {tempFilters.totalVolume[1].toLocaleString()}</span></div>
            <GelSlider isDual min={0} max={100} value={tempFilters.totalVolume} onChange={(v) => setTempFilters(p => ({...p, totalVolume: v as [number, number]}))} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Average Tx Size</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.avgTradeSize[0].toLocaleString()} ~ {tempFilters.avgTradeSize[1].toLocaleString()}</span></div>
            <GelSlider isDual min={0} max={1000} value={tempFilters.avgTradeSize} onChange={(v) => setTempFilters(p => ({...p, avgTradeSize: v as [number, number]}))} />
          </div>
        </FilterSection>

        {/* 2. BEHAVIOR */}
        <FilterSection title="Behavior" icon={BarChart2} description="거래 패턴 및 거래 빈도를 기준으로 노드를 필터링합니다. Net Buy Ratio는 -1(순매도)부터 +1(순매수)까지의 범위로, 0을 기준으로 매수/매도 비율을 나타냅니다. Tx Count는 기간 내 거래 횟수 범위를 설정합니다.">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Net Buy Ratio</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.netBuyRatio[0].toFixed(1)} ~ {tempFilters.netBuyRatio[1].toFixed(1)}</span></div>
              <GelSlider isDual min={-1} max={1} value={tempFilters.netBuyRatio} onChange={(v) => setTempFilters(p => ({...p, netBuyRatio: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Tx Count</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.txCount[0]} ~ {tempFilters.txCount[1]}</span></div>
              <GelSlider isDual min={0} max={500} value={tempFilters.txCount} onChange={(v) => setTempFilters(p => ({...p, txCount: v as [number, number]}))} />
            </div>
        </FilterSection>
        
        {/* 3. CHAIN MOBILITY */}
        <FilterSection title="Chain · IBC" icon={Share2} description="체인별 거래량 분포 및 IBC 활동을 기준으로 노드를 필터링합니다. ATOM Volume Share와 ATOMONE Volume Share는 각 체인에서의 거래량 비율을 나타내며, IBC Ratio는 IBC(Inter-Blockchain Communication) 거래의 비율을 나타냅니다.">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">ATOM Volume Share</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.atomShare[0].toFixed(2)} ~ {tempFilters.atomShare[1].toFixed(2)}</span></div>
              <GelSlider isDual min={0} max={1} value={tempFilters.atomShare} onChange={(v) => setTempFilters(p => ({...p, atomShare: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">ATOMONE Volume Share</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.oneShare[0].toFixed(2)} ~ {tempFilters.oneShare[1].toFixed(2)}</span></div>
              <GelSlider isDual min={0} max={1} value={tempFilters.oneShare} onChange={(v) => setTempFilters(p => ({...p, oneShare: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">IBC Ratio</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.ibcShare[0].toFixed(2)} ~ {tempFilters.ibcShare[1].toFixed(2)}</span></div>
              <GelSlider isDual min={0} max={1} value={tempFilters.ibcShare} onChange={(v) => setTempFilters(p => ({...p, ibcShare: v as [number, number]}))} />
            </div>
        </FilterSection>

        {/* 4. ACTIVITY */}
        <FilterSection title="Activity" icon={Activity} description="활동 빈도 및 최근 거래 행동을 기준으로 노드를 필터링합니다. Active Days는 기간 내 거래가 발생한 일수를 나타내며, Recent Activity는 최근 3일, 7일, 30일 또는 전체 기간 중 거래 활동이 있었는지 필터링합니다.">
           <div className="space-y-2">
             <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Active Days</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.activeDays[0]} ~ {tempFilters.activeDays[1]}</span></div>
             <GelSlider isDual min={0} max={30} value={tempFilters.activeDays} onChange={(v) => setTempFilters(p => ({...p, activeDays: v as [number, number]}))} />
           </div>
           <div className="pt-4">
             <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase block mb-2 px-1">Recent Activity</span>
             <div className="flex gap-1 glass-input p-1 rounded-xl">
               {(['3D', '7D', '30D', 'ALL'] as const).map(opt => (
                 <button key={opt} onClick={() => setTempFilters(p => ({...p, recentActivity: opt}))} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg glass-button transition-all duration-200 ${tempFilters.recentActivity === opt ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100'}`} style={tempFilters.recentActivity === opt ? {
                   background: 'rgba(255, 255, 255, 0.5)',
                   backdropFilter: 'blur(12px)',
                   WebkitBackdropFilter: 'blur(12px)',
                   boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6), 0 2px 8px rgba(196, 181, 253, 0.2)'
                 } : {
                   background: 'transparent'
                 }}>
                   {opt}
                 </button>
               ))}
             </div>
           </div>
        </FilterSection>

        {/* 5. IMPACT */}
        <FilterSection title="Impact" icon={Target} description="영향력 점수, 타이밍 프로필, 시장 상관관계를 기준으로 노드를 필터링합니다. AII Score는 노드의 영향력 점수를 나타내며, Timing Profile은 LEADING(선행), SYNC(동기), LAGGING(후행) 거래 패턴을 구분합니다. Correlation은 시장과의 상관관계를 -1부터 +1까지의 범위로 나타냅니다.">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">AII Score</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.aiiScore[0]} ~ {tempFilters.aiiScore[1]}</span></div>
              <GelSlider isDual min={0} max={100} value={tempFilters.aiiScore} onChange={(v) => setTempFilters(p => ({...p, aiiScore: v as [number, number]}))} />
            </div>
            <div className="pt-4">
               <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase block mb-2 px-1">Timing Profile</span>
               <div className="grid grid-cols-4 gap-1 glass-input p-1 rounded-xl">
                  {(['LEADING', 'SYNC', 'LAGGING', 'ALL'] as const).map(opt => (
                     <button key={opt} onClick={() => setTempFilters(p => ({...p, timingType: opt}))} className={`py-1.5 text-[10px] font-bold rounded-lg glass-button transition-all duration-200 ${tempFilters.timingType === opt ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100'}`} style={tempFilters.timingType === opt ? {
                       background: 'rgba(255, 255, 255, 0.5)',
                       backdropFilter: 'blur(12px)',
                       WebkitBackdropFilter: 'blur(12px)',
                       boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6), 0 2px 8px rgba(196, 181, 253, 0.2)'
                     } : {
                       background: 'transparent'
                     }}>
                        {opt}
                     </button>
                  ))}
               </div>
            </div>
            <div className="space-y-2 pt-6">
              <div className="flex justify-between items-center px-1"><span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Correlation</span><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{tempFilters.correlation[0].toFixed(1)} ~ {tempFilters.correlation[1].toFixed(1)}</span></div>
              <GelSlider isDual min={-1} max={1} value={tempFilters.correlation} onChange={(v) => setTempFilters(p => ({...p, correlation: v as [number, number]}))} />
            </div>
        </FilterSection>

      </div>

      {/* Apply Button */}
      <div className="px-6 py-5 border-t border-white/20 dark:border-white/10 relative" style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div className="flex items-center justify-end text-[11px] text-gray-700 dark:text-gray-200 mb-4">
          <button onClick={resetFilters} className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold hover:underline text-[11px]">
            <RefreshCcw size={10} /> Reset
          </button>
        </div>
        <button onClick={applyFilters} className="w-full py-4 glass-button rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest relative overflow-hidden text-gray-800 dark:text-gray-200" style={{
          background: 'transparent',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '2px solid #7c3aed',
          boxShadow: 'none'
        }}>
           Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;