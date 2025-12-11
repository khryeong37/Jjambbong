import React, { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import { NodeData, FilterState } from '../types';
import {
  Loader2,
  ShieldAlert,
  Zap,
  Plus,
  Minus,
  Maximize2,
  HelpCircle,
} from 'lucide-react';

interface ImpactMapProps {
  nodes: NodeData[];
  selectedNode: NodeData | null;
  filters: FilterState;
  onSelectNode: (node: NodeData | null) => void;
  loading: boolean;
  apiStatus: 'loading' | 'live' | 'mock';
}

const isNodeActive = (node: NodeData, filters: FilterState): boolean => {
  // Total Volume: 범위 체크
  if (node.totalVolume < filters.totalVolume[0] || node.totalVolume > filters.totalVolume[1]) return false;
  
  // Average Trade Size: 범위 체크
  if (node.avgTradeSize < filters.avgTradeSize[0] || node.avgTradeSize > filters.avgTradeSize[1]) return false;
  
  // Net Buy Ratio: 범위 체크
  if (node.netBuyRatio < filters.netBuyRatio[0] || node.netBuyRatio > filters.netBuyRatio[1]) return false;
  
  // Tx Count: 범위 체크
  if (node.txCount < filters.txCount[0] || node.txCount > filters.txCount[1]) return false;
  
  // ATOM Share: 범위 체크
  // ATOM 노드는 atomVolumeShare가 높고, oneVolumeShare가 낮을 수 있으므로
  // bias에 따라 필터링 조건을 완화
  if (node.bias === 'ATOM') {
    // ATOM 노드: atomShare만 체크, oneShare는 완화 (0~1 범위에서만 체크)
    if (node.atomVolumeShare < filters.atomShare[0] || node.atomVolumeShare > filters.atomShare[1]) return false;
    // oneShare는 최소값만 체크 (ATOM 노드는 oneShare가 낮을 수 있음)
    if (node.oneVolumeShare > filters.oneShare[1]) return false;
  } else if (node.bias === 'ATOMONE') {
    // ATOMONE 노드: oneShare만 체크, atomShare는 완화
    if (node.oneVolumeShare < filters.oneShare[0] || node.oneVolumeShare > filters.oneShare[1]) return false;
    // atomShare는 최대값만 체크 (ATOMONE 노드는 atomShare가 낮을 수 있음)
    if (node.atomVolumeShare > filters.atomShare[1]) return false;
  } else {
    // MIXED 노드: 둘 다 체크
    if (node.atomVolumeShare < filters.atomShare[0] || node.atomVolumeShare > filters.atomShare[1]) return false;
    if (node.oneVolumeShare < filters.oneShare[0] || node.oneVolumeShare > filters.oneShare[1]) return false;
  }
  
  // IBC Share: 범위 체크
  if (node.ibcVolumeShare < filters.ibcShare[0] || node.ibcVolumeShare > filters.ibcShare[1]) return false;
  
  // Active Days: 범위 체크
  if (node.activeDays < filters.activeDays[0] || node.activeDays > filters.activeDays[1]) return false;

  // Recent Activity: 'ALL'이 아니면 날짜 체크
  if (filters.recentActivity !== 'ALL') {
    const lastActive = new Date(node.lastActiveDate);
    const now = new Date();
    const daysAgo = (now.getTime() - lastActive.getTime()) / (1000 * 3600 * 24);
    const filterDays = parseInt(filters.recentActivity.replace('D', ''), 10);
    if (daysAgo > filterDays) return false;
  }

  // AII Score: 범위 체크
  if (node.size < filters.aiiScore[0] || node.size > filters.aiiScore[1]) return false;
  
  // Timing Type: 'ALL'이 아니면 타입 체크
  if (filters.timingType !== 'ALL' && node.timing !== filters.timingType) return false;
  
  // Correlation: 범위 체크
  if (node.correlationScore < filters.correlation[0] || node.correlationScore > filters.correlation[1]) return false;

  return true;
};

const ImpactMap: React.FC<ImpactMapProps> = ({
  nodes,
  selectedNode,
  filters,
  onSelectNode,
  loading,
  apiStatus,
}) => {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [showBiasLegend, setShowBiasLegend] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);
  const isDraggingNode = useRef(false);

  // 마우스 위치 & 맵 크기 (노드 근접 스케일링용)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(null);



  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? view.zoom * zoomFactor : view.zoom / zoomFactor;
    const clampedZoom = Math.max(0.25, Math.min(4, newZoom));
    if (clampedZoom === view.zoom) return;

    const zoomRatio = clampedZoom / view.zoom;
    const newX = mouseX - (mouseX - view.x) * zoomRatio;
    const newY = mouseY - (mouseY - view.y) * zoomRatio;

    setView({ x: newX, y: newY, zoom: clampedZoom });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsPanning(true);
    wasDragged.current = false;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  // 마우스 이동 핸들러 최적화 (requestAnimationFrame 사용)
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ dx: number; dy: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 항상 마우스 위치는 업데이트 (스로틀링)
    if (mapRef.current && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (mapRef.current) {
          const rect = mapRef.current.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setMapSize({ width: rect.width, height: rect.height });
        }
        rafRef.current = null;
      });
    }

    // 팬닝 중일 때만 뷰 이동
    if (!isPanning) return;
    e.preventDefault();
    if (!wasDragged.current) wasDragged.current = true;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    // 뷰 업데이트를 requestAnimationFrame으로 배치
    pendingUpdateRef.current = { dx, dy };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingUpdateRef.current) {
          setView((prev) => ({ 
            ...prev, 
            x: prev.x + pendingUpdateRef.current!.dx, 
            y: prev.y + pendingUpdateRef.current!.dy 
          }));
          pendingUpdateRef.current = null;
        }
        rafRef.current = null;
      });
    }
    
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [isPanning]);

  const handleMouseUpOrLeave = useCallback(() => {
    setIsPanning(false);
    isDraggingNode.current = false;
    setMousePos(null);
    // 정리
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, []);

  const zoomWithCenter = (factor: number) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newZoom = view.zoom * factor;
    const clampedZoom = Math.max(0.25, Math.min(4, newZoom));
    if (clampedZoom === view.zoom) return;

    const zoomRatio = clampedZoom / view.zoom;
    const newX = centerX - (centerX - view.x) * zoomRatio;
    const newY = centerY - (centerY - view.y) * zoomRatio;

    setView({ x: newX, y: newY, zoom: clampedZoom });
  };

  const zoomIn = () => zoomWithCenter(1.3);
  const zoomOut = () => zoomWithCenter(1 / 1.3);
  const resetView = () => setView({ x: 0, y: 0, zoom: 1 });

  const processedNodes = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return { renderableNodes: [] as any[], activeCount: 0 };
    }

    const enrichedNodes = nodes.map((node) => {
      const roi = node.roi ?? 0; // ROI는 퍼센트 단위
      return {
        ...node,
        _isActive: isNodeActive(node, filters),
        _AII: node.size, // AII Score (0~100)
        _netFlow: node.netBuyRatio, // Net Flow Ratio (-1 ~ +1)
        _roi: roi, // ROI (투자 수익률, %)
        _atomShare: node.atomVolumeShare,
        _oneShare: node.oneVolumeShare,
        _volume: node.totalVolume,
        _tx: node.txCount,
        bias: node.bias, // Chain Bias (ATOM, ATOMONE, MIXED)
      };
    });

    const activeNodes = enrichedNodes.filter((n) => n._isActive);
    
    // X축: Net Flow Ratio (-1.0 ~ +1.0) - 순매수 성향
    // Y축: ROI (투자 수익률, %) - 모의투자 기반
    // 버블 크기: AII Score (0~100)
    // 버블 색상: Chain Bias (ATOM bias: 빨강, ATOMONE bias: 파랑, MIXED bias: 보라)
    
    // Net Flow Ratio: -1.0 ~ +1.0 범위
    const netFlowRatios = activeNodes.map((n) => n._netFlow).sort((a, b) => a - b);
    
    // ROI: -100% ~ +200% 범위 (극단값 클리핑)
    const rois = activeNodes.map((n) => Math.max(-100, Math.min(200, n._roi || 0))).sort((a, b) => a - b);
    
    // Calculate P5 and P95 percentiles for better distribution
    const getPercentile = (sorted: number[], p: number) => {
      if (sorted.length === 0) return 0;
      const index = Math.floor((p / 100) * (sorted.length - 1));
      return sorted[index] ?? sorted[0];
    };

    // Net Flow Ratio: P5~P95로 범위 조정 (기본값 -1 ~ +1)
    const netFlowP5 = netFlowRatios.length > 0 ? getPercentile(netFlowRatios, 5) : -1;
    const netFlowP95 = netFlowRatios.length > 0 ? getPercentile(netFlowRatios, 95) : 1;
    
    // ROI: P5~P95로 범위 조정 (기본값 -100 ~ +200)
    const roiP5 = rois.length > 0 ? getPercentile(rois, 5) : -100;
    const roiP95 = rois.length > 0 ? getPercentile(rois, 95) : 200;

    const netFlowRange = netFlowP95 - netFlowP5 || 2; // 기본값 2 (-1 ~ +1)
    const roiRange = roiP95 - roiP5 || 300; // 기본값 300 (-100 ~ +200)

    const { minActiveAII, maxActiveAII } = activeNodes.reduce(
      (acc, n) => ({
        minActiveAII: Math.min(acc.minActiveAII, n._AII),
        maxActiveAII: Math.max(acc.maxActiveAII, n._AII),
      }),
      { minActiveAII: Infinity, maxActiveAII: -Infinity }
    );

    const finalMinAII = isFinite(minActiveAII) ? minActiveAII : 0;
    const finalMaxAII = isFinite(maxActiveAII) ? maxActiveAII : 100;

    // 노드 크기: 차이를 줄이되 여전히 구분 가능하도록
    // 최소 10px, 최대 32px로 범위 축소 + 부드러운 스케일링
    const MIN_NODE_SIZE = 10;
    const MAX_NODE_SIZE = 32;
    const INACTIVE_NODE_SIZE = 3; // Ghost Node는 더 작게

    // Generate deterministic jitter seed per node
    const getJitter = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return (x - Math.floor(x)) * 1.0 - 0.5; // -0.5 to +0.5
    };

    const renderableNodes = enrichedNodes.map((node, idx) => {
      // X축: Net Flow Ratio (-1.0 ~ +1.0) - 순매수 성향
      // 왼쪽: 순매도 패턴, 오른쪽: 순매수 패턴
      const netFlow = Math.max(-1, Math.min(1, node._netFlow || 0));
      const clippedNetFlow = Math.max(netFlowP5, Math.min(netFlowP95, netFlow));
      const normalizedNetFlow = netFlowRange > 0 ? (clippedNetFlow - netFlowP5) / netFlowRange : 0.5;
      const baseXPercent = 5 + normalizedNetFlow * 90; // 5% ~ 95%
      const jitterX = getJitter(node.id.charCodeAt(0) + idx) * 0.5; // jitter 약간 줄임
      const xPercent = baseXPercent + jitterX;

      // Y축: ROI (투자 수익률, %) - 모의투자 기반
      // 아래쪽: 손실 계정 (ROI < 0), 위쪽: 수익 계정 (ROI > 0)
      const roi = Math.max(-100, Math.min(200, node._roi || 0)); // -100% ~ +200% 클리핑
      const clippedRoi = Math.max(roiP5, Math.min(roiP95, roi));
      const normalizedRoi = roiRange > 0 ? (clippedRoi - roiP5) / roiRange : 0.5;
      const baseYPercent = 5 + normalizedRoi * 90; // 5% ~ 95%
      const jitterY = getJitter(node.id.charCodeAt(0) + idx + 1000) * 0.5; // jitter 약간 줄임
      const yPercent = baseYPercent + jitterY;

      // 버블 크기: AII Score 기반 (0~100 → 10px~32px)
      // 부드러운 크기 차이를 위해 cube root 스케일 사용 (√보다 더 부드러움)
      const range = finalMaxAII - finalMinAII;
      const t = range > 0 ? (node._AII - finalMinAII) / range : 0.5;
      // Cube root 스케일: t^(1/3) - 제곱근보다 더 부드러운 커브
      // 최소값 보정으로 작은 값도 적절히 보이도록
      const smoothT = Math.pow(Math.max(0, Math.min(1, t)), 1/3);
      // 추가로 최소 30%는 보장하여 작은 노드도 충분히 보이도록
      const adjustedT = 0.3 + smoothT * 0.7; // 0.3 ~ 1.0 범위
      const size = node._isActive
        ? MIN_NODE_SIZE + adjustedT * (MAX_NODE_SIZE - MIN_NODE_SIZE)
        : INACTIVE_NODE_SIZE;

      return { ...node, xPercent, yPercent, size };
    });

    // Active 노드를 우선적으로 표시하고, 그 다음 inactive 노드 표시
    // Active 노드는 size가 큰 순서대로, inactive 노드는 size가 작은 순서대로
    renderableNodes.sort((a, b) => {
      // Active 노드를 먼저 (더 높은 우선순위)
      if (a._isActive !== b._isActive) {
        return a._isActive ? -1 : 1; // Active가 먼저 오도록
      }
      // 같은 active 상태면 size로 정렬
      // Active는 큰 것부터, inactive는 작은 것부터
      if (a._isActive) {
        return b.size - a.size; // Active: 큰 것부터
      } else {
        return a.size - b.size; // Inactive: 작은 것부터
      }
    });

    // 노드 수 제한 완전히 제거 - 모든 노드 표시
    const limitedNodes = renderableNodes;

    return { 
      renderableNodes: limitedNodes, 
      activeCount: activeNodes.length,
      roiRange: { min: roiP5, max: roiP95, range: roiRange },
      netFlowRange: { min: netFlowP5, max: netFlowP95, range: netFlowRange }
    };
  }, [nodes, filters]);

  // Viewport 기반 가상화: 화면에 보이는 노드만 렌더링
  const [viewportBounds, setViewportBounds] = useState({ left: 0, top: 0, right: 100, bottom: 100 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // LOD (Level of Detail): 줌 레벨에 따라 작은 노드 필터링
  const visibleNodes = useMemo(() => {
    const { renderableNodes } = processedNodes;
    if (!renderableNodes.length) return [];
    
    // 줌 레벨에 따른 최소 노드 크기 (렌더링 최적화)
    // 줌 아웃 시 작은 노드는 숨김으로 성능 향상
    const minVisibleSize = view.zoom < 0.5 ? 8 : view.zoom < 1 ? 6 : 4;
    
    return renderableNodes.filter((node: any) => {
      // Active 노드는 항상 표시
      if (node._isActive) return true;
      
      // Inactive 노드는 줌 레벨에 따라 필터링
      return node.size >= minVisibleSize;
    });
  }, [processedNodes, view.zoom]);

  return (
    <div className="h-full glass-card-light dark:glass-card-dark rounded-[32px] p-5 flex flex-col relative" style={{ 
      height: '100%', 
      maxHeight: '100%', 
      borderRadius: '32px', 
      isolation: 'isolate',
      boxShadow: 'none',
      border: '1px solid rgba(200, 215, 232, 0.14)',
    }}>
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-50 dark:bg-white/5 p-1.5 rounded-lg shadow-sm" style={{
            border: 'none'
          }}>
            <Zap size={14} className="text-indigo-500 dark:text-white/70" />
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-widest">
              Impact Map
            </h2>
          </div>
        </div>

      </div>

      <div
        ref={mapRef}
        className={`flex-1 rounded-2xl relative overflow-hidden ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          background: 'transparent',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: 'inset 0 2px 4px rgba(196, 181, 253, 0.1), inset 0 -2px 4px rgba(196, 181, 253, 0.1), 0 4px 16px rgba(196, 181, 253, 0.15)'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        {/* Axes labels */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 dark:text-white/80 rotate-[-90deg] origin-left pointer-events-none">
          ROI (투자 수익률) ↑
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-white/80 pointer-events-none">
          Net Flow (순매수 성향) →
        </div>
        {/* X축 중앙 기준선 (Net Flow = 0, 중립 위치) */}
        <div className="absolute left-1/2 top-4 bottom-4 w-px bg-gray-300/30 dark:bg-white/10 pointer-events-none z-0" style={{ transform: 'translateX(-50%)' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full px-1 text-[8px] text-gray-400 dark:text-gray-500 font-semibold">중립</div>
        </div>
        {/* Y축 0% 기준선 (ROI = 0, 손익 분기점) */}
        {processedNodes.roiRange && (() => {
          const { min, max, range } = processedNodes.roiRange;
          // ROI = 0이 되는 위치 계산
          const roi0 = 0;
          const clippedRoi0 = Math.max(min, Math.min(max, roi0));
          const normalizedRoi0 = range > 0 ? (clippedRoi0 - min) / range : 0.5;
          const yPercent0 = 5 + normalizedRoi0 * 90; // 5% ~ 95% 범위 내 위치
          return (
            <div 
              className="absolute left-4 right-4 h-px bg-gray-300/30 dark:bg-white/10 pointer-events-none z-0" 
              style={{ 
                bottom: `${100 - yPercent0}%`,
                transform: 'translateY(50%)'
              }}
            >
              <div className="absolute left-0 -translate-x-full -translate-y-1/2 top-1/2 px-1 text-[8px] text-gray-400 dark:text-gray-500 font-semibold">0%</div>
            </div>
          );
        })()}

        {/* Color Legend Toggle Button */}
        <button
          onClick={() => setShowBiasLegend(!showBiasLegend)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-white/10 hover:bg-white dark:hover:bg-slate-900 transition-all z-20"
          aria-label="Toggle bias legend"
        >
          <HelpCircle size={16} className="text-gray-600 dark:text-gray-300" />
        </button>

        {/* Color Legend */}
        {showBiasLegend && (
          <div className="absolute top-14 right-4 bg-white/80 dark:bg-white/7 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20 dark:border-[#4ED6E6]/20 z-20 animate-in slide-in-from-top-2 duration-200 max-w-[260px]"
          style={{}}>
            <div className="text-[9px] font-bold text-gray-500 dark:text-white/70 uppercase tracking-wider mb-3">Impact Map Guide</div>
            <div className="space-y-2.5 mb-3">
              <div className="text-[9px] font-semibold text-gray-600 dark:text-white/70 mb-1.5">체인 선호도 (Chain Bias):</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }}></div>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-white/80">ATOM (ATOM 선호)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#0EA5E9' }}></div>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-white/80">ATOMONE (ATOMONE 선호)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#A855F7' }}></div>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-white/80">MIXED (혼합)</span>
              </div>
            </div>
            <div className="space-y-2 border-t border-gray-200/50 dark:border-[#4ED6E6]/20 pt-2.5">
              <div className="text-[9px] font-semibold text-gray-600 dark:text-white/70">Axes:</div>
              <div className="text-[9px] text-gray-600 dark:text-gray-400 leading-relaxed">
                <div className="mb-1"><span className="font-semibold">X축:</span> Net Flow (순매수 성향)</div>
                <div className="mb-1 pl-4 text-gray-500 dark:text-gray-500">← 순매도 | 순매수 →</div>
                <div className="mb-1"><span className="font-semibold">Y축:</span> ROI (투자 수익률)</div>
                <div className="pl-4 text-gray-500 dark:text-gray-500">↓ 손실 | 수익 ↑</div>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-gray-200/50 dark:border-[#4ED6E6]/20">
              <div className="text-[9px] text-gray-500 dark:text-gray-500 italic">
                버블 크기 = AII (Account Impact Index, 영향력 점수)
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-30">
            <Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
          </div>
        )}

        {!loading && processedNodes.activeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-400 dark:text-white/70 z-30">
            <ShieldAlert className="w-10 h-10 mb-2" />
            <span className="font-semibold">No nodes match filters.</span>
          </div>
        )}

        <div
          className="w-full h-full"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transition: isPanning ? 'none' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transformOrigin: 'top left',
          }}
        >
          <div className="w-full h-full relative p-4 box-border">
            {/* Grid */}
            <div className="absolute inset-4 grid grid-cols-5 grid-rows-5">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`border-gray-200/60 dark:border-[#4ED6E6]/20 ${
                    (i + 1) % 5 !== 0 ? 'border-r' : ''
                  } ${i < 20 ? 'border-b' : ''}`}
                ></div>
              ))}
            </div>


            {/* Nodes - 최적화된 렌더링 */}
            <NodeRenderer
              nodes={visibleNodes}
              selectedNode={selectedNode}
              view={view}
              wasDragged={wasDragged}
              onSelectNode={onSelectNode}
            />
          </div>
        </div>
        <div ref={mapContainerRef} className="absolute inset-0 pointer-events-none" />

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-20" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={zoomIn}
            aria-label="Zoom In"
            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-white/6 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 dark:border-[#4ED6E6]/20 text-gray-500 dark:text-white/70 hover:text-indigo-500 dark:hover:text-white hover:bg-white dark:hover:bg-white/8 transition-all transform hover:scale-105 active:scale-95"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={zoomOut}
            aria-label="Zoom Out"
            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-white/6 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 dark:border-[#4ED6E6]/20 text-gray-500 dark:text-white/70 hover:text-indigo-500 dark:hover:text-white hover:bg-white dark:hover:bg-white/8 transition-all transform hover:scale-105 active:scale-95"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={resetView}
            aria-label="Reset View"
            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-white/6 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 dark:border-[#4ED6E6]/20 text-gray-500 dark:text-white/70 hover:text-indigo-500 dark:hover:text-white hover:bg-white dark:hover:bg-white/8 transition-all transform hover:scale-105 active:scale-95"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// 최적화된 노드 렌더러 컴포넌트 (메모이제이션)
interface NodeRendererProps {
  nodes: any[];
  selectedNode: NodeData | null;
  view: { x: number; y: number; zoom: number };
  wasDragged: React.MutableRefObject<boolean>;
  onSelectNode: (node: NodeData | null) => void;
}

const NodeRenderer = memo(({ nodes, selectedNode, view, wasDragged, onSelectNode }: NodeRendererProps) => {
  const handleNodeClick = useCallback((e: React.MouseEvent, node: any, isSelected: boolean, isActive: boolean) => {
    if (wasDragged.current || !isActive) return;
    e.stopPropagation();
    onSelectNode(isSelected ? null : node);
  }, [wasDragged, onSelectNode]);

  return (
    <>
      {nodes.map((node: any) => {
        const isSelected = selectedNode?.id === node.id;
        const isActive = node._isActive;
        const finalScale = 1 / view.zoom;
        
        const nodeStyle = {
          left: `${node.xPercent}%`,
          bottom: `${node.yPercent}%`,
          width: `${node.size}px`,
          height: `${node.size}px`,
          transform: `translate(-50%, 50%) scale(${finalScale})`,
          willChange: isSelected || isActive ? 'transform, opacity' : 'auto',
          transition: isSelected || isActive 
            ? 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out'
            : 'none',
          opacity: isSelected ? 1 : isActive ? 0.75 : 0.35,
          contain: 'layout style paint' as const, // CSS contain으로 렌더링 최적화
        };

        return (
          <div
            key={node.id}
            className={`absolute rounded-full group ${
              isActive ? 'cursor-pointer hover:!z-20' : 'pointer-events-none'
            } ${isSelected ? 'z-10' : 'z-0'}`}
            style={nodeStyle}
            onClick={(e) => handleNodeClick(e, node, isSelected, isActive)}
          >
            <div
              className={`relative w-full h-full rounded-full ${
                isActive ? '' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              style={{
                backgroundColor: isActive 
                  ? (node.bias === 'ATOM'
                      ? '#EF4444'
                      : node.bias === 'ATOMONE'
                      ? '#0EA5E9'
                      : '#A855F7')
                  : undefined,
                opacity: isActive ? 0.65 : 0.3,
                boxShadow: 'none',
                transition: isActive 
                  ? 'background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease-out, box-shadow 0.4s ease-out'
                  : 'none',
                transform: 'scale(1)',
                animation: isSelected ? 'nodePulse 0.45s ease-out' : 'none',
                ...(isSelected ? {
                  boxShadow: '0 0 0 4px rgba(255, 235, 59, 0.8), 0 0 20px rgba(255, 235, 59, 0.4)',
                } : isActive ? {
                  boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.3)',
                } : {})
              }}
            />
            {isActive && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none delay-300 origin-bottom"
                style={{ transform: `scale(${1 / view.zoom})` }}
              >
                {node.name}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수로 불필요한 리렌더링 방지
  return (
    prevProps.nodes.length === nextProps.nodes.length &&
    prevProps.selectedNode?.id === nextProps.selectedNode?.id &&
    prevProps.view.zoom === nextProps.view.zoom &&
    prevProps.view.x === nextProps.view.x &&
    prevProps.view.y === nextProps.view.y
  );
});

NodeRenderer.displayName = 'NodeRenderer';

export default ImpactMap;
