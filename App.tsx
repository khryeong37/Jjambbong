import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Sun, Moon, 
} from 'lucide-react';

import FilterPanel from './components/FilterPanel';
import ImpactMap from './components/ImpactMap';
import NodeIntelligence from './components/NodeIntelligence';
import SimulationEngine from './components/SimulationEngine';
import GradientBackground from './components/GradientBackground';
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
    <div className={`h-screen font-sans flex overflow-hidden relative text-sm bg-slate-100 dark:bg-slate-950`}>
      <GradientBackground />
      {/* LEFT SIDEBAR (FILTER) */}
      <aside className={`fixed inset-y-6 left-6 z-50 ${isSidebarCollapsed ? 'w-24' : 'w-[320px]'} transition-all duration-300 ease-out`}>
         <FilterPanel 
            tempFilters={tempFilters} 
            setTempFilters={setTempFilters}
            applyFilters={applyFilters}
            resetFilters={resetFilters}
            initialFilters={initialFilters}
         />
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 h-screen overflow-hidden relative transition-all duration-300 ${isSidebarCollapsed ? 'ml-28' : 'lg:ml-[344px]'}`}>
        <div className="h-full p-6 relative z-10 flex flex-col gap-6 overflow-hidden">
          
          {/* Theme Toggle */}
          <div className="absolute top-6 right-6 z-50">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-10 h-10 flex items-center justify-center bg-white/60 dark:bg-aether-dark-card/60 backdrop-blur-md rounded-full shadow-md border border-white/50 dark:border-white/10 text-gray-500 dark:text-aether-dark-subtext hover:text-indigo-500 dark:hover:text-white transition-all transform hover:scale-110 active:scale-95"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
          
          {/* TOP ROW: MAP & INTELLIGENCE - 버블차트 우선 */}
          <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden" style={{ padding: '16px', margin: '-16px' }}>
             
             {/* Impact Map - 최우선: 작은 화면에서도 충분한 공간 확보 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-8 lg:col-span-9 xl:col-span-8 h-full min-h-0 overflow-hidden" style={{ minHeight: '300px' }}>
                <ImpactMap 
                  nodes={nodes} 
                  selectedNode={selectedNode} 
                  filters={filters} 
                  onSelectNode={setSelectedNode} 
                  loading={loading}
                  apiStatus={apiStatus} 
                />
             </div>

             {/* Node Intelligence - 작은 화면에서는 세로로 배치되지만 Impact Map이 우선 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-3 xl:col-span-4 h-full min-h-0 overflow-hidden">
                <NodeIntelligence 
                  selectedNode={selectedNode}
                  slots={slots}
                  setSlots={setSlots}
                />
             </div>
          </div>

          {/* BOTTOM ROW: SIMULATION ENGINE - 작은 화면에서 높이 축소, 버블차트 우선 */}
          <div className="w-full flex-shrink-0 overflow-hidden" style={{ 
            height: 'clamp(380px, 35vh, 480px)',
            minHeight: '380px',
            maxHeight: '480px',
            padding: '12px', 
            margin: '-12px', 
            marginTop: '0'
          }}>
             <div className="h-full">
               <SimulationEngine 
                  atomData={atomData}
                  oneData={oneData}
                  slots={slots}
                  setSlots={setSlots}
               />
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}