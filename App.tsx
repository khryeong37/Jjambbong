import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import FilterPanel from './components/FilterPanel';
import ImpactMap from './components/ImpactMap';
import NodeIntelligence from './components/NodeIntelligence';
import SimulationEngine from './components/SimulationEngine';
import GradientBackground from './components/GradientBackground';
import { loadSwapNodes, loadLocalMarket, loadNodeDetail, loadMarketData } from './utils/swapLoader';
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
    totalVolume: [0, 2000000], // DuckDB 기준 추가 여유
    avgTradeSize: [0, 200000], // DuckDB 기준 추가 여유
    netBuyRatio: [-1, 1],
    txCount: [0, 500], // DuckDB 집계 기준 최대값 확대
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
  const rangeKey = useMemo(
    () => `${filters.dateRange.start || 'min'}_${filters.dateRange.end || 'max'}`,
    [filters.dateRange]
  );

  const applyFilters = () => {
    setFilters(tempFilters);
  };

  const resetFilters = () => {
    setTempFilters(initialFilters);
    setFilters(initialFilters);
  };

  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  type NodeDetailEntry = {
    data: NodeData;
    requestedRangeKey: string;
    actualRangeKey: string;
    isFallback: boolean;
  };

  const [nodeDetails, setNodeDetails] = useState<Record<string, NodeDetailEntry>>({});
  const [selectedNodeLoading, setSelectedNodeLoading] = useState(false);
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
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setApiStatus('loading');

      try {
        const valData = await loadSwapNodes(filters.dateRange);
        if (cancelled) return;
        setNodes(valData);
        setSelectedNodeId((prev) => {
          if (prev && !valData.some((n) => n.id === prev)) {
            return null;
          }
          return prev;
        });
        setApiStatus('live');
      } catch (error) {
        console.error('Failed to load nodes, falling back to mock data', error);
        setApiStatus('mock');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [filters.dateRange]);

  useEffect(() => {
    let cancelled = false;
    const fetchMarket = async () => {
      try {
        const market = await loadMarketData();
        if (cancelled) return;
        setAtomData(market.atom);
        setOneData(market.atone);
      } catch (error) {
        console.error('Failed to fetch market data, using local mock', error);
        if (!cancelled) {
          const localMarket = loadLocalMarket();
          setAtomData(localMarket.atom);
          setOneData(localMarket.one);
        }
      }
    };
    fetchMarket();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNodeSummary = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const detailEntry = selectedNodeId ? nodeDetails[selectedNodeId] : null;

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const detail =
      detailEntry && detailEntry.requestedRangeKey === rangeKey ? detailEntry.data : null;
    return detail || selectedNodeSummary || null;
  }, [detailEntry, selectedNodeId, selectedNodeSummary, rangeKey]);

  const hasDetailForRange =
    !!detailEntry && detailEntry.requestedRangeKey === rangeKey;

  const isFallbackDetail =
    !!detailEntry &&
    detailEntry.requestedRangeKey === rangeKey &&
    detailEntry.isFallback;

  useEffect(() => {
    if (!selectedNodeId) return;
    const existing = nodeDetails[selectedNodeId];
    if (existing && existing.requestedRangeKey === rangeKey) return;
    let cancelled = false;
    setSelectedNodeLoading(true);

    const fetchDetail = async () => {
      try {
        const detail = await loadNodeDetail(selectedNodeId, filters.dateRange);
        if (cancelled) return;
        setNodeDetails((prev) => ({
          ...prev,
          [selectedNodeId]: {
            data: detail,
            requestedRangeKey: rangeKey,
            actualRangeKey: rangeKey,
            isFallback: false,
          },
        }));
      } catch (error) {
        console.warn('Range-specific detail fetch failed, retrying without range.', error);
        try {
          const fallbackDetail = await loadNodeDetail(selectedNodeId);
          if (cancelled) return;
          setNodeDetails((prev) => ({
            ...prev,
            [selectedNodeId]: {
              data: fallbackDetail,
              requestedRangeKey: rangeKey,
              actualRangeKey: 'FULL_DATA',
              isFallback: true,
            },
          }));
        } catch (fallbackError) {
          console.error('Failed to fetch node detail', fallbackError);
        }
      } finally {
        if (!cancelled) setSelectedNodeLoading(false);
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedNodeId, nodeDetails, filters.dateRange, rangeKey]);

  const handleSelectNode = useCallback((node: NodeData | null) => {
    setSelectedNodeId(node?.id ?? null);
  }, []);

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
            appliedFilters={filters}
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
          
          {/* TOP ROW: MAP & INTELLIGENCE - 세로 영역 확대 */}
          <div className="grid grid-cols-12 gap-3 min-h-0" style={{ 
            paddingLeft: '12px',
            flex: '1 1 0%',
            minHeight: '480px',
            maxHeight: 'calc(100% - 300px)',
            height: 'auto',
            overflow: 'hidden',
          }}>
             
             {/* Impact Map - 크기 유지, 최소 높이 보장 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-8 lg:col-span-9 xl:col-span-8 h-full min-h-0" style={{ 
               minHeight: '440px',
               height: '100%',
               maxHeight: '100%'
             }}>
                <ImpactMap 
                  nodes={nodes} 
                  selectedNode={selectedNode} 
                  filters={filters} 
                  onSelectNode={handleSelectNode} 
                  loading={loading}
                  apiStatus={apiStatus} 
                  isFallbackDetail={isFallbackDetail}
                />
             </div>

             {/* Node Intelligence - 임팩트 맵과 함께 크기 유지 */}
             <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-3 xl:col-span-4 h-full min-h-0" style={{
               minHeight: '440px',
               height: '100%',
               maxHeight: '100%'
             }}>
                <NodeIntelligence 
                  selectedNode={selectedNode}
                  slots={slots}
                  setSlots={setSlots}
                  isLoadingDetail={selectedNodeLoading && !!selectedNodeId && !hasDetailForRange}
                />
             </div>
          </div>

          {/* BOTTOM ROW: SIMULATION ENGINE - 높이 축소 */}
          <div className="grid grid-cols-12 gap-3 flex-shrink-0" style={{ 
            paddingLeft: '12px',
            minHeight: 'clamp(220px, calc(100vh - 560px), 420px)',
            maxHeight: '420px',
            height: 'auto',
            overflow: 'hidden',
            marginBottom: 0
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
