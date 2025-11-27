import React, { useState } from 'react';
import { FilterState } from '../types';
import { ChevronDown, ChevronUp, Zap, Calendar, RefreshCcw, SlidersHorizontal, BarChart2, Share2, Activity, Target, DollarSign } from 'lucide-react';
import GelSlider from './GelSlider';

interface FilterPanelProps {
  tempFilters: FilterState;
  setTempFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  applyFilters: () => void;
}

const FilterSection: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; isOpen?: boolean }> = ({ title, icon: Icon, children, isOpen = false }) => {
  const [open, setOpen] = useState(isOpen);

  return (
    <div className="border-b border-gray-50 dark:border-white/5 last:border-0">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-2 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all duration-300 group rounded-xl"
      >
        <div className="flex items-center gap-3">
          <Icon size={14} className="text-gray-400 dark:text-aether-dark-subtext group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
          <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-aether-dark-subtext uppercase group-hover:text-gray-800 dark:group-hover:text-aether-dark-text transition-colors">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500" /> : <ChevronDown size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500" />}
      </button>
      {open && <div className="pb-6 px-2 space-y-8 animate-in slide-in-from-top-2 duration-300 ease-out">{children}</div>}
    </div>
  );
};

const FilterPanel: React.FC<FilterPanelProps> = ({ tempFilters, setTempFilters, applyFilters }) => {
  
  const resetFilters = () => {
    // Implement reset logic if needed
  };

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

  return (
    <div className="h-full flex flex-col bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-2xl rounded-[32px] shadow-float dark:shadow-float-dark border border-white/60 dark:border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-50 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
            <Zap size={16} className="text-white fill-current" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-aether-dark-text leading-none text-sm">AETHER</h1>
            <p className="text-[9px] font-bold text-gray-400 dark:text-aether-dark-subtext tracking-[0.2em] mt-1">ANALYTICS</p>
          </div>
        </div>
        <button onClick={resetFilters} className="text-[9px] font-bold text-gray-400 dark:text-aether-dark-subtext hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
          <RefreshCcw size={10} /> RESET
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-2">
        
        {/* 0. TIME PERIOD */}
        <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-4 mb-4 border border-gray-100/50 dark:border-white/5">
           <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400 mb-3">
             <div className="p-1.5 bg-white dark:bg-aether-dark-card rounded-lg shadow-sm"><Calendar size={12} /></div>
             <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-aether-dark-subtext">Time Period</span>
           </div>
           <div className="flex gap-2 text-[10px] text-gray-500 dark:text-aether-dark-subtext font-medium bg-white dark:bg-aether-dark-bg border border-gray-100 dark:border-white/10 p-3 rounded-xl items-center justify-between shadow-sm mb-3">
             <input type="date" value={tempFilters.dateRange.start} onChange={e => setTempFilters(p => ({...p, dateRange: {...p.dateRange, start: e.target.value}}))} className="bg-transparent focus:outline-none w-full text-center date-input"/>
             <span className="text-gray-300 dark:text-gray-700">→</span>
             <input type="date" value={tempFilters.dateRange.end} onChange={e => setTempFilters(p => ({...p, dateRange: {...p.dateRange, end: e.target.value}}))} className="bg-transparent focus:outline-none w-full text-center date-input"/>
           </div>
           <div className="grid grid-cols-4 gap-1.5">
            {[7, 30, 90, 180].map((d) => (
              <button key={d} onClick={() => setDatePreset(d)} className={`py-2 rounded-xl text-[9px] font-bold transition-all duration-300 bg-white dark:bg-aether-dark-bg text-gray-400 dark:text-aether-dark-subtext hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-aether-dark-text border border-gray-100 dark:border-white/10`}>
                {d}D
              </button>
            ))}
          </div>
        </div>

        {/* 1. SCALE */}
        <FilterSection title="Scale" icon={DollarSign} isOpen={true}>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1"><span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">Total Volume</span><span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{tempFilters.totalVolume}K</span></div>
            <GelSlider min={0} max={100} value={tempFilters.totalVolume} onChange={(v) => setTempFilters(p => ({...p, totalVolume: v as number}))} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1"><span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">Avg Trade Size</span><span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">${tempFilters.avgTradeSize}</span></div>
            <GelSlider min={0} max={1000} value={tempFilters.avgTradeSize} onChange={(v) => setTempFilters(p => ({...p, avgTradeSize: v as number}))} />
          </div>
        </FilterSection>

        {/* 2. BEHAVIOR */}
        <FilterSection title="Behavior" icon={BarChart2}>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">Net Buy Ratio</span><span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{tempFilters.netBuyRatio[0].toFixed(1)} ~ {tempFilters.netBuyRatio[1].toFixed(1)}</span></div>
              <GelSlider isDual min={-1} max={1} value={tempFilters.netBuyRatio} onChange={(v) => setTempFilters(p => ({...p, netBuyRatio: v as [number, number]}))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1"><span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">Tx Frequency</span><span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{tempFilters.txCount}</span></div>
              <GelSlider min={0} max={500} value={tempFilters.txCount} onChange={(v) => setTempFilters(p => ({...p, txCount: v as number}))} />
            </div>
        </FilterSection>
        
        {/* 3. CHAIN MOBILITY */}
        <FilterSection title="Chain Mobility" icon={Share2}>
            <div className="space-y-2"><div className="px-1 text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">ATOM Share</div><GelSlider min={0} max={1} value={tempFilters.atomShare} onChange={(v) => setTempFilters(p => ({...p, atomShare: v as number}))} /></div>
            <div className="space-y-2"><div className="px-1 text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">ONE Share</div><GelSlider min={0} max={1} value={tempFilters.oneShare} onChange={(v) => setTempFilters(p => ({...p, oneShare: v as number}))} /></div>
            <div className="space-y-2"><div className="px-1 text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">IBC Share</div><GelSlider min={0} max={1} value={tempFilters.ibcShare} onChange={(v) => setTempFilters(p => ({...p, ibcShare: v as number}))} /></div>
        </FilterSection>

        {/* 4. ACTIVITY */}
        <FilterSection title="Activity" icon={Activity}>
           <div className="space-y-2"><div className="px-1 text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">Active Days</div><GelSlider min={0} max={30} value={tempFilters.activeDays} onChange={(v) => setTempFilters(p => ({...p, activeDays: v as number}))} /></div>
           <div className="pt-2">
             <span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase block mb-2 px-1">Recent Activity</span>
             <div className="flex gap-1 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/10">
               {(['3D', '7D', '30D', 'ALL'] as const).map(opt => (
                 <button key={opt} onClick={() => setTempFilters(p => ({...p, recentActivity: opt}))} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all duration-200 ${tempFilters.recentActivity === opt ? 'bg-white dark:bg-aether-dark-bg shadow-sm text-indigo-600 dark:text-indigo-400 ring-1 ring-gray-100 dark:ring-white/10' : 'text-gray-400 dark:text-aether-dark-subtext hover:text-gray-600 dark:hover:text-aether-dark-text'}`}>
                   {opt === 'ALL' ? 'All Time' : `Last ${opt}`}
                 </button>
               ))}
             </div>
           </div>
        </FilterSection>

        {/* 5. IMPACT */}
        <FilterSection title="Impact" icon={Target}>
            <div className="space-y-2"><div className="px-1 text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">AII Score</div><GelSlider min={0} max={100} value={tempFilters.aiiScore} onChange={(v) => setTempFilters(p => ({...p, aiiScore: v as number}))} /></div>
            <div className="pt-2">
               <span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase block mb-2 px-1">Timing Profile</span>
               <div className="grid grid-cols-4 gap-1 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/10">
                  {(['LEADING', 'SYNC', 'LAGGING', 'ALL'] as const).map(opt => (
                     <button key={opt} onClick={() => setTempFilters(p => ({...p, timingType: opt}))} className={`py-1.5 text-[9px] font-bold rounded-lg transition-all duration-200 ${tempFilters.timingType === opt ? 'bg-white dark:bg-aether-dark-bg shadow-sm text-indigo-600 dark:text-indigo-400 ring-1 ring-gray-100 dark:ring-white/10' : 'text-gray-400 dark:text-aether-dark-subtext hover:text-gray-600 dark:hover:text-aether-dark-text'}`}>
                        {opt}
                     </button>
                  ))}
               </div>
            </div>
            <div className="space-y-2 pt-6">
              <div className="flex justify-between items-center px-1"><span className="text-[10px] font-semibold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wide">Correlation</span><span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{tempFilters.correlation[0].toFixed(1)} ~ {tempFilters.correlation[1].toFixed(1)}</span></div>
              <GelSlider isDual min={-1} max={1} value={tempFilters.correlation} onChange={(v) => setTempFilters(p => ({...p, correlation: v as [number, number]}))} />
            </div>
        </FilterSection>

      </div>

      {/* Apply Button */}
      <div className="p-6 border-t border-gray-50 dark:border-white/5 bg-white/80 dark:bg-aether-dark-card/80">
        <button onClick={applyFilters} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl shadow-glow-blue flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 text-[11px] font-black uppercase tracking-widest">
           Confirm Selection
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;