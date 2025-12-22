import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeData, SwapProfileBucket } from '../types';
import {
  Activity,
  TrendingUp,
  BarChart2,
  Info,
  CheckCircle,
  PlusCircle,
  Replace,
  Copy,
  Clock,
  ChevronDown,
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  YAxis,
  ReferenceLine,
} from 'recharts';

interface NodeIntelligenceProps {
  selectedNode: NodeData | null;
  slots: { id: string; node: NodeData | null; weight: number; color: string }[];
  setSlots: React.Dispatch<
    React.SetStateAction<{ id: string; node: NodeData | null; weight: number; color: string }[]>
  >;
  isLoadingDetail?: boolean;
  isFallbackDetail?: boolean;
  onSlotFeedback?: (message: string) => void;
}

const formatCompactNumber = (value: number | undefined | null, digits = 1) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toFixed(digits);
};

const formatPercent = (value: number | undefined | null, digits = 1) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(digits)}%`;
};

const formatDate = (isoString: string | undefined) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
};

const truncateAddress = (addr: string | undefined, fallback: string) => {
  const source = addr || fallback;
  if (!source) return 'N/A';
  if (source.length <= 10) return source;
  return `${source.slice(0, 6)}...${source.slice(-4)}`;
};

const getPercentile = (values: number[], percentile: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(((percentile / 100) * (sorted.length - 1)));
  return sorted[index] ?? sorted[sorted.length - 1];
};

const swapCategoryMeta = {
  cross: {
    label: 'Cross (ATOM↔ATOMONE)',
    color: '#F97316',
    description: '단일 스왑에서 ATOM과 ATOMONE이 함께 등장하는 교차 거래',
  },
  atom: {
    label: 'ATOM 중심 Swap',
    color: '#EF4444',
    description: 'ATOM은 포함, ATOMONE은 제외된 편향 스왑',
  },
  atone: {
    label: 'ATOMONE 중심 Swap',
    color: '#0EA5E9',
    description: 'ATOMONE은 포함, ATOM은 제외된 편향 스왑',
  },
  other: {
    label: 'Others',
    color: '#94A3B8',
    description: 'ATOM/ATOMONE이 모두 없는 기타 경로(Stable, Alt 간 이동)',
  },
} as const;

type SwapCategoryKey = keyof typeof swapCategoryMeta;

const emptyBucket = (): SwapProfileBucket => ({
  share: 0,
  count: 0,
  volume: 0,
  samples: [],
});

const buildFallbackSwapProfile = (composition?: NodeData['composition']) => {
  const swap = composition?.swap ?? 0;
  const ibc = composition?.ibc ?? 0;
  const stake = composition?.stake ?? 0;
  const other = Math.max(0, 100 - (swap + ibc + stake));
  return {
    cross: { ...emptyBucket(), share: ibc },
    atom: { ...emptyBucket(), share: swap },
    atone: { ...emptyBucket(), share: stake },
    other: { ...emptyBucket(), share: other },
  };
};

const ensureSwapProfile = (
  profile?: NodeData['swapProfile'],
  composition?: NodeData['composition'],
) => profile || buildFallbackSwapProfile(composition);

const formatLagLabel = (raw: number | null | undefined) => {
  if (raw === null || raw === undefined) return 'N/A';
  if (!Number.isFinite(raw)) return 'N/A';
  const value = Number(raw);
  return `${value > 0 ? '+' : ''}${value}d`;
};

const describeLagBehavior = (lag: number | null | undefined) => {
  if (lag === null || lag === undefined || !Number.isFinite(lag)) {
    return '충분한 샘플이 없어 선행/후행 패턴을 확정하기 어렵습니다.';
  }
  if (lag <= -2) {
    return `가격보다 ${Math.abs(lag)}일 앞서 움직이는 선행 신호가 포착되었습니다.`;
  }
  if (lag >= 2) {
    return `가격보다 ${lag}일 늦게 반응하는 후행 패턴이 강합니다.`;
  }
  return '가격과 거의 동시에 움직이는 동행 흐름입니다.';
};

const NodeIntelligence: React.FC<NodeIntelligenceProps> = ({
  selectedNode,
  slots,
  setSlots,
  isLoadingDetail = false,
  isFallbackDetail = false,
  onSlotFeedback,
}) => {
  const [animationKey, setAnimationKey] = useState(0);
  const [addressCopied, setAddressCopied] = useState(false);
  const prevNodeId = useRef<string | null>(null);
  const priceSectionRef = useRef<HTMLDivElement>(null);
  const swapSectionRef = useRef<HTMLDivElement>(null);
  const swapChartRef = useRef<HTMLDivElement>(null);
  const impactSectionRef = useRef<HTMLDivElement>(null);
  const assignSectionRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState({
    swap: false,
    impact: false,
    timing: false,
  });
  const [isSwapTooltipActive, setIsSwapTooltipActive] = useState(false);

  useEffect(() => {
    if (selectedNode && selectedNode.id !== prevNodeId.current) {
      setAnimationKey((prev) => prev + 1);
      prevNodeId.current = selectedNode.id;
    }
  }, [selectedNode]);

  const swapProfile = useMemo(
    () => ensureSwapProfile(selectedNode?.swapProfile, selectedNode?.composition),
    [selectedNode?.swapProfile, selectedNode?.composition],
  );

  const swapBuckets = useMemo(() => {
    return (Object.keys(swapCategoryMeta) as SwapCategoryKey[]).map((key) => {
      const bucket = swapProfile[key];
      return {
        key,
        ...swapCategoryMeta[key],
        share: Number(bucket?.share ?? 0),
        count: bucket?.count ?? 0,
        volume: bucket?.volume ?? 0,
        samples: bucket?.samples ?? [],
      };
    });
  }, [swapProfile]);


  const handleAssignToSlot = (slotId: string) => {
    if (!selectedNode) return;
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    if (isLoadingDetail) {
      onSlotFeedback?.(
        `Slot ${slotId}: 계정 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.`
      );
      return;
    }

    const previousNodeName = slot.node?.name;

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              node: selectedNode,
            }
          : s,
      ),
    );

    const feedbackMessage = previousNodeName
      ? `Slot ${slotId}: ${previousNodeName} → ${selectedNode.name} 로 교체되었습니다.`
      : `Slot ${slotId}: ${selectedNode.name} 배치 완료.`;

    onSlotFeedback?.(feedbackMessage);
  };

  const handleCopyAddress = async () => {
    if (!selectedNode?.address && !selectedNode?.id) return;
    try {
      await navigator.clipboard.writeText(selectedNode.address || selectedNode.id);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    } catch (error) {
      console.error('Clipboard copy failed', error);
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const processedHistory = useMemo(() => {
    if (!selectedNode?.history?.length) {
      return {
        data: [],
        flowCapLabel: '0',
        flowCapValue: 0,
        priceStats: { min: null, max: null },
      };
    }
    const raw = [...selectedNode.history].sort((a, b) => (a.date < b.date ? -1 : 1));
    const priceValues = raw
      .map((entry) => {
        const price =
          entry.priceUnified ?? entry.price ?? entry.priceAtom ?? entry.priceAtone ?? null;
        return Number.isFinite(price as number) ? Number(price) : null;
      })
      .filter((value) => value !== null) as number[];

    const priceMin = priceValues.length ? Math.min(...priceValues) : null;
    const priceMax = priceValues.length ? Math.max(...priceValues) : null;
    const pricePadding =
      priceMin !== null && priceMax !== null ? Math.max(0.01, (priceMax - priceMin) * 0.05) : 1;

    const netFlows = raw.map((d) => Math.abs(d.netFlow || 0)).filter((v) => Number.isFinite(v));
    const flowCap = netFlows.length
      ? Math.max(getPercentile(netFlows as number[], 95), netFlows[netFlows.length - 1] || 0)
      : 0;
    const safeCap = flowCap || 1;

    const data = raw.map((entry) => {
      const priceValue =
        entry.priceUnified ??
        entry.price ??
        entry.priceAtom ??
        entry.priceAtone ??
        (priceMin ?? 0);
      const displayNetFlow = Math.max(-safeCap, Math.min(safeCap, entry.netFlow || 0));
      return {
        ...entry,
        priceValue: Number.isFinite(priceValue) ? Number(priceValue) : null,
        displayNetFlow,
      };
    });

    return {
      data,
      flowCapLabel: formatCompactNumber(safeCap, 1),
      flowCapValue: safeCap,
      priceStats: {
        min: priceMin !== null ? priceMin - pricePadding : 0,
        max: priceMax !== null ? priceMax + pricePadding : 1,
      },
    };
  }, [selectedNode?.history]);

  const reliability = useMemo(() => {
    if (!selectedNode) {
      return {
        score: 0,
        status: '정보 부족',
        activeDays: 0,
        txCount: 0,
        validPoints: 0,
        coverageRatio: 0,
        showWarning: false,
      };
    }

    const history = selectedNode.history ?? [];
    const activeDays = selectedNode.activeDays ?? 0;
    const txCount = selectedNode.txCount ?? 0;
    const validPoints = history.filter((entry) => Math.abs(entry.netFlow ?? 0) > 0).length;
    const totalDaysInRange = history.length || activeDays || 1;
    const coverageRatio = totalDaysInRange > 0 ? validPoints / totalDaysInRange : 0;

    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const A = clamp(activeDays / 10);
    const T = clamp(txCount / 50);
    const V = clamp(validPoints / 10);
    const C = clamp(coverageRatio / 0.6);
    const score = Math.round(100 * (0.3 * A + 0.25 * T + 0.3 * V + 0.15 * C));
    const status = score >= 70 ? '충분' : score >= 40 ? '보통' : '부족';

    return {
      score,
      status,
      activeDays,
      txCount,
      validPoints,
      coverageRatio,
      showWarning: score < 40,
    };
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div
        className="h-full bg-white/80 dark:bg-white/6 backdrop-blur-2xl rounded-[32px] p-6 flex flex-col items-center justify-center text-center"
        style={{
          boxShadow: 'none',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-gray-100 dark:border-[#4ED6E6]/20">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-white/10 dark:to-white/5" />
        </div>
        <h3 className="text-xs font-bold text-gray-400 dark:text-white/80 uppercase tracking-[0.2em]">분석할 계정을 선택하세요</h3>
        <p className="text-[10px] text-gray-400 dark:text-white/70 mt-2">중앙 버블을 클릭하면 상세 인텔리전스를 확인할 수 있습니다.</p>
      </div>
    );
  }

  const flowCorrelationPct =
    selectedNode.flowCorrelationScore ??
    Math.round(Math.abs(selectedNode.correlationScore ?? 0) * 100);
  const kpiCards = [
    {
      label: 'ROI',
      value: `${selectedNode.roi !== undefined ? selectedNode.roi.toFixed(2) : 'N/A'}%`,
      sub: '기간 ROI',
    },
    {
      label: 'Net Flow Ratio',
      value: `${selectedNode.netBuyRatio >= 0 ? '+' : ''}${selectedNode.netBuyRatio.toFixed(2)}`,
      sub: 'Behavior 기준',
    },
    {
      label: 'Cross Volume',
      value: `${formatCompactNumber(selectedNode.crossVolume ?? selectedNode.totalVolume, 2)}`,
      sub: 'ATOM↔ATOMONE',
    },
  ];

  const donutData = swapBuckets.filter((bucket) => bucket.share > 0.2 || bucket.count > 0);
  const donutDisplayData = donutData.length ? donutData : swapBuckets;
  const dominantCategory =
    donutData.reduce(
      (prev, current) => (current.share > prev.share ? current : prev),
      donutData[0] || swapBuckets[0],
    ) || swapBuckets[0];

  const sampleRoutes = dominantCategory?.samples?.slice(0, 3) ?? [];

  const breakdownMetrics = [
    { label: 'Scale Score', value: Math.round(selectedNode.scaleScore), color: '#5A7FFF' },
    {
      label: 'Share Score',
      value: Math.round(
        Math.max(0, Math.min(100, selectedNode.shareScore ?? (selectedNode.marketSharePct ?? 0) * 100)),
      ),
      color: '#34D399',
    },
    { label: 'Timing Score', value: Math.round(selectedNode.timingScore), color: '#C084FC' },
    { label: 'Flow Corr', value: flowCorrelationPct, color: '#F97316' },
  ];

  const timingDetail = selectedNode.timingDetail;
  const unifiedLag = timingDetail?.bestLagUnified ?? null;
  const timingNarrative = describeLagBehavior(unifiedLag);
  const atomWeight = Math.round((timingDetail?.weightAtom ?? 0.5) * 100);
  const atoneWeight = Math.round((timingDetail?.weightAtone ?? 0.5) * 100);

  const biasBadgeClass =
    selectedNode.bias === 'ATOM'
      ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-100 dark:border-red-500/30'
      : selectedNode.bias === 'ATOMONE'
      ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-100 dark:border-sky-500/30'
      : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-500/30';

  const correlationLabel =
    selectedNode.correlationScore > 0.3
      ? 'Strong +'
      : selectedNode.correlationScore < -0.3
      ? 'Strong -'
      : 'Neutral';

  const chartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0].payload;
    const flowColor = entry.netFlow >= 0 ? 'text-rose-500' : 'text-sky-500';
    return (
      <div className="text-[10px] font-semibold bg-white/90 dark:bg-slate-900/80 border border-white/40 dark:border-white/10 rounded-lg p-2 shadow-lg space-y-1">
        <div className="text-gray-500 dark:text-gray-400">{entry.date}</div>
        <div className="text-gray-900 dark:text-white">
          Price: {entry.priceValue ? entry.priceValue.toFixed(3) : 'N/A'}
        </div>
        <div className={flowColor}>
          Net Flow: {formatCompactNumber(entry.netFlow, 2)}
        </div>
        <div className="text-gray-500 dark:text-gray-400">Tx Count: {entry.txCount ?? 0}</div>
      </div>
    );
  };


  return (
    <div
      key={animationKey}
      className="h-full glass-card-light dark:glass-card-dark rounded-[32px] flex flex-col relative overflow-hidden"
      style={{
        borderRadius: '32px',
        isolation: 'isolate',
        boxShadow: 'none',
        border: '1px solid rgba(200, 215, 232, 0.14)',
      }}
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div
          className="px-6 py-5 border-b border-white/20 dark:border-[#4ED6E6]/20 space-y-4"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-white/70 uppercase tracking-[0.3em]">Node Address</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-gray-800 dark:text-gray-200">
                  {truncateAddress(selectedNode.address, selectedNode.id)}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 dark:border-white/20 text-gray-500 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-white/10 transition"
                >
                  <Copy size={12} />
                  {addressCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className={`text-[10px] font-bold px-3 py-1 rounded-full border ${biasBadgeClass}`}>{selectedNode.bias}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-white/70 uppercase tracking-[0.25em]">AII Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white">{Math.round(selectedNode.size)}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {kpiCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3"
              >
                <div className="text-[9px] uppercase text-gray-400 dark:text-gray-500 font-bold">{card.label}</div>
                <div className="text-xl font-black text-gray-900 dark:text-white mt-1">{card.value}</div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{card.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 dark:text-gray-300">
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-gray-400 dark:text-gray-500" />
              <span>Active {selectedNode.activeDays ?? 0}일</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-gray-400 dark:text-gray-500" />
              <span>Last {formatDate(selectedNode.lastActiveDate)}</span>
            </div>
          {isFallbackDetail && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <Info size={12} />
              <span>기간 데이터 없음 → 기본 기간 표시</span>
            </div>
          )}
          {isLoadingDetail && (
            <div className="flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
              <Info size={12} />
              데이터 집계를 새로 계산하는 중입니다.
            </div>
          )}
        </div>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-5">
          {/* Price vs Net Flow */}
          <div className="space-y-3" ref={priceSectionRef}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Price vs Net Flow</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">선택한 노드의 일자별 흐름</p>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-1 rounded">
                <TrendingUp size={12} className="text-gray-400 dark:text-gray-300" />
              </div>
            </div>
            <div className="h-48 rounded-2xl p-4 relative overflow-hidden glass-input border border-gray-100 dark:border-white/10">
              {!processedHistory.data.length ? (
                <div className="h-full flex items-center justify-center text-[11px] text-gray-400 dark:text-gray-500">시계열 데이터를 계산하는 중입니다.</div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/40 dark:to-black/20 pointer-events-none" />
                  <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={processedHistory.data}>
                    <XAxis dataKey="date" hide />
                    <YAxis
                      yAxisId="price"
                      hide
                      domain={
                        processedHistory.priceStats.min !== null &&
                        processedHistory.priceStats.max !== null
                          ? [processedHistory.priceStats.min, processedHistory.priceStats.max]
                          : ['auto', 'auto']
                      }
                    />
                    <YAxis
                      yAxisId="flow"
                      hide
                      domain={[-processedHistory.flowCapValue, processedHistory.flowCapValue]}
                    />
                    <ReferenceLine yAxisId="flow" y={0} stroke="rgba(148, 163, 184, 0.5)" strokeDasharray="4 4" />
                    <Tooltip content={chartTooltip} />
                    <Bar yAxisId="flow" dataKey="displayNetFlow" barSize={8} radius={[3, 3, 0, 0]}>
                      {processedHistory.data.map((entry, index) => (
                        <Cell key={`flow-${index}`} fill={entry.netFlow >= 0 ? '#EF4444' : '#0EA5E9'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="priceValue"
                      stroke="#111827"
                      strokeWidth={1.75}
                      dot={false}
                      opacity={0.9}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
            {processedHistory.data.length > 0 && (
              <p className="text-[9px] text-gray-500 dark:text-gray-500">
                Price 라인은 시장 기준 가격 변화를, Net Flow 막대는 ±{processedHistory.flowCapLabel} 범위의 순유입을 나타냅니다.
              </p>
            )}
          </div>

          {/* Swap Profile */}
          <div ref={swapSectionRef}>
            <button
              type="button"
              onClick={() => toggleSection('swap')}
              className="w-full flex items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
            >
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Swap Profile & Mobility</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">교차 스왑 비중과 대표 경로</p>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Activity size={14} />
                <ChevronDown
                  size={14}
                  className={`transition-transform ${openSections.swap ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {openSections.swap && (
              <div className="mt-4 rounded-2xl border border-gray-100 dark:border-[#4ED6E6]/20 bg-gray-50 dark:bg-white/5 p-4 space-y-4">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-32 h-32 relative mx-auto" ref={swapChartRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutDisplayData}
                          innerRadius={40}
                          outerRadius={56}
                          paddingAngle={4}
                          cornerRadius={4}
                          dataKey="share"
                          stroke="none"
                        >
                          {donutDisplayData.map((entry: any) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip wrapperStyle={{ display: 'none' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-lg font-black text-gray-900 dark:text-white">
                        {dominantCategory?.share?.toFixed(1) ?? 0}%
                      </span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-semibold text-center px-2">
                        {dominantCategory?.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 text-[11px] text-gray-600 dark:text-gray-300 space-y-2">
                    {swapBuckets.map((bucket) => (
                      <div key={bucket.key} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bucket.color }}></span>
                          {bucket.label}
                        </span>
                        <span>{bucket.share.toFixed(1)}% · {bucket.count} tx</span>
                      </div>
                    ))}
                  </div>
                </div>
                {sampleRoutes.length ? (
                  <div className="text-[11px] text-gray-600 dark:text-gray-300 space-y-1">
                    <p className="font-semibold text-gray-800 dark:text-white">대표 경로</p>
                    <ul className="space-y-1">
                      {sampleRoutes.map((route, idx) => (
                        <li key={`${route}-${idx}`}>• {route}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">샘플 경로를 수집할 만큼 데이터가 충분하지 않습니다.</p>
                )}
              </div>
            )}
          </div>

          {/* Impact Mechanics */}
          <div ref={impactSectionRef}>
            <button
              type="button"
              onClick={() => toggleSection('impact')}
              className="w-full flex items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
            >
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Impact Mechanics</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">Scale · Share · Timing · Corr</p>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <BarChart2 size={14} />
                <ChevronDown
                  size={14}
                  className={`transition-transform ${openSections.impact ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {openSections.impact && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {breakdownMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">{metric.label}</div>
                      <div className="text-xl font-black text-gray-900 dark:text-white">{metric.value}</div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 mt-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, metric.value))}%`,
                            backgroundColor: metric.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Scale은 교차 거래 규모, Share는 시장 지분, Timing은 best lag 기반, Flow Corr은 순유입과 가격의 결합 강도를 의미합니다.
                </p>
              </div>
            )}
          </div>

          {/* Timing Detail */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('timing')}
              className="w-full flex items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
            >
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Timing / Correlation Detail</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">선행·동행·후행 근거와 상관</p>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <TrendingUp size={14} />
                <ChevronDown
                  size={14}
                  className={`transition-transform ${openSections.timing ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {openSections.timing && (
              <div className="mt-4 space-y-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-[9px] uppercase text-gray-400 dark:text-gray-500 font-bold">Unified Timing</p>
                    <div className="text-lg font-black text-gray-900 dark:text-white">{selectedNode.timing}</div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{timingNarrative}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase font-semibold">best lag</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">{formatLagLabel(unifiedLag)}</p>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500">음수=선행 · 양수=후행</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  {[
                    {
                      label: 'ATOM',
                      lag: timingDetail?.bestLagAtom,
                      weight: atomWeight,
                      corr: timingDetail?.correlationAtom,
                      samples: timingDetail?.sampleSizeAtom,
                    },
                    {
                      label: 'ATOMONE',
                      lag: timingDetail?.bestLagAtone,
                      weight: atoneWeight,
                      corr: timingDetail?.correlationAtone,
                      samples: timingDetail?.sampleSizeAtone,
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3 space-y-1">
                      <div className="flex items-center justify-between font-semibold text-gray-500 dark:text-gray-300">
                        <span>{item.label}</span>
                        <span>{item.weight}%</span>
                      </div>
                      <div className="text-sm font-black text-gray-900 dark:text-white">{formatLagLabel(item.lag)}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        Corr:{' '}
                        {item.corr !== null && item.corr !== undefined && Number.isFinite(item.corr)
                          ? `${item.corr > 0 ? '+' : ''}${item.corr.toFixed(2)}`
                          : 'N/A'}{' '}
                        · 샘플 {item.samples ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  Flow Correlation Strength: <span className="font-semibold text-gray-700 dark:text-gray-200">{correlationLabel}</span>
                </div>
                <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-widest">Reliability</p>
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {reliability.score}
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500"> /100</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                        reliability.status === '충분'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : reliability.status === '보통'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200'
                      }`}
                    >
                      {reliability.status}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 dark:bg-sky-400"
                      style={{ width: `${Math.min(100, Math.max(0, reliability.score))}%` }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 dark:text-gray-300">
                    <div className="flex items-center justify-between">
                      <span>Active Days</span>
                      <span className="font-semibold">{reliability.activeDays}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tx Count</span>
                      <span className="font-semibold">{reliability.txCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Valid Points</span>
                      <span className="font-semibold">{reliability.validPoints}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Coverage</span>
                      <span className="font-semibold">{(reliability.coverageRatio * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {reliability.showWarning && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      표본이 적어 타이밍/상관 지표는 참고용입니다.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Assign to Simulation */}
      <div
        ref={assignSectionRef}
        className="px-6 py-5 border-t border-white/20 dark:border-[#4ED6E6]/20 flex-shrink-0 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottomLeftRadius: '32px',
          borderBottomRightRadius: '32px',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Assign to Simulation</p>
            <p className="text-[9px] text-gray-400 dark:text-gray-500">Slot을 선택하면 하단 백테스트 구성에 즉시 반영됩니다.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const isOccupied = !!slot.node;
            const isCurrentNodeInSlot = isOccupied && slot.node!.id === selectedNode.id;

            let buttonText = `Slot ${slot.id}`;
            let ButtonIcon = PlusCircle;
            let buttonClass =
              'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/70 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 border-gray-100 dark:border-[#4ED6E6]/20';

            if (isCurrentNodeInSlot) {
              buttonText = 'Assigned';
              ButtonIcon = CheckCircle;
              buttonClass =
                'bg-[#5A7FFF]/10 dark:bg-[#5A7FFF]/15 text-[#5A7FFF] dark:text-[#5A7FFF] border-[#5A7FFF]/20 dark:border-[#5A7FFF]/30';
            } else if (isOccupied) {
              buttonText = 'Replace';
              ButtonIcon = Replace;
              buttonClass =
                'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border-amber-100 dark:border-amber-500/20';
            }

            return (
              <button
                key={slot.id}
                onClick={() => handleAssignToSlot(slot.id)}
                disabled={isCurrentNodeInSlot}
                className={`w-full p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-200 transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${buttonClass}`}
              >
                <ButtonIcon size={14} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{buttonText}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NodeIntelligence;
