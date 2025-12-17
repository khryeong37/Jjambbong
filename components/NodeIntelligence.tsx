import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeData, SwapProfileBucket } from '../types';
import {
  Activity,
  Sparkles,
  TrendingUp,
  BarChart2,
  Info,
  CheckCircle,
  PlusCircle,
  Replace,
  Copy,
  Clock,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
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
}) => {
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [addressCopied, setAddressCopied] = useState(false);
  const [slotFeedback, setSlotFeedback] = useState<string | null>(null);
  const prevNodeId = useRef<string | null>(null);
  const feedbackTimer = useRef<number>();
  const priceSectionRef = useRef<HTMLDivElement>(null);
  const swapSectionRef = useRef<HTMLDivElement>(null);
  const impactSectionRef = useRef<HTMLDivElement>(null);
  const assignSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        window.clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (!selectedNode) {
      setSummary('');
      return;
    }

    const generateSummary = async () => {
      setLoadingSummary(true);
      if (import.meta.env?.VITE_GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
          const prompt = `Analyze crypto account "${selectedNode.name}".
          Impact Score ${Math.floor(selectedNode.size)}/100, Bias: ${selectedNode.bias}.
          Transaction breakdown: ${selectedNode.composition.swap}% Swap, ${selectedNode.composition.ibc}% IBC, ${selectedNode.composition.stake}% Stake.
          Net Flow Ratio ${selectedNode.netBuyRatio?.toFixed(2)}, ROI ${selectedNode.roi ?? 0}%.
          Provide a concise two-sentence insight highlighting timing (${selectedNode.timing}) and correlation (${selectedNode.correlationScore?.toFixed(
            2,
          )}).`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          setSummary(response.text || 'Analysis unavailable.');
        } catch (error) {
          console.error(error);
          setSummary('AI Analysis unavailable (Check API Key).');
        }
      } else {
        const impactLevel = selectedNode.size >= 70 ? 'high' : selectedNode.size >= 40 ? 'moderate' : 'emerging';
        const strategyType =
          selectedNode.composition.swap > 50
            ? 'active trading'
            : selectedNode.composition.stake > 40
            ? 'staking-focused'
            : 'balanced';
        const timingDesc =
          selectedNode.timing === 'LEADING'
            ? 'tends to lead price moves'
            : selectedNode.timing === 'LAGGING'
            ? 'usually reacts after trends form'
            : 'moves with the market';

        setSummary(
          `This ${impactLevel}-impact account (AII ${Math.floor(
            selectedNode.size,
          )}) pursues ${strategyType} with ${selectedNode.netBuyRatio > 0 ? 'accumulation' : 'distribution'} bias. It ${timingDesc} and shows correlation ${selectedNode.correlationScore?.toFixed(
            2,
          )}, indicating ${selectedNode.bias} ecosystem strength.`,
        );
      }
      setLoadingSummary(false);
    };

    generateSummary();
  }, [selectedNode]);

  const handleAssignToSlot = (slotId: string) => {
    if (!selectedNode) return;
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

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

    setSlotFeedback(feedbackMessage);
    if (feedbackTimer.current) {
      window.clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => setSlotFeedback(null), 2800);
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

  const scrollToSection = (ref?: React.RefObject<HTMLDivElement>) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }
  };

  const processedHistory = useMemo(() => {
    if (!selectedNode?.history?.length) {
      return { data: [], flowCapLabel: '0', flowCapValue: 0 };
    }
    const raw = [...selectedNode.history].sort((a, b) => (a.date < b.date ? -1 : 1));
    const priceBase =
      raw
        .map((entry) => entry.priceUnified ?? entry.price ?? null)
        .find((value) => Number.isFinite(value as number)) ?? 0;
    const safeBase = Number(priceBase) !== 0 ? Number(priceBase) : 1;
    const netFlows = raw
      .map((d) => Math.abs(d.netFlow || 0))
      .filter((v) => Number.isFinite(v));
    const flowCap = netFlows.length
      ? Math.max(getPercentile(netFlows as number[], 95), netFlows[netFlows.length - 1] || 0)
      : 0;
    const safeCap = flowCap || 1;

    const data = raw.map((entry) => {
      const referencePrice = entry.priceUnified ?? entry.price ?? null;
      const priceIndex = Number.isFinite(referencePrice)
        ? ((Number(referencePrice) || safeBase) / safeBase) * 100
        : null;
      const displayNetFlow = Math.max(-safeCap, Math.min(safeCap, entry.netFlow || 0));
      return {
        ...entry,
        priceIndex,
        displayNetFlow,
      };
    });

    return { data, flowCapLabel: formatCompactNumber(safeCap, 1), flowCapValue: safeCap };
  }, [selectedNode?.history]);

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
  const kpiCards: {
    label: string;
    value: string;
    sub: string;
    tooltip: string;
    ref?: React.RefObject<HTMLDivElement>;
  }[] = [
    {
      label: 'AII Score',
      value: `${Math.round(selectedNode.size)}`,
      sub: 'Unified Impact (0-100)',
      tooltip: 'Scale/Share/Timing/Corr를 가중 합산한 종합 점수입니다.',
      ref: impactSectionRef,
    },
    {
      label: 'ROI',
      value: `${selectedNode.roi !== undefined ? selectedNode.roi.toFixed(2) : 'N/A'}%`,
      sub: '필터 기간 내 순수익률',
      tooltip: '좌측 기간과 동일한 범위에서 계산된 순매수 수익률입니다.',
      ref: assignSectionRef,
    },
    {
      label: 'Net Flow Ratio',
      value: `${selectedNode.netBuyRatio >= 0 ? '+' : ''}${selectedNode.netBuyRatio.toFixed(2)}`,
      sub: 'Behavior 코인 토글 기준',
      tooltip: '순매수 대비 순매도의 비율 ( -1 ~ +1 )',
      ref: priceSectionRef,
    },
    {
      label: 'Cross Volume',
      value: `${formatCompactNumber(selectedNode.crossVolume ?? selectedNode.totalVolume, 2)}`,
      sub: 'ATOM↔ATOMONE 거래량',
      tooltip: '두 코인이 함께 등장한 교차 스왑의 누적 체결 규모입니다.',
      ref: swapSectionRef,
    },
  ];

  const activityCards = [
    {
      label: 'Active Days',
      value: `${selectedNode.activeDays ?? 0}일`,
    },
    {
      label: 'Last Active',
      value: formatDate(selectedNode.lastActiveDate),
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

  const shareBreakdown = [
    { label: 'ATOM Volume Share', value: formatPercent(selectedNode.atomVolumeShare, 1), color: '#EF4444' },
    { label: 'ATOMONE Volume Share', value: formatPercent(selectedNode.oneVolumeShare, 1), color: '#0EA5E9' },
    {
      label: 'Market Share',
      value:
        selectedNode.marketSharePct !== undefined && selectedNode.marketSharePct !== null
          ? `${(selectedNode.marketSharePct * 100).toFixed(2)}%`
          : 'N/A',
      color: '#10B981',
    },
    { label: 'Avg Trade Size', value: `${formatCompactNumber(selectedNode.avgTradeSize, 2)} units`, color: '#F97316' },
  ];

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
        <div className="text-gray-900 dark:text-white">Price Index: {entry.priceIndex ? entry.priceIndex.toFixed(1) : 'N/A'}</div>
        <div className={flowColor}>
          Net Flow: {formatCompactNumber(entry.netFlow, 2)}
        </div>
        <div className="text-gray-500 dark:text-gray-400">Tx Count: {entry.txCount ?? 0}</div>
      </div>
    );
  };

  const swapProfileTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0].payload;
    return (
      <div className="text-[10px] space-y-1 bg-white/90 dark:bg-slate-900/85 border border-white/40 dark:border-white/10 rounded-lg p-3 shadow-lg max-w-[220px]">
        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          ></span>
          {entry.label}
        </div>
        <div className="text-gray-600 dark:text-gray-300">
          {entry.share.toFixed(1)}% · {entry.count} tx
        </div>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{entry.description}</p>
        {entry.samples?.length ? (
          <div className="pt-1 border-t border-dashed border-gray-200 dark:border-white/10">
            <div className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 mb-1">대표 경로</div>
            <ul className="space-y-0.5">
              {entry.samples.map((sample: string, idx: number) => (
                <li key={`${sample}-${idx}`} className="text-gray-600 dark:text-gray-300">
                  • {sample}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
          className="px-6 py-5 border-b border-white/20 dark:border-[#4ED6E6]/20 relative"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <h2 className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-widest mb-2">Node Intelligence</h2>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-black text-gray-900 dark:text-white truncate tracking-tight">{selectedNode.name}</h1>
            <div className={`text-[9px] font-bold px-3 py-1 rounded-full border ${biasBadgeClass}`}>{selectedNode.bias}</div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{truncateAddress(selectedNode.address, selectedNode.id)}</div>
            <button
              onClick={handleCopyAddress}
              className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 dark:border-white/20 text-gray-500 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-white/10 transition"
            >
              <Copy size={12} />
              {addressCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {kpiCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => scrollToSection(card.ref)}
                title={card.tooltip}
                className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-left hover:border-[#5A7FFF]/50 hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5A7FFF]"
              >
                <div className="text-[9px] uppercase text-gray-400 dark:text-gray-500 font-bold">{card.label}</div>
                <div className="text-base font-black text-gray-900 dark:text-white mt-1">{card.value}</div>
                <div className="text-[9px] text-gray-400 dark:text-gray-500">{card.sub}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {activityCards.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-300">
                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                <span className="font-semibold">{item.label}:</span>
                <span className="font-bold text-gray-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-400 dark:text-gray-500 mt-3">
            <Info size={12} />
            모든 지표는 좌측 Time Range와 Behavior 토글을 그대로 따릅니다.
          </div>
          {isFallbackDetail && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
              <Info size={12} />
              필터 범위 데이터를 불러올 수 없어 기본 기간 데이터로 대체했습니다.
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-5">
        {/* Section 1: Price vs Net Flow */}
        <div className="space-y-3" ref={priceSectionRef}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Price vs Net Flow</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">기간 및 코인 맥락은 좌측 필터를 그대로 따릅니다.</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-1 rounded">
              <TrendingUp size={12} className="text-gray-400 dark:text-gray-300" />
            </div>
          </div>
          <div className="h-48 rounded-2xl p-4 relative overflow-hidden glass-input border border-gray-100 dark:border-white/10">
            {!processedHistory.data.length ? (
              <div className="h-full flex items-center justify-center text-[11px] text-gray-400 dark:text-gray-500">시계열 데이터가 부족합니다.</div>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/40 dark:to-black/20 pointer-events-none" />
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={processedHistory.data}>
                    <XAxis dataKey="date" hide />
                    <YAxis yAxisId="left" hide domain={['dataMin', 'dataMax']} />
                    <YAxis yAxisId="right" hide domain={[-processedHistory.flowCapValue, processedHistory.flowCapValue]} />
                    <ReferenceLine yAxisId="right" y={0} stroke="rgba(148, 163, 184, 0.5)" strokeDasharray="4 4" />
                    <Tooltip content={chartTooltip} />
                    <Bar yAxisId="right" dataKey="displayNetFlow" barSize={8} radius={[3, 3, 0, 0]}>
                      {processedHistory.data.map((entry, index) => (
                        <Cell key={`flow-${index}`} fill={entry.netFlow >= 0 ? '#EF4444' : '#0EA5E9'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                    <Line yAxisId="left" type="monotone" dataKey="priceIndex" stroke="#475569" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
          <p className="text-[9px] text-gray-500 dark:text-gray-500 leading-relaxed">
            Price 라인은 기간 시작점을 100으로 리베이스한 지수입니다. Net Flow 막대는 ±{processedHistory.flowCapLabel} 구간으로 표시되며, 툴팁에는 클리핑 전 실제 값이 그대로 표기됩니다.
          </p>
        </div>

        {/* Section 2: Swap Profile */}
        <div className="space-y-4" ref={swapSectionRef}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Swap Profile & Mobility</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">ATOM/ATOMONE 교차와 편향, 대표 경로를 요약합니다.</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-1 rounded">
              <Activity size={12} className="text-gray-400 dark:text-gray-300" />
            </div>
          </div>
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="flex flex-col lg:flex-row gap-4 bg-gray-50 dark:bg-white/5 rounded-2xl p-4 border border-gray-100 dark:border-[#4ED6E6]/20 flex-1">
                <div className="w-full lg:w-1/2 flex items-center justify-center relative">
                  <div className="w-32 h-32">
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
                        <Tooltip content={swapProfileTooltip} />
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
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-[9px] uppercase text-gray-400 dark:text-gray-500 font-bold">대표 경로</p>
                  {sampleRoutes.length ? (
                    <ul className="space-y-1 text-[11px] text-gray-600 dark:text-gray-200">
                      {sampleRoutes.map((route, idx) => (
                        <li key={`${route}-${idx}`} className="flex items-start gap-2">
                          <span className="mt-0.5 text-[8px] text-gray-400">●</span>
                          <span>{route}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">표본 경로를 수집할 만큼의 데이터가 부족합니다.</p>
                  )}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                {shareBreakdown.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3">
                    <div className="text-[9px] uppercase text-gray-400 dark:text-gray-500 font-bold">{item.label}</div>
                    <div className="text-sm font-black text-gray-900 dark:text-white mt-1">{item.value}</div>
                    <div className="h-1.5 rounded-full mt-2 bg-gray-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: item.value.includes('%') ? item.value : '100%',
                          backgroundColor: item.color,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {swapBuckets.map((bucket) => (
              <div key={bucket.key} className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bucket.color }}></span>
                    {bucket.label}
                  </div>
                  <span>{bucket.share.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, bucket.share)}%`,
                      backgroundColor: bucket.color,
                    }}
                  ></div>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">건수: {bucket.count} tx</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Impact Mechanics */}
        <div className="space-y-4" ref={impactSectionRef}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Impact Mechanics</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">AII 점수를 구성하는 요인과 Timing/Correlation을 분해합니다.</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-1 rounded">
              <BarChart2 size={12} className="text-gray-400 dark:text-gray-300" />
            </div>
          </div>
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
          <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase text-gray-400 dark:text-gray-500 font-bold">Timing Detail (Unified)</p>
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
          </div>
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-500/10 dark:to-slate-900/40 p-[2px]">
            <div className="bg-white/90 dark:bg-slate-950/80 rounded-[18px] p-4 flex gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-xl">
                <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-300 uppercase tracking-widest mb-1">Narrative Insight</p>
                <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  {loadingSummary ? '분석 생성 중...' : summary || 'AI 분석을 불러올 수 없습니다.'}
                </p>
              </div>
            </div>
          </div>
          {isLoadingDetail && (
            <div className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
              <Info size={12} />
              필터 변경으로 데이터를 다시 계산 중입니다.
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
        {slotFeedback && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 bg-emerald-500/90 text-white text-[10px] font-semibold px-3 py-1 rounded-full shadow-lg">
            {slotFeedback}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeIntelligence;
