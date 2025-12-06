import React, { useState, useRef, useMemo } from 'react';
import { NodeData, FilterState } from '../types';
import {
  Loader2,
  ShieldAlert,
  Zap,
  Plus,
  Minus,
  Maximize2,
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
  if (node.atomVolumeShare < filters.atomShare[0] || node.atomVolumeShare > filters.atomShare[1]) return false;
  
  // ATOMONE Share: 범위 체크
  if (node.oneVolumeShare < filters.oneShare[0] || node.oneVolumeShare > filters.oneShare[1]) return false;
  
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
  const mapRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);

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

  const handleMouseMove = (e: React.MouseEvent) => {
    // 항상 마우스 위치는 업데이트
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setMapSize({ width: rect.width, height: rect.height });
    }

    // 팬닝 중일 때만 뷰 이동
    if (!isPanning) return;
    e.preventDefault();
    if (!wasDragged.current) wasDragged.current = true;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
    setMousePos(null);
  };

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
      const roi = node.roi ?? 0;
      return {
        ...node,
        _isActive: isNodeActive(node, filters),
        _AII: node.size,
        _netFlow: node.netBuyRatio,
        _roi: roi,
        _atomShare: node.atomVolumeShare,
        _oneShare: node.oneVolumeShare,
        _volume: node.totalVolume,
        _tx: node.txCount,
      };
    });

    const activeNodes = enrichedNodes.filter((n) => n._isActive);
    
    // Calculate log values for active nodes
    const logVols = activeNodes
      .map((n) => {
        const vol = Math.max(1, n._volume || 1);
        return Math.log10(vol);
      })
      .sort((a, b) => a - b);
    
    const logTxs = activeNodes
      .map((n) => {
        const tx = Math.max(1, n._tx || 1);
        return Math.log10(tx);
      })
      .sort((a, b) => a - b);

    // Calculate P5 and P95 percentiles
    const getPercentile = (sorted: number[], p: number) => {
      if (sorted.length === 0) return 0;
      const index = Math.floor((p / 100) * (sorted.length - 1));
      return sorted[index] ?? sorted[0];
    };

    const volP5 = logVols.length > 0 ? getPercentile(logVols, 5) : 0;
    const volP95 = logVols.length > 0 ? getPercentile(logVols, 95) : 6;
    const txP5 = logTxs.length > 0 ? getPercentile(logTxs, 5) : 0;
    const txP95 = logTxs.length > 0 ? getPercentile(logTxs, 95) : 4;

    const volRange = volP95 - volP5 || 1;
    const txRange = txP95 - txP5 || 1;

    const { minActiveAII, maxActiveAII } = activeNodes.reduce(
      (acc, n) => ({
        minActiveAII: Math.min(acc.minActiveAII, n._AII),
        maxActiveAII: Math.max(acc.maxActiveAII, n._AII),
      }),
      { minActiveAII: Infinity, maxActiveAII: -Infinity }
    );

    const finalMinAII = isFinite(minActiveAII) ? minActiveAII : 0;
    const finalMaxAII = isFinite(maxActiveAII) ? maxActiveAII : 100;

    const MIN_NODE_SIZE = 14;
    const MAX_NODE_SIZE = 40;
    const INACTIVE_NODE_SIZE = 4;

    // Generate deterministic jitter seed per node
    const getJitter = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return (x - Math.floor(x)) * 1.0 - 0.5; // -0.5 to +0.5
    };

    const renderableNodes = enrichedNodes.map((node, idx) => {
      // X: Total Volume (log) -> normalized to P5~P95 -> 5~95%
      const vol = Math.max(1, node._volume || 1);
      const logVol = Math.log10(vol);
      const clippedVol = Math.max(volP5, Math.min(volP95, logVol));
      const normalizedVol = (clippedVol - volP5) / volRange;
      const baseXPercent = 5 + normalizedVol * 90;
      const jitterX = getJitter(node.id.charCodeAt(0) + idx);
      const xPercent = baseXPercent + jitterX;

      // Y: Tx Count (log) -> normalized to P5~P95 -> 5~95%
      const tx = Math.max(1, node._tx || 1);
      const logTx = Math.log10(tx);
      const clippedTx = Math.max(txP5, Math.min(txP95, logTx));
      const normalizedTx = (clippedTx - txP5) / txRange;
      const baseYPercent = 5 + normalizedTx * 90;
      const jitterY = getJitter(node.id.charCodeAt(0) + idx + 1000);
      const yPercent = baseYPercent + jitterY;

      const range = finalMaxAII - finalMinAII;
      const t = range > 0 ? (node._AII - finalMinAII) / range : 0.5;
      const size = node._isActive
        ? MIN_NODE_SIZE + t * (MAX_NODE_SIZE - MIN_NODE_SIZE)
        : INACTIVE_NODE_SIZE;

      return { ...node, xPercent, yPercent, size };
    });

    // inactive 먼저, active 나중 (active가 위에 보이도록)
    renderableNodes.sort((a, b) => {
      // Active first, larger on top for z-order
      if (a._isActive !== b._isActive) return a._isActive ? 1 : -1;
      return a.size - b.size;
    });

    const MAX_NODES = 400;
    const limitedNodes =
      renderableNodes.length > MAX_NODES
        ? renderableNodes.slice(-MAX_NODES)
        : renderableNodes;

    return { renderableNodes: limitedNodes, activeCount: activeNodes.length };
  }, [nodes, filters]);

  return (
    <div className="h-full glass-card-light dark:glass-card-dark rounded-[32px] p-5 flex flex-col relative" style={{ height: '100%', minHeight: '100%', maxHeight: '100%' }}>
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-1.5 rounded-lg shadow-sm">
            <Zap size={14} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-widest">
              Impact Map
            </h2>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl text-[9px] ${
            apiStatus === 'live'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : apiStatus === 'mock'
              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-aether-dark-subtext'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              apiStatus === 'live'
                ? 'bg-emerald-500'
                : apiStatus === 'mock'
                ? 'bg-amber-500'
                : 'bg-gray-400'
            }`}
          ></div>
          <span className="leading-none">
            {apiStatus === 'live'
              ? 'Live Data'
              : apiStatus === 'mock'
              ? 'Mock Data'
              : 'Loading...'}
          </span>
        </div>
      </div>

      <div
        ref={mapRef}
        className={`flex-1 rounded-2xl relative overflow-hidden ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06), inset 0 -2px 4px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.08)'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        {/* Axes labels */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext rotate-[-90deg] origin-left pointer-events-none">
          Tx Count (거래 빈도, log) ↑
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext pointer-events-none">
          Total Volume (거래 규모, log) →
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-30">
            <Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
          </div>
        )}

        {!loading && processedNodes.activeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-400 dark:text-aether-dark-subtext z-30">
            <ShieldAlert className="w-10 h-10 mb-2" />
            <span className="font-semibold">No nodes match filters.</span>
          </div>
        )}

        <div
          className="w-full h-full"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            transformOrigin: 'top left',
          }}
        >
          <div className="w-full h-full relative p-4 box-border">
            {/* Grid */}
            <div className="absolute inset-4 grid grid-cols-5 grid-rows-5">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`border-gray-200/60 dark:border-white/10 ${
                    (i + 1) % 5 !== 0 ? 'border-r' : ''
                  } ${i < 20 ? 'border-b' : ''}`}
                ></div>
              ))}
            </div>

            {/* Subtle vignette */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5 dark:to-black/20 pointer-events-none"></div>

            {/* Nodes */}
            {processedNodes.renderableNodes.map((node: any) => {
              const isSelected = selectedNode?.id === node.id;
              const isActive = node._isActive;

              // Proximity effect removed for performance
              const finalScale = ((isSelected ? 1.2 : 1) / view.zoom);

              return (
                <div
                  key={node.id}
                  className={`absolute rounded-full transition-all duration-300 ease-out group ${
                    isActive ? 'cursor-pointer hover:!z-20' : 'pointer-events-none'
                  } ${isSelected ? 'z-10' : 'z-0'}`}
                  style={{
                    left: `${node.xPercent}%`,
                    bottom: `${node.yPercent}%`,
                    width: `${node.size}px`,
                    height: `${node.size}px`,
                    transform: `translate(-50%, 50%) scale(${finalScale})`,
                  }}
                  onClick={() => {
                    if (wasDragged.current || !isActive) return;
                    onSelectNode(isSelected ? null : node);
                  }}
                >
                  {/* 기본 코어 (홀로그램 제거, 심플한 색/링만 유지) */}
                  <div
                    className={`
                      w-full h-full rounded-full transition-all duration-300
                      ${
                        isActive
                          ? node.bias === 'ATOM'
                            ? 'bg-aether-atom'
                            : node.bias === 'ATOMONE'
                            ? 'bg-aether-one'
                            : 'bg-aether-mixed'
                          : 'bg-gray-300 dark:bg-gray-700'
                      }
                      ${isActive ? 'opacity-80' : 'opacity-30'}
                      ${
                        isSelected
                          ? `ring-4 ring-white/80 dark:ring-white/50 ${
                              node.bias === 'ATOM'
                                ? 'ring-offset-aether-atom'
                                : node.bias === 'ATOMONE'
                                ? 'ring-offset-aether-one'
                                : 'ring-offset-aether-mixed'
                            } ring-offset-2 shadow-lg`
                          : isActive
                          ? 'ring-1 ring-black/5 dark:ring-white/20 shadow-md'
                          : ''
                      }
                    `}
                  />

                  {/* Tooltip */}
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
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-20">
          <button
            onClick={zoomIn}
            aria-label="Zoom In"
            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 dark:border-white/10 text-gray-500 dark:text-aether-dark-subtext hover:text-indigo-500 dark:hover:text-white hover:bg-white dark:hover:bg-aether-dark-card transition-all transform hover:scale-105 active:scale-95"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={zoomOut}
            aria-label="Zoom Out"
            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 dark:border-white/10 text-gray-500 dark:text-aether-dark-subtext hover:text-indigo-500 dark:hover:text-white hover:bg-white dark:hover:bg-aether-dark-card transition-all transform hover:scale-105 active:scale-95"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={resetView}
            aria-label="Reset View"
            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 dark:border-white/10 text-gray-500 dark:text-aether-dark-subtext hover:text-indigo-500 dark:hover:text-white hover:bg-white dark:hover:bg-aether-dark-card transition-all transform hover:scale-105 active:scale-95"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImpactMap;