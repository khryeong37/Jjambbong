import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { NodeData, FilterState } from '../types';
import {
  Loader2,
  ShieldAlert,
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

const formatCompactNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
};

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
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);
  const isDraggingNode = useRef(false);
  const [hoveredNode, setHoveredNode] = useState<{ node: any; x: number; y: number } | null>(null);

  // 마우스 위치 & 맵 크기 (노드 근접 스케일링용)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(null);
  const [positionedNodes, setPositionedNodes] = useState<any[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  // Canvas 크기 동기화
  useEffect(() => {
    if (!mapRef.current) return;
    const element = mapRef.current;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const { width, height } = rect;
      setMapSize({ width, height });
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);



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

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    const picked = getNodeAtPosition(e.clientX, e.clientY);
    if (picked && picked.node._isActive) {
      const isSelected = selectedNode?.id === picked.node.id;
      onSelectNode(isSelected ? null : picked.node);
    } else {
      onSelectNode(null);
    }
  };

  const processedNodes = useMemo(() => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return { renderableNodes: [] as any[], activeCount: 0, filteredCount: 0 };
    }

    const enrichedNodes = nodes.map((node) => {
      const roi = node.roi ?? 0; // ROI는 퍼센트 단위
      const crossVolume = Math.max(0, node.totalVolume ?? 0);
      return {
        ...node,
        _isActive: isNodeActive(node, filters),
        _AII: node.size, // AII Score (0~100) – 우측 패널 등에서 사용
        _netFlow: node.netBuyRatio, // Net Flow Ratio (-1 ~ +1)
        _roi: roi, // ROI (투자 수익률, %)
        _atomShare: node.atomVolumeShare,
        _oneShare: node.oneVolumeShare,
        _volume: crossVolume,
        _tx: node.txCount,
        bias: node.bias, // Chain Bias (ATOM, ATOMONE, MIXED)
      };
    });

    const activeNodes = enrichedNodes.filter((n) => n._isActive);
    
    // X축: Net Flow Ratio (-1.0 ~ +1.0) - 순매수 성향
    // Y축: ROI (투자 수익률, %) - 모의투자 기반
    // 버블 크기: ATOM↔ATOMONE 교차 거래량 (로그 스케일)
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

    const volumeValues = activeNodes
      .map((n) => n._volume)
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    const maxObservedVolume = volumeValues.length ? volumeValues[volumeValues.length - 1] : 0;
    const volumeCap = volumeValues.length ? getPercentile(volumeValues, 99.5) : 0;
    const safeVolumeCap = Math.max(volumeCap, maxObservedVolume, 1);

    // 노드 크기: 기획서 비율은 유지하되 전체 범위를 축소해 시각적 균형 개선
    const MIN_NODE_SIZE = 8;
    const MAX_NODE_SIZE = 32;
    const INACTIVE_NODE_SIZE = 3; // Ghost Node는 더 작게
    const LOG_DENOM = Math.log1p(safeVolumeCap);

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
      const jitterX = getJitter(node.id.charCodeAt(0) + idx) * 1.45;
      let xPercent = baseXPercent + jitterX;

      // Y축: ROI (투자 수익률, %) - 모의투자 기반
      // 아래쪽: 손실 계정 (ROI < 0), 위쪽: 수익 계정 (ROI > 0)
      const roi = Math.max(-100, Math.min(200, node._roi || 0)); // -100% ~ +200% 클리핑
      const clippedRoi = Math.max(roiP5, Math.min(roiP95, roi));
      const normalizedRoi = roiRange > 0 ? (clippedRoi - roiP5) / roiRange : 0.5;
      const baseYPercent = 5 + normalizedRoi * 90; // 5% ~ 95%
      const jitterY = getJitter(node.id.charCodeAt(0) + idx + 1000) * 1.0;
      let yPercent = baseYPercent + jitterY;

      // 극단 레일(x=±1) 근처 노드는 좁은 밴드 안에서만 좌우 이동 + Y축으로 살짝 분산
      const EDGE_THRESHOLD = 0.12;
      const EDGE_BAND_WIDTH = 3.5; // 퍼센트포인트
      const EDGE_VERTICAL_SPREAD = 12;
      let edgeRail: 'LEFT' | 'RIGHT' | null = null;
      const railNoise = getJitter(node.id.charCodeAt(node.id.length - 1) + idx * 3 + 5000);
      const railT = railNoise + 0.5; // 0~1

      if (normalizedNetFlow <= EDGE_THRESHOLD) {
        edgeRail = 'LEFT';
        xPercent = 5 + railT * EDGE_BAND_WIDTH;
        yPercent = Math.min(95, Math.max(5, yPercent + (railT - 0.5) * EDGE_VERTICAL_SPREAD));
      } else if (normalizedNetFlow >= 1 - EDGE_THRESHOLD) {
        edgeRail = 'RIGHT';
        xPercent = 95 - EDGE_BAND_WIDTH + railT * EDGE_BAND_WIDTH;
        yPercent = Math.min(95, Math.max(5, yPercent + (railT - 0.5) * EDGE_VERTICAL_SPREAD));
      }

      // 버블 크기: ATOM↔ATOMONE 교차 거래량 기반 로그+제곱근 스케일
      const volume = Math.max(0, node._volume || 0);
      const cappedVolume = Math.min(volume, safeVolumeCap);
      const logComponent = LOG_DENOM > 0 ? Math.log1p(cappedVolume) / LOG_DENOM : 0;
      const sqrtComponent = safeVolumeCap > 0 ? Math.sqrt(cappedVolume / safeVolumeCap) : 0;
      const normalizedVolume = Math.min(1, Math.max(0, logComponent * 0.45 + sqrtComponent * 0.55));
      const adjustedT = 0.05 + normalizedVolume * 0.85; // 5%~90% 비율
      const size = node._isActive
        ? MIN_NODE_SIZE + adjustedT * (MAX_NODE_SIZE - MIN_NODE_SIZE)
        : INACTIVE_NODE_SIZE;

      return { ...node, xPercent, yPercent, size, edgeRail };
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
      filteredCount: activeNodes.length,
      roiRange: { min: roiP5, max: roiP95, range: roiRange },
      netFlowRange: { min: netFlowP5, max: netFlowP95, range: netFlowRange },
      volumeStats: {
        cap: safeVolumeCap,
        max: maxObservedVolume,
      },
    };
  }, [nodes, filters]);

  // Viewport 기반 가상화: 화면에 보이는 노드만 렌더링
  // LOD (Level of Detail): 줌 레벨에 따라 작은 노드 필터링
  const displayNodes = positionedNodes.length ? positionedNodes : processedNodes.renderableNodes;

  const visibleNodes = useMemo(() => {
    if (!displayNodes.length) return [];
    
    // 줌 레벨에 따른 최소 노드 크기 (렌더링 최적화)
    // 줌 아웃 시 작은 노드는 숨김으로 성능 향상
    const minVisibleSize = view.zoom < 0.5 ? 8 : view.zoom < 1 ? 6 : 4;
    
    return displayNodes.filter((node: any) => {
      // Active 노드는 항상 표시
      if (node._isActive) return true;
      
      // Inactive 노드는 줌 레벨에 따라 필터링
      return node.size >= minVisibleSize;
    });
  }, [displayNodes, view.zoom]);

  // Collision-aware 레이아웃 (타겟 좌표에서 일정 범위 내로만 밀어냄)
  useEffect(() => {
    if (!mapSize || !processedNodes.renderableNodes.length) {
      setPositionedNodes(processedNodes.renderableNodes);
      return;
    }

    const nodes = processedNodes.renderableNodes.map((node: any) => {
      const targetX = (node.xPercent / 100) * mapSize.width;
      const targetY = mapSize.height - (node.yPercent / 100) * mapSize.height;
      return {
        ...node,
        targetX,
        targetY,
        displayX: targetX,
        displayY: targetY,
      };
    });

    const iterations = 14;
    const padding = 8;
    const maxDx = 28;
    const maxDy = 38;

    for (let iter = 0; iter < iterations; iter++) {
      let movedInThisIteration = false;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i];
          const nodeB = nodes[j];
          const dx = nodeB.displayX - nodeA.displayX;
          const dy = nodeB.displayY - nodeA.displayY;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const minDistance = nodeA.size + nodeB.size + padding;

          if (distance < minDistance) {
            movedInThisIteration = true;
            const overlap = (minDistance - distance) * 0.65;
            const directionX = dx === 0 ? (Math.random() - 0.5) : dx / distance;
            const directionY = dy === 0 ? (Math.random() - 0.5) : dy / distance;

            // 활성 노드를 좀 더 고정시키기 위한 가중치 (inactive는 더 많이 밀림)
            const activeWeightA = nodeA._isActive ? 0.3 : 0.9;
            const activeWeightB = nodeB._isActive ? 0.3 : 0.9;

            nodeA.displayX -= directionX * overlap * activeWeightA;
            nodeA.displayY -= directionY * overlap * activeWeightA;
            nodeB.displayX += directionX * overlap * activeWeightB;
            nodeB.displayY += directionY * overlap * activeWeightB;
          }
        }
      }

      nodes.forEach((node) => {
        const nodeDxLimit = node.edgeRail ? 20 : maxDx;
        const nodeDyLimit = node.edgeRail ? 42 : maxDy;
        const clampedDx = Math.max(-nodeDxLimit, Math.min(nodeDxLimit, node.displayX - node.targetX));
        const clampedDy = Math.max(-nodeDyLimit, Math.min(nodeDyLimit, node.displayY - node.targetY));
        node.displayX = node.targetX + clampedDx;
        node.displayY = node.targetY + clampedDy;
        node.displayX = Math.max(node.size, Math.min(mapSize.width - node.size, node.displayX));
        node.displayY = Math.max(node.size, Math.min(mapSize.height - node.size, node.displayY));
      });

      if (!movedInThisIteration) break;
    }

    nodes.forEach((node) => {
      node.displacement = Math.hypot(node.displayX - node.targetX, node.displayY - node.targetY);
    });

    setPositionedNodes(nodes);
  }, [mapSize, processedNodes.renderableNodes]);

  const volumeCapLabel = useMemo(
    () => formatCompactNumber(processedNodes.volumeStats?.cap ?? 0),
    [processedNodes.volumeStats]
  );

  const getNodeAtPosition = useCallback((clientX: number, clientY: number) => {
    if (!mapRef.current || !mapSize) return null;
    const rect = mapRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      const node = visibleNodes[i] as any;
      const baseX = node.displayX ?? (node.xPercent / 100) * mapSize.width;
      const baseY = node.displayY ?? mapSize.height - (node.yPercent / 100) * mapSize.height;
      const screenX = view.x + baseX * view.zoom;
      const screenY = view.y + baseY * view.zoom;
      const radius = node.size;
      const dx = x - screenX;
      const dy = y - screenY;
      if (dx * dx + dy * dy <= radius * radius) {
        return { node, x: screenX, y: screenY };
      }
    }
    return null;
  }, [mapRef, mapSize, visibleNodes, view]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapRef.current && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (mapRef.current) {
          const rect = mapRef.current.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        rafRef.current = null;
      });
    }

    const picked = getNodeAtPosition(e.clientX, e.clientY);
    setHoveredNode(picked);

    if (!isPanning) return;
    e.preventDefault();
    if (!wasDragged.current) wasDragged.current = true;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

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
  }, [getNodeAtPosition, isPanning]);

  const handleMouseUpOrLeave = useCallback(() => {
    setIsPanning(false);
    isDraggingNode.current = false;
    setMousePos(null);
    setHoveredNode(null);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, []);

  // Canvas 렌더링
  useEffect(() => {
    if (!canvasRef.current || !mapSize) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, mapSize.width, mapSize.height);

    ctx.translate(view.x, view.y);
    ctx.scale(view.zoom, view.zoom);

    visibleNodes.forEach((node: any) => {
      const baseX = node.displayX ?? (node.xPercent / 100) * mapSize.width;
      const baseY = node.displayY ?? mapSize.height - (node.yPercent / 100) * mapSize.height;
      const radius = node.size / view.zoom;

      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.node.id === node.id;
      const isActive = node._isActive;

      const color = isActive
        ? node.bias === 'ATOM'
          ? '#EF4444'
          : node.bias === 'ATOMONE'
          ? '#0EA5E9'
          : '#A855F7'
        : '#94a3b8';

      ctx.beginPath();
      ctx.arc(baseX, baseY, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 0.95 : isActive ? 0.7 : 0.35;
      ctx.shadowBlur = isSelected ? 12 : 0;
      ctx.shadowColor = isSelected ? 'rgba(255, 235, 59, 0.6)' : 'transparent';
      ctx.fill();

      if (isHovered || isSelected) {
        ctx.lineWidth = 2 / view.zoom;
        ctx.strokeStyle = isSelected ? '#FACC15' : 'rgba(255,255,255,0.8)';
        ctx.stroke();
      }

      if (isSelected && node.displacement && node.displacement > 1) {
        const targetX = node.targetX ?? baseX;
        const targetY = node.targetY ?? baseY;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(baseX, baseY);
        ctx.lineWidth = 1 / view.zoom;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.setLineDash([4 / view.zoom, 4 / view.zoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(targetX, targetY, radius * 0.65, 0, Math.PI * 2);
        ctx.lineWidth = 1 / view.zoom;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });

    ctx.restore();
  }, [visibleNodes, view, mapSize, selectedNode, hoveredNode]);

  return (
    <div className="h-full glass-card-light dark:glass-card-dark rounded-[32px] p-5 flex flex-col relative" style={{ 
      height: '100%', 
      maxHeight: '100%', 
      borderRadius: '32px', 
      isolation: 'isolate',
      boxShadow: 'none',
      border: '1px solid rgba(200, 215, 232, 0.14)',
    }}>
      <div className="flex items-center justify-between mb-5 flex-shrink-0 relative">
        <div className="flex items-center gap-2">
          <h2 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-white/80 uppercase tracking-[0.3em]">
            Impact Map
          </h2>
          <div className="relative">
            <button
              onClick={() => setShowGuide((prev) => !prev)}
              className="w-6 h-6 flex items-center justify-center bg-white/85 dark:bg-slate-900/80 rounded-full shadow-sm border border-white/60 dark:border-white/20 text-gray-500 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-900 transition"
              aria-label="Impact map guide"
            >
              <HelpCircle size={13} />
            </button>
            {showGuide && (
              <div className="absolute left-0 mt-2 w-60 bg-white/95 dark:bg-slate-900/95 text-[10px] text-gray-600 dark:text-gray-200 rounded-2xl border border-white/60 dark:border-white/20 shadow-xl p-4 z-30">
                <div className="font-bold uppercase tracking-widest text-gray-500 dark:text-gray-300 mb-2">
                  Impact Map Guide
                </div>
                <ul className="space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>X축: Net Flow (← 순매도 | 순매수 →)</li>
                  <li>Y축: ROI (↓ 손실 | 수익 ↑)</li>
                  <li>버블 크기: ATOM↔ATOMONE 거래량 (포화 ≥ {volumeCapLabel})</li>
                  <li>색상: ATOM / ATOMONE / MIXED</li>
                  <li>점선·고스트는 원래 좌표를 나타내며, 겹침 완화를 위한 시각적 보정입니다.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/90 dark:bg-white/10 rounded-full px-4 py-1.5 shadow-sm border border-white/60 dark:border-white/15">
          {[
            { label: 'ATOM', color: '#EF4444' },
            { label: 'ATOMONE', color: '#0EA5E9' },
            { label: 'MIXED', color: '#A855F7' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-100">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
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
        onClick={handleCanvasClick}
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

        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-30">
            <Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
          </div>
        )}

        {!loading && processedNodes.renderableNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-400 dark:text-white/70 z-30">
            <ShieldAlert className="w-10 h-10 mb-2" />
            {apiStatus !== 'live' ? (
              <span className="font-semibold text-center px-8">
                서버에서 데이터를 가져오지 못했습니다. 백엔드(포트 4000)가 실행 중인지 확인해주세요.
              </span>
            ) : (
              <span className="font-semibold">No nodes match filters.</span>
            )}
          </div>
        )}

        <div className="w-full h-full">
          <div className="w-full h-full relative p-4 box-border">
            {/* Grid */}
            <div className="absolute inset-4 grid grid-cols-5 grid-rows-5 pointer-events-none">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`border-gray-200/60 dark:border-[#4ED6E6]/20 ${
                    (i + 1) % 5 !== 0 ? 'border-r' : ''
                  } ${i < 20 ? 'border-b' : ''}`}
                ></div>
              ))}
            </div>


            {/* Canvas 기반 버블 렌더링 */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

            {/* Hover label */}
            {hoveredNode && (
              <div
                className="absolute pointer-events-none bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg"
                style={{
                  left: hoveredNode.x + 10,
                  top: hoveredNode.y - 20,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                {hoveredNode.node.name}
              </div>
            )}
          </div>
        </div>
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

export default ImpactMap;
