import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Sun, Moon, 
} from 'lucide-react';

import FilterPanel from './components/FilterPanel';
import ImpactMap from './components/ImpactMap';
import NodeIntelligence from './components/NodeIntelligence';
import SimulationEngine from './components/SimulationEngine';
import GradientBackground from './components/GradientBackground';
import AuroraBackground from './components/AuroraBackground';
import { loadSwapNodes, loadLocalMarket } from './utils/swapLoader';
import { NodeData, FilterState, MarketData } from './types';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const initialFilters: FilterState = {
    dateRange: { start: sevenDaysAgo, end: today },
    totalVolume: [0, 100],
    avgTradeSize: [0, 1000],
    netBuyRatio: [-1, 1],
    txCount: [0, 500],
    atomShare: [0, 1],
    oneShare: [0, 1],
    ibcShare: [0, 1],
    activeDays: [0, 30],
    recentActivity: 'ALL',
    aiiScore: [0, 100],
    timingType: 'ALL',
    correlation: [-1, 1],
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [tempFilters, setTempFilters] = useState<FilterState>(initialFilters);

  const applyFilters = () => {
    setFilters(tempFilters);
  };

  const resetFilters = () => {
    setTempFilters(initialFilters);
    setFilters(initialFilters);
  };

  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<'loading' | 'live' | 'mock'>('loading');
  
  // Market Data
  const [atomData, setAtomData] = useState<MarketData | null>(null);
  const [oneData, setOneData] = useState<MarketData | null>(null);

  // Simulation Slots State (Lifted from SimulationEngine)
  const [slots, setSlots] = useState<
    { id: string; node: NodeData | null; weight: number; color: string }[]
  >([
    { id: 'A', node: null, weight: 50, color: '#F87171' }, // Soft Red
    { id: 'B', node: null, weight: 30, color: '#60A5FA' }, // Soft Blue
    { id: 'C', node: null, weight: 20, color: '#A78BFA' }, // Soft Purple
  ]);

  // --- Fetch Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setApiStatus('loading');

      const valData = await loadSwapNodes(filters.dateRange);
      setNodes(valData);
      setApiStatus('mock');

      const localMarket = loadLocalMarket();
      setAtomData(localMarket.atom);
      setOneData(localMarket.one);

      setLoading(false);
    };
    loadData();
  }, [filters.dateRange]); // 기간 필터 변경 시 데이터 재로드

  return (
    <div className={`min-h-screen font-sans flex overflow-hidden relative text-sm bg-gray-200 dark:bg-black`}>
      <AuroraBackground />
      <GradientBackground />
      {/* LEFT SIDEBAR (FILTER) */}
      <aside
        className={`z-50 w-full lg:fixed lg:top-8 lg:bottom-8 lg:left-8 ${
          isSidebarCollapsed ? 'lg:w-24' : 'lg:w-[320px]'
        } transition-all duration-300 ease-out mb-4 lg:mb-0 px-4 lg:px-0`}
      >
         <FilterPanel 
            tempFilters={tempFilters} 
            setTempFilters={setTempFilters}
            applyFilters={applyFilters}
            resetFilters={resetFilters}
            initialFilters={initialFilters}
            theme={theme}
            setTheme={setTheme}
         />
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 h-screen overflow-hidden relative transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-[344px]'}`}>
        <div className="h-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10 flex flex-col gap-4 sm:gap-6 lg:gap-8">
          
          {/* TOP ROW: MAP & INTELLIGENCE */}
          <div className="grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8 flex-1 min-h-0 overflow-hidden">
             
             <div className="col-span-12 lg:col-span-8 h-full min-h-0 overflow-hidden">
                <ImpactMap 
                  nodes={nodes} 
                  selectedNode={selectedNode} 
                  filters={filters} 
                  onSelectNode={setSelectedNode} 
                  loading={loading}
                  apiStatus={apiStatus} 
                />
             </div>

             <div className="col-span-12 lg:col-span-4 h-full min-h-0 overflow-hidden">
                <NodeIntelligence 
                  selectedNode={selectedNode}
                  slots={slots}
                  setSlots={setSlots}
                />
             </div>
          </div>

          {/* BOTTOM ROW: SIMULATION ENGINE */}
          <div className="w-full h-[360px] sm:h-[400px] lg:h-[420px] flex-shrink-0">
             <SimulationEngine 
                atomData={atomData}
                oneData={oneData}
                slots={slots}
                setSlots={setSlots}
             />
          </div>

        </div>
      </main>
    </div>
  );
}