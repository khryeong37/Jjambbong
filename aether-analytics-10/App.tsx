import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Sun, Moon, 
} from 'lucide-react';

import FilterPanel from './components/FilterPanel';
import ImpactMap from './components/ImpactMap';
import NodeIntelligence from './components/NodeIntelligence';
import SimulationEngine from './components/SimulationEngine';
import GradientBackground from './components/GradientBackground';
import { fetchValidators, fetchMarketData } from './utils/api';
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const initialFilters: FilterState = {
    dateRange: { start: thirtyDaysAgo, end: today },
    totalVolume: 0,
    avgTradeSize: 0,
    netBuyRatio: [-1, 1],
    txCount: 0,
    atomShare: 0,
    oneShare: 0,
    ibcShare: 0,
    activeDays: 0,
    recentActivity: 'ALL',
    aiiScore: 0,
    timingType: 'ALL',
    correlation: [-1, 1],
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [tempFilters, setTempFilters] = useState<FilterState>(initialFilters);

  const applyFilters = () => {
    setFilters(tempFilters);
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
      
      const { data: valData, source } = await fetchValidators();
      setNodes(valData);
      setApiStatus(source === 'api' ? 'live' : 'mock');

      const market = await fetchMarketData();
      if (market) {
        setAtomData(market);
        
        // Mock ATOMONE data based on ATOM for demo purposes
        const onePrices = market.history.map(h => h.price * 0.3 * (1 + Math.random()*0.1));
        const oneHistory = market.history.map((h, i) => ({ date: h.date, price: onePrices[i] }));
        setOneData({
            ...market,
            price: market.price * 0.3,
            history: oneHistory
        });
      }
      
      setLoading(false);
    };
    loadData();
  }, [filters.dateRange]); // Refetch on confirmed date range change

  return (
    <div className={`h-screen font-sans flex overflow-hidden relative text-sm bg-aether-bg dark:bg-aether-dark-bg`}>
      <GradientBackground />
      {/* LEFT SIDEBAR (FILTER) */}
      <aside className={`fixed inset-y-6 left-6 z-50 ${isSidebarCollapsed ? 'w-24' : 'w-[320px]'} transition-all duration-300 ease-out`}>
         <FilterPanel 
            tempFilters={tempFilters} 
            setTempFilters={setTempFilters}
            applyFilters={applyFilters}
         />
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 h-screen overflow-y-auto relative transition-all duration-300 ${isSidebarCollapsed ? 'ml-28' : 'lg:ml-[344px]'}`}>
        <div className="p-6 space-y-6 relative z-10 flex flex-col min-h-full">
          
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
          
          {/* TOP ROW: MAP & INTELLIGENCE */}
          <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
             
             <div className="col-span-12 lg:col-span-8 h-full">
                <ImpactMap 
                  nodes={nodes} 
                  selectedNode={selectedNode} 
                  filters={filters} 
                  onSelectNode={setSelectedNode} 
                  loading={loading}
                  apiStatus={apiStatus} 
                />
             </div>

             <div className="col-span-12 lg:col-span-4 h-full">
                <NodeIntelligence 
                  selectedNode={selectedNode}
                  slots={slots}
                  setSlots={setSlots}
                />
             </div>
          </div>

          {/* BOTTOM ROW: SIMULATION ENGINE */}
          <div className="w-full h-[480px] flex-shrink-0">
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