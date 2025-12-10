import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import FilterPanel from './components/FilterPanel';
import ImpactMap from './components/ImpactMap';
import NodeIntelligence from './components/NodeIntelligence';
import SimulationEngine from './components/SimulationEngine';
import GradientBackground from './components/GradientBackground';
import { loadSwapNodes, loadLocalMarket } from './utils/swapLoader';
import { NodeData, FilterState, MarketData } from './types';

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // CSV 데이터 범위
  const csvStartDate = '2025-10-01';
  const csvEndDate = '2025-12-05';

  const clampToDataset = (target: Date) => {
    const min = new Date(csvStartDate);
    const max = new Date(csvEndDate);
    if (target < min) return min;
    if (target > max) return max;
    return target;
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const getRecentRange = (days: number) => {
    const rawEnd = new Date(csvEndDate);
    const rawStart = new Date(rawEnd);
    rawStart.setDate(rawStart.getDate() - (days - 1));
    const start = clampToDataset(rawStart);
    const end = clampToDataset(rawEnd);
    return { start: formatDate(start), end: formatDate(end) };
  };

  // 초기 날짜 범위: 최근 7일
  const recentRange = getRecentRange(7);
  const initialStartDate = recentRange.start;
  const initialEndDate = recentRange.end;

  const initialFilters: FilterState = {
    dateRange: { start: initialStartDate, end: initialEndDate },
    totalVolume: [0, 1000000], // CSV 분석 결과 최대값 526,593.38을 고려하여 확대
    avgTradeSize: [0, 100000], // CSV 분석 결과 최대값 52,775.71을 고려하여 확대
    netBuyRatio: [-1, 1],
    txCount: [0, 100], // CSV 분석 결과 최대값 52를 고려하여 확대
    atomShare: [0, 1],
    oneShare: [0, 1],
    ibcShare: [0, 1],
    activeDays: [0, 60], // CSV 분석 결과 최대값 52를 고려하여 확대
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
    <div className={`h-screen font-sans flex overflow-hidden relative text-sm`}>
      <GradientBackground />
      {/* LEFT SIDEBAR (FILTER) */}
      <aside className={`fixed top-3 bottom-3 left-3 z-50 ${isSidebarCollapsed ? 'w-24' : 'w-[340px]'} transition-all duration-300 ease-out`} style={{ 
        padding: '8px', 
        margin: '-8px',
        width: isSidebarCollapsed ? '96px' : '340px',
        minWidth: isSidebarCollapsed ? '96px' : '340px',
        maxWidth: isSidebarCollapsed ? '96px' : '340px',
        boxSizing: 'border-box'
      }}>
         <FilterPanel 
            tempFilters={tempFilters} 
            setTempFilters={setTempFilters}
            applyFilters={applyFilters}
            resetFilters={resetFilters}
            initialFilters={initialFilters}
            dateBounds={{ start: csvStartDate, end: csvEndDate }}
         />
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 h-screen overflow-hidden relative transition-all duration-300 ${isSidebarCollapsed ? 'ml-28' : 'lg:ml-[364px]'}`}>
        <div className="h-full relative z-10 flex flex-col gap-3 overflow-hidden" style={{ 
          paddingLeft: '0px', 
          paddingRight: '12px', 
          paddingTop: '12px', 
          paddingBottom: '12px' // 필터 패널의 bottom-3 (12px)와 정확히 맞춤
        }}>
          
          {/* TOP ROW: MAP & INTELLIGENCE - 임팩트 맵 크기 유지, 백테스트만 축소 */}
          <div className="grid grid-cols-12 gap-3 min-h-0" style={{ 
            paddingLeft: '12px',
            // 임팩트 맵 크기 유지를 위해 flex: 1로 설정하고, 백테스트 패널이 줄어들도록
            flex: '1 1 0%',
            minHeight: '400px', // 임팩트 맵 최소 크기 보장
            // maxHeight는 동적으로 계산: 전체 높이 - (백테스트 최소 높이 + gap + padding)
            maxHeight: 'calc(100% - 362px)', // BOTTOM ROW minHeight(300px) + gap(12px) + padding(24px) + 여유(26px)
            height: 'auto',
            overflow: 'hidden'
          }}>
             
             {/* Impact Map - 크기 유지, 최소 높이 보장 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-8 lg:col-span-9 xl:col-span-8 h-full min-h-0" style={{ 
               minHeight: '400px', // 임팩트 맵 최소 크기 유지
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

             {/* Node Intelligence - 임팩트 맵과 함께 크기 유지 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-3 xl:col-span-4 h-full min-h-0" style={{
               minHeight: '400px',
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

          {/* BOTTOM ROW: SIMULATION ENGINE - 화면 축소 시 높이만 줄어듦, 필터 패널 하단과 정렬 */}
          <div className="grid grid-cols-12 gap-3 flex-shrink-0" style={{ 
            paddingLeft: '12px',
            // 화면이 줄어들면 높이를 줄이되, 최소 높이는 유지
            // flex-shrink-0으로 설정하여 TOP ROW가 먼저 축소되지 않도록
            minHeight: 'clamp(300px, calc(100vh - 500px), 500px)', // 화면 높이에 따라 동적 조정, 최소 300px
            maxHeight: '500px',
            height: 'auto', // flex 컨테이너가 자동으로 높이 계산
            overflow: 'hidden',
            // 필터 패널 하단(bottom-3 = 12px)과 정확히 맞추기 위해 marginBottom 없음
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
