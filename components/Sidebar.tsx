import React, { useState } from 'react';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { SidebarSectionProps, ImpactStatus, FilterState } from '../types';
import { RangeSlider } from './RangeSlider';
import { GlassCard } from './GlassCard';

// Default Filter State
const DEFAULT_FILTERS: FilterState = {
    timeRange: 'Last 30D',
    totalVolume: [0, 100],
    avgTradeSize: [0, 100],
    netBuyRatio: [-1.0, 1.0],
    txFrequency: [0, 100],
    atomShare: [0, 100],
    atomOneShare: [0, 100],
    ibcShare: [0, 100],
    activeDays: [0, 100],
    recentActivity: 'All Time',
    impactNetBuyRatio: [0, 100],
    timingProfile: ImpactStatus.All,
    correlation: [-1.0, 1.0]
};

const SidebarSection: React.FC<SidebarSectionProps> = ({ title, isOpen, onToggle, children }) => (
  <div className="mb-6 border-b border-white/5 pb-5 last:border-0 last:pb-0">
    <button 
      onClick={onToggle}
      className="flex items-center justify-between w-full mb-4 text-slate-200 font-bold text-sm hover:text-white transition-colors tracking-wide"
    >
      <span>{title}</span>
      {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
    </button>
    {isOpen && (
      <div className="pl-1 pr-1 space-y-5">
        {children}
      </div>
    )}
  </div>
);

interface SidebarProps {
    onApply: (filters: FilterState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onApply }) => {
  const [sections, setSections] = useState({
    timePeriod: true,
    scale: true,
    behavior: true,
    chainMobility: true,
    activity: true,
    impact: true
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters(prev => ({...prev, [key]: value}));
  };

  const handleReset = () => {
      setFilters(DEFAULT_FILTERS);
      onApply(DEFAULT_FILTERS);
  };

  return (
    <GlassCard className="h-full flex flex-col w-[420px] shrink-0 border-r border-white/5">
      <div className="flex justify-between items-center mb-6 pt-2">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Filter
        </h2>
        <button 
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 uppercase tracking-wider transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
        >
            <RotateCcw size={12}/> RESET
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar -mr-2 pb-4">
        {/* Time Period */}
        <SidebarSection 
            title="Time Period" 
            isOpen={sections.timePeriod} 
            onToggle={() => toggleSection('timePeriod')}
        >
             <div className="bg-slate-900/50 p-1.5 rounded-xl flex justify-between text-xs mb-2 border border-white/10">
                {(['Last 3D', 'Last 7D', 'Last 30D', 'All Time'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => updateFilter('timeRange', tab)}
                        className={`px-3 py-2 rounded-lg transition-all flex-1 font-medium ${
                            filters.timeRange === tab 
                            ? 'bg-indigo-600/80 text-white shadow-lg shadow-indigo-500/20' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            <div className="text-xs text-center text-indigo-300/80 mt-2 font-mono tracking-wide bg-indigo-500/10 py-1.5 rounded-lg border border-indigo-500/20">
                2025.10.31 ~ 2025.11.30
            </div>
        </SidebarSection>

        {/* Scale */}
        <SidebarSection 
            title="Scale" 
            isOpen={sections.scale} 
            onToggle={() => toggleSection('scale')}
        >
            <div className="px-4">
                <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                    <span>Total Volume</span>
                    <span className="text-slate-200 font-bold">{filters.totalVolume[0]}% - {filters.totalVolume[1]}%</span>
                </div>
                <RangeSlider min={0} max={100} values={filters.totalVolume} onChange={(v) => updateFilter('totalVolume', v)} />
            </div>
            <div className="px-4">
                <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                    <span>Avg. Trade Size</span>
                    <span className="text-slate-200 font-bold">{filters.avgTradeSize[0]}% - {filters.avgTradeSize[1]}%</span>
                </div>
                <RangeSlider min={0} max={100} values={filters.avgTradeSize} onChange={(v) => updateFilter('avgTradeSize', v)} />
            </div>
        </SidebarSection>

        {/* Behavior */}
        <SidebarSection 
            title="Behavior" 
            isOpen={sections.behavior} 
            onToggle={() => toggleSection('behavior')}
        >
                <div className="px-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>Net Buy Ratio</span>
                        <span className="text-slate-200 font-bold">{filters.netBuyRatio[0].toFixed(1)} ~ {filters.netBuyRatio[1].toFixed(1)}</span>
                    </div>
                    <RangeSlider min={-1} max={1} step={0.1} values={filters.netBuyRatio} onChange={(v) => updateFilter('netBuyRatio', v)} />
                </div>
                <div className="px-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>TX Frequency</span>
                        <span className="text-slate-200 font-bold">{filters.txFrequency[0]}% - {filters.txFrequency[1]}%</span>
                    </div>
                    <RangeSlider min={0} max={100} values={filters.txFrequency} onChange={(v) => updateFilter('txFrequency', v)} />
                </div>
        </SidebarSection>

        {/* Chain Mobility */}
        <SidebarSection 
            title="Chain Mobility" 
            isOpen={sections.chainMobility} 
            onToggle={() => toggleSection('chainMobility')}
        >
                <div className="px-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>Atom Share</span>
                        <span className="text-slate-200 font-bold">{filters.atomShare[0]}% - {filters.atomShare[1]}%</span>
                    </div>
                    <RangeSlider min={0} max={100} values={filters.atomShare} onChange={(v) => updateFilter('atomShare', v)} />
                </div>
                <div className="px-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>Atom One Share</span>
                         <span className="text-slate-200 font-bold">{filters.atomOneShare[0]}% - {filters.atomOneShare[1]}%</span>
                    </div>
                    <RangeSlider min={0} max={100} values={filters.atomOneShare} onChange={(v) => updateFilter('atomOneShare', v)} />
                </div>
                <div className="px-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>IBC Share</span>
                         <span className="text-slate-200 font-bold">{filters.ibcShare[0]}% - {filters.ibcShare[1]}%</span>
                    </div>
                    <RangeSlider min={0} max={100} values={filters.ibcShare} onChange={(v) => updateFilter('ibcShare', v)} />
                </div>
        </SidebarSection>

        {/* Activity */}
        <SidebarSection 
            title="Activity" 
            isOpen={sections.activity} 
            onToggle={() => toggleSection('activity')}
        >
             <div className="px-4">
                <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                    <span>Active Days</span>
                     <span className="text-slate-200 font-bold">{filters.activeDays[0]}% - {filters.activeDays[1]}%</span>
                </div>
                <RangeSlider min={0} max={100} values={filters.activeDays} onChange={(v) => updateFilter('activeDays', v)} />
            </div>
             <div className="mt-5 px-1">
                 <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold px-1">Recent Activity</p>
                 <div className="bg-slate-900/50 p-1.5 rounded-xl flex justify-between text-[11px] border border-white/10 overflow-x-auto no-scrollbar">
                    {(['Last 3D', 'Last 7D', 'Last 30D', 'All Time'] as const).map(tab => (
                        <button 
                            key={`activity-${tab}`}
                            onClick={() => updateFilter('recentActivity', tab)}
                            className={`px-3 py-2 rounded-lg min-w-[70px] whitespace-nowrap transition-colors flex-1 font-medium ${
                                filters.recentActivity === tab 
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
             </div>
        </SidebarSection>

        {/* Impact */}
        <SidebarSection 
            title="Impact" 
            isOpen={sections.impact} 
            onToggle={() => toggleSection('impact')}
        >
                 <div className="px-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>AII Score</span>
                        <span className="text-slate-200 font-bold">{filters.impactNetBuyRatio[0]} - {filters.impactNetBuyRatio[1]}</span>
                    </div>
                    <RangeSlider min={0} max={100} values={filters.impactNetBuyRatio} onChange={(v) => updateFilter('impactNetBuyRatio', v)} />
                </div>
                
                <div className="px-1 mt-5">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold px-1">Timing Profile</p>
                    <div className="bg-slate-900/50 p-1.5 rounded-xl flex justify-between text-[11px] border border-white/10 mb-3">
                        {Object.values(ImpactStatus).map(status => (
                            <button
                                key={status}
                                onClick={() => updateFilter('timingProfile', status)}
                                className={`px-3 py-2 rounded-lg flex-1 transition-all font-medium ${
                                    filters.timingProfile === status
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-4 mt-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-3 font-medium tracking-wide">
                        <span>Correlation</span>
                        <span className="text-slate-200 font-bold">{filters.correlation[0].toFixed(1)} ~ {filters.correlation[1].toFixed(1)}</span>
                    </div>
                    <RangeSlider min={-1} max={1} step={0.1} values={filters.correlation} onChange={(v) => updateFilter('correlation', v)} />
                </div>
        </SidebarSection>
      </div>

      <div className="mt-4 pt-5 border-t border-white/10 relative">
        <button 
            onClick={() => onApply(filters)}
            className="atc"
        >
            <span className="atc__border"></span>
            <span className="atc__content">
                Apply Filters
            </span>
        </button>
      </div>
    </GlassCard>
  );
};