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
    totalVolume: [0, 10000], // 실제 데이터 범위에 맞게 증가
    avgTradeSize: [0, 10000], // 실제 데이터 범위에 맞게 증가
    netBuyRatio: [-1, 1],
    txCount: [0, 5000], // 실제 데이터 범위에 맞게 증가
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
    { id: 'A', node: null, weight: 50, color: '#f87171' }, // Soft Red
    { id: 'B', node: null, weight: 30, color: '#60a5fa' }, // Soft Blue
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
    <div className={`h-screen font-sans flex overflow-hidden relative text-sm bg-gray-300 dark:bg-[#080A10]`}>
      <GradientBackground />
      {/* LEFT SIDEBAR (FILTER) */}
      <aside className={`fixed top-3 bottom-3 left-3 z-50 ${isSidebarCollapsed ? 'w-24' : 'w-[340px]'} transition-all duration-300 ease-out`} style={{ padding: '8px', margin: '-8px' }}>
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
      <main className={`flex-1 h-screen overflow-hidden relative transition-all duration-300 ${isSidebarCollapsed ? 'ml-28' : 'lg:ml-[336px]'}`}>
        <div className="h-full relative z-10 flex flex-col gap-3 overflow-hidden" style={{ 
          paddingLeft: '0px', 
          paddingRight: '12px', 
          paddingTop: '12px', 
          paddingBottom: '12px' // 필터 패널의 bottom-3 (12px)와 맞춤
        }}>
          
          {/* TOP ROW: MAP & INTELLIGENCE - 겹침 방지 반응형 구조 */}
          <div className="grid grid-cols-12 gap-3 min-h-0" style={{ 
            paddingLeft: '12px',
            // BOTTOM ROW의 최소 높이(350px) + gap(12px) + 패딩(24px)을 고려하여 최대 높이 제한
            flex: '1 1 0%',
            minHeight: '300px',
            maxHeight: 'calc(100% - 386px)', // BOTTOM ROW minHeight(350px) + gap(12px) + padding(24px)
            height: 'auto',
            overflow: 'hidden'
          }}>
             
             {/* Impact Map - 반응형 최소 높이 조정 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-8 lg:col-span-9 xl:col-span-8 h-full min-h-0" style={{ 
               minHeight: '300px',
               height: '100%',
               maxHeight: '100%'
             }}>
                <ImpactMap 
                  nodes={nodes} 
                  selectedNode={selectedNode} 
                  filters={filters} 
                  onSelectNode={setSelectedNode} 
                  loading={loading}
                  apiStatus={apiStatus} 
                />
             </div>

             {/* Node Intelligence - 반응형 최소 높이 조정 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-3 xl:col-span-4 h-full min-h-0" style={{
               minHeight: '300px',
               height: '100%',
               maxHeight: '100%'
             }}>
                <NodeIntelligence 
                  selectedNode={selectedNode}
                  slots={slots}
                  setSlots={setSlots}
                />
             </div>
          </div>

          {/* BOTTOM ROW: SIMULATION ENGINE - 필터 패널 하단과 정렬 */}
          <div className="grid grid-cols-12 gap-3" style={{ 
            paddingLeft: '12px',
            // 필터 패널의 bottom-3 (12px)와 맞추기 위해 하단 마진 없이 정렬
            flex: '0 1 auto',
            minHeight: 'clamp(350px, calc(100vh * 0.35), 400px)',
            maxHeight: '500px',
            height: 'clamp(350px, calc(100vh * 0.38), 500px)',
            overflow: 'hidden',
            // 필터 패널 하단과 정렬: 메인 컨텐츠 하단 패딩(12px)과 일치
            marginBottom: '0'
          }}>
             <div className="col-span-12 sm:col-span-12 md:col-span-12 lg:col-span-12 xl:col-span-12 h-full">
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