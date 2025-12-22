import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  NodeData,
  SimulationConfig,
  StrategyMode,
  MarketData,
  SimulationResult,
} from '../types';
import {
  PlayCircle,
  Trash2,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Info,
} from 'lucide-react';
import { calculateSimulation } from '../utils/mockData';
import { computeSlotReturn, normalizeWeights, SlotReturnResult } from '../utils/backtest';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts';

type SlotState = {
  id: string;
  node: NodeData | null;
  weight: number;
  color: string;
};

const SLOT_IDS: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

const NEUTRAL_SLOT_COLOR = {
  solid: '#94A3B8',
  soft: 'rgba(148, 163, 184, 0.18)',
  border: '#475569',
};

const BIAS_COLORS: Record<
  'ATOM' | 'ATOMONE' | 'MIXED',
  { solid: string; soft: string; border: string }
> = {
  ATOM: { solid: '#EF4444', soft: 'rgba(239, 68, 68, 0.15)', border: '#b91c1c' },
  ATOMONE: { solid: '#0EA5E9', soft: 'rgba(14, 165, 233, 0.18)', border: '#0369a1' },
  MIXED: { solid: '#A855F7', soft: 'rgba(168, 85, 247, 0.18)', border: '#7e22ce' },
};

const BASE_DENOM_MAP: Record<'ATOM' | 'ATOMONE', string[]> = {
  ATOM: ['ATOM', 'UATOM', 'IBCUATOM', 'COSMOSHUB'],
  ATOMONE: ['ATOMONE', 'ATONE', 'UATONE'],
};

const FLOW_EPSILON = 1e-6;
const SLOT_REASON_MESSAGES: Record<string, string> = {
  EMPTY_SLOT: '슬롯에 계정을 배치하세요.',
  NO_NODE_HISTORY: '이 계정에는 히스토리가 없습니다.',
  NO_SWAPS_IN_RANGE: '선택한 기간에 활동 기록이 없습니다.',
  NO_ACTIVITY_IN_RANGE: '선택한 기간에 활동 기록이 없습니다.',
  NO_SWAP_COUNT: '스왑 집계가 부족합니다.',
  NO_ATOM_FLOW: 'ATOM 기준 거래가 없습니다.',
  NO_ATOMONE_FLOW: 'ATOMONE 기준 거래가 없습니다.',
  SLOT_COMPUTE_ERROR: '슬롯 계산에 실패했습니다.',
  INVALID_RETURN: '올바른 배율을 계산할 수 없습니다.',
  OK: '',
};

const getBiasColor = (bias?: NodeData['bias']) => {
  if (!bias) return NEUTRAL_SLOT_COLOR;
  return BIAS_COLORS[bias as keyof typeof BIAS_COLORS] || BIAS_COLORS.MIXED;
};

const truncateAddress = (addr?: string) => {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

const normalizeSlotWeights = (slotList: SlotState[]) => {
  const activeSlots = slotList.filter((slot) => slot.node);
  if (!activeSlots.length) {
    return slotList.map((slot) =>
      slot.weight === 0 ? slot : { ...slot, weight: 0 }
    );
  }
  const sum = activeSlots.reduce((total, slot) => total + Math.max(0, slot.weight), 0);
  const normalized = slotList.map((slot) => {
    if (!slot.node) return { ...slot, weight: 0 };
    if (sum === 0) {
      return { ...slot, weight: 100 / activeSlots.length };
    }
    return { ...slot, weight: (Math.max(0, slot.weight) / sum) * 100 };
  });
  let remainder = 100 - normalized.reduce((total, slot) => total + slot.weight, 0);
  for (const slot of normalized) {
    if (!slot.node) continue;
    const adjustment = Math.min(remainder, 0.01);
    slot.weight += adjustment;
    remainder -= adjustment;
    if (Math.abs(remainder) < 0.01) break;
  }
  return normalized.map((slot) => ({
    ...slot,
    weight: Number(Math.max(0, Math.min(100, slot.weight)).toFixed(2)),
  }));
};

const normalizeDateString = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  try {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return value.slice(0, 10);
  } catch {
    return null;
  }
};

const addDaysUTC = (dateOnly: string, days: number) => {
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const buildFallbackHistoryFromSlots = (slots: SlotState[]) => {
  const dateSet = new Set<string>();
  slots.forEach((slot) => {
    slot.node?.history?.forEach((entry) => {
      const normalized = normalizeDateString(entry.date);
      if (normalized) dateSet.add(normalized);
    });
  });
  let sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
  if (!sortedDates.length) {
    const today = new Date();
    const fallback: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      fallback.push(d.toISOString().slice(0, 10));
    }
    sortedDates = fallback;
  }
  return sortedDates.map((date, idx) => ({
    date,
    price: 1 + idx * 0.01,
  }));
};

/**
 * GLSL 3D Simplex Noise (webgl-noise)
 */
const NOISE_GLSL = `
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
{
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

/**
 * NoiseMolecule
 * - World + Molecule 코드를 React + Three.js 컴포넌트로 변환
 */
const NoiseMolecule: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false, // Disabled for better performance
      powerPreference: 'high-performance',
    });
    // Limit pixel ratio to 1 for better performance on high-DPI displays
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(
      container.clientWidth || 112,
      container.clientHeight || 112
    );
    container.appendChild(renderer.domElement);

    class Molecule extends THREE.Object3D {
      material!: THREE.PointsMaterial & { userData: any };
      geometry!: THREE.BufferGeometry;
      mesh!: THREE.Points;
      radius = 1.5;
      detail = 20; // Reduced from 40 for better performance
      particleSizeMin = 0.01;
      particleSizeMax = 0.08;

      constructor() {
        super();
        this.build();
      }

      dot(size = 32, color = '#FFFFFF') {
        const sizeH = size * 0.5;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(canvas);

        const circle = new Path2D();
        circle.arc(sizeH, sizeH, sizeH, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill(circle);

        return new THREE.CanvasTexture(canvas);
      }

      setupShader(material: THREE.PointsMaterial & { userData: any }) {
        material.onBeforeCompile = (shader: any) => {
          shader.uniforms.time = { value: 0 };
          shader.uniforms.radius = { value: this.radius };
          shader.uniforms.particleSizeMin = { value: this.particleSizeMin };
          shader.uniforms.particleSizeMax = { value: this.particleSizeMax };

          shader.vertexShader =
            'uniform float particleSizeMax;\n' + shader.vertexShader;
          shader.vertexShader =
            'uniform float particleSizeMin;\n' + shader.vertexShader;
          shader.vertexShader =
            'uniform float radius;\n' + shader.vertexShader;
          shader.vertexShader =
            'uniform float time;\n' + shader.vertexShader;

          shader.vertexShader = `
${NOISE_GLSL}
${shader.vertexShader}
          `;

          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
              vec3 p = position;
              float n = snoise( vec3( p.x*0.6 + time*0.2, p.y*0.4 + time*0.3, p.z*0.2 + time*0.2 ) );
              p += n * 0.4;
              float l = radius / length(p);
              p *= l;
              float s = mix(particleSizeMin, particleSizeMax, n);
              vec3 transformed = vec3( p.x, p.y, p.z );
            `
          );

          shader.vertexShader = shader.vertexShader.replace(
            'gl_PointSize = size;',
            'gl_PointSize = s;'
          );

          material.userData.shader = shader;
        };
      }

      build() {
        this.geometry = new THREE.IcosahedronGeometry(1, this.detail);

        this.material = new THREE.PointsMaterial({
          map: this.dot(),
          blending: THREE.AdditiveBlending,
          color: 0x101a88,
          depthTest: false,
          transparent: true,
        }) as THREE.PointsMaterial & { userData: any };

        this.setupShader(this.material);

        this.mesh = new THREE.Points(this.geometry, this.material);
        super.add(this.mesh);
      }

      animate(time: number) {
        this.mesh.rotation.set(0, time * 0.2, 0);
        if (this.material.userData.shader) {
          this.material.userData.shader.uniforms.time.value = time;
        }
      }

      dispose() {
        this.geometry.dispose();
        this.material.dispose();
      }
    }

    const molecule = new Molecule();
    scene.add(molecule);

    let animationFrameId: number;
    let lastFrameTime = 0;
    const targetFPS = 30; // Limit to 30 FPS for better performance
    const frameInterval = 1000 / targetFPS;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Throttle to target FPS
      const elapsed = time - lastFrameTime;
      if (elapsed < frameInterval) return;
      lastFrameTime = time - (elapsed % frameInterval);
      
      const t = time * 0.001;
      molecule.animate(t);
      renderer.render(scene, camera);
    };

    animate(0);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 112;
      const h = container.clientHeight || 112;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      scene.remove(molecule);
      molecule.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-full overflow-hidden"
    />
  );
};

interface SimulationEngineProps {
  atomData: MarketData | null;
  oneData: MarketData | null;
  slots: { id: string; node: NodeData | null; weight: number; color: string }[];
  setSlots: React.Dispatch<React.SetStateAction<{ id: string; node: NodeData | null; weight: number; color: string }[]>>;
}

const SimulationEngine: React.FC<SimulationEngineProps> = ({
  atomData,
  oneData,
  slots,
  setSlots,
}) => {
  const isDev = import.meta.env.DEV;
  // Track which slots just received a new node for animation
  const [animatingSlots, setAnimatingSlots] = useState<{ [key: string]: boolean }>({});
  const prevSlotsRef = useRef<{ [key: string]: string | null }>({});
  
  
  // Detect slot changes and trigger animations
  useEffect(() => {
    const newAnimating: { [key: string]: boolean } = {};
    
    slots.forEach((slot) => {
      const prevNodeId = prevSlotsRef.current[slot.id];
      const currentNodeId = slot.node?.id || null;
      
      // If a new node was added (was null or different node)
      if (currentNodeId && currentNodeId !== prevNodeId) {
        newAnimating[slot.id] = true;
      }
    });
    
    // Always update previous slots ref FIRST
    slots.forEach((slot) => {
      prevSlotsRef.current[slot.id] = slot.node?.id || null;
    });
    
    // Update animation state only for changed slots
    if (Object.keys(newAnimating).length > 0) {
      setAnimatingSlots(newAnimating);
      
      // Clear animation after it completes
      const timer = setTimeout(() => {
        setAnimatingSlots({});
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [slots]);
  

  // Config State
  const [capital, setCapital] = useState<number>(100);
  const [asset, setAsset] = useState<'ATOM' | 'ATOMONE'>('ATOM');
  const strategyMode: StrategyMode = 'COPY_TRADING';

  // Slider Handles (0-100%)
  const [h1, setH1] = useState(0);
  const [h2, setH2] = useState(100);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState<'h1' | 'h2' | null>(null);

  // Simulation State
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [visibleSlotLines, setVisibleSlotLines] = useState<
    Record<string, boolean>
  >(() =>
    SLOT_IDS.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const controlsDisabled = isSimulating;
  const totalWeightWithNode = slots.reduce(
    (sum, slot) => sum + (slot.node ? slot.weight : 0),
    0
  );
  const totalAllocated = Math.round(totalWeightWithNode);
  const allocatedCapital =
    capital && totalWeightWithNode > 0
      ? (capital * totalWeightWithNode) / 100
      : 0;
  const hasAllocation = allocatedCapital > 0;
  const weightsAligned = totalAllocated === 100;
  const capitalError =
    capital <= 0
      ? '0 이상의 값을 입력하세요.'
      : capital < 100
      ? '최소 100개 이상의 코인이 필요합니다.'
      : null;
  const capitalWarning =
    capitalError ? null : capital > 1000000 ? '코인의 수가 너무 많습니다.' : null;
  const capitalMessage = capitalError || capitalWarning;
  const [capitalToast, setCapitalToast] = useState<{ message: string; type: 'error' | 'warning' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showCapitalToast = useCallback(
    (message: string, type: 'error' | 'warning') => {
      setCapitalToast({ message, type });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setCapitalToast(null);
        toastTimerRef.current = null;
      }, 2600);
    },
    []
  );
  const currentMarketData = asset === 'ATOM' ? atomData : oneData;
  const fallbackHistory = useMemo(() => buildFallbackHistoryFromSlots(slots), [slots]);
  const fallbackMarketData = useMemo(
    () => ({
      price: 1,
      change24h: 0,
      marketCap: 0,
      volume24h: 0,
      history: fallbackHistory,
    }),
    [fallbackHistory]
  );
  const effectiveMarketData =
    currentMarketData && currentMarketData.history && currentMarketData.history.length > 0
      ? currentMarketData
      : fallbackMarketData;
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!capitalMessage) {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      setCapitalToast(null);
      return;
    }
    showCapitalToast(capitalMessage, capitalError ? 'error' : 'warning');
  }, [capitalMessage, capitalError, capital, showCapitalToast]);
  useEffect(() => {
    setSimulationError(null);
  }, [slots, capital, asset, currentMarketData]);
  const timelineDates = useMemo(() => {
    if (!effectiveMarketData?.history?.length) return null;
    const normalizedDates = effectiveMarketData.history
      .map((h) => normalizeDateString(h.date))
      .filter((d): d is string => Boolean(d));
    const unique = Array.from(new Set(normalizedDates)).sort((a, b) =>
      a.localeCompare(b)
    );
    return unique.length ? unique : null;
  }, [effectiveMarketData]);
  const timelineStart = timelineDates?.[0] ?? null;
  const timelineEndExclusive =
    timelineDates && timelineDates.length
      ? addDaysUTC(timelineDates[timelineDates.length - 1], 1)
      : null;
  const slotHistoryDiagnostics = useMemo(() => {
    const range =
      timelineStart && timelineEndExclusive
        ? { start: timelineStart, endExclusive: timelineEndExclusive }
        : undefined;
    return slots.reduce<Record<string, SlotReturnResult>>((acc, slot) => {
      acc[slot.id] = computeSlotReturn(slot, asset, range);
      return acc;
    }, {});
  }, [slots, asset, timelineStart, timelineEndExclusive]);
  const slotsWithValidData = slots.filter(
    (slot) => slot.weight > 0 && slotHistoryDiagnostics[slot.id]?.status === 'ok'
  );
  const rawWeights = useMemo(() => {
    return slots.reduce<Record<string, number>>((acc, slot) => {
      acc[slot.id] = slot.weight;
      return acc;
    }, {} as Record<string, number>);
  }, [slots]);
  const normalizedWeightFractions = useMemo(
    () => normalizeWeights(slots, slotHistoryDiagnostics),
    [slots, slotHistoryDiagnostics]
  );
  const hasValidSlots = slotsWithValidData.length >= 2;
  const missingHistorySlots = slots.filter(
    (slot) =>
      slot.weight > 0 &&
      slotHistoryDiagnostics[slot.id]?.status !== 'ok'
  );
  const runBlockingReasons: string[] = [];
  if (!hasValidSlots) {
    if (missingHistorySlots.length > 0) {
      missingHistorySlots.forEach((slot) => {
        const reason = slotHistoryDiagnostics[slot.id]?.reason || '데이터 부족';
        const reasonText = SLOT_REASON_MESSAGES[reason] || reason;
        runBlockingReasons.push(`Slot ${slot.id}: ${reasonText}`);
      });
    } else {
      runBlockingReasons.push('유효 데이터 슬롯 2개 필요');
    }
  }
  if (capitalError) {
    runBlockingReasons.push(capitalError);
  } else if (capital < 100) {
    runBlockingReasons.push('초기 코인 100개 이상 필요');
  }
  if (missingHistorySlots.length > 0 && !runBlockingReasons.some((r) => r.includes('Slot'))) {
    runBlockingReasons.push(
      `데이터 없음: ${missingHistorySlots
        .map((slot) => {
          const reason = slotHistoryDiagnostics[slot.id]?.reason || '데이터 부족';
          const reasonText = SLOT_REASON_MESSAGES[reason] || reason;
          return `Slot ${slot.id} (${reasonText})`;
        })
        .join(', ')}`
    );
  }
  const canRun =
    runBlockingReasons.length === 0 &&
    !capitalError &&
    capital >= 100;
  const historyBlockingReasons = runBlockingReasons.filter((reason) =>
    reason.includes('Slot')
  );
  const historyBlocked = !canRun && historyBlockingReasons.length > 0;
  const missingSlotMessages = missingHistorySlots.map((slot) => {
    const reasonKey = slotHistoryDiagnostics[slot.id]?.reason || 'NO_SWAPS_IN_RANGE';
    const reasonText = SLOT_REASON_MESSAGES[reasonKey] || reasonKey;
    return `Slot ${slot.id} – ${reasonText}`;
  });
  useEffect(() => {
    if (!isDev) return;
    console.groupCollapsed(`[Simulation][SlotHistory] baseAsset=${asset}`);
    slots.forEach((slot) => {
      const diag = slotHistoryDiagnostics[slot.id];
      if (!diag) return;
      console.log(`Slot ${slot.id}`, {
        slotId: slot.id,
        rawSwapCountTotal: diag.rawSwapCountTotal,
        rawSwapCountInRange: diag.rawSwapCountInRange,
        baseAssetSwapCount: diag.baseAssetSwapCount,
        baseAssetFlowSum: diag.baseAssetFlowSum,
        firstTxTime: diag.firstTxTime,
        lastTxTime: diag.lastTxTime,
        reason: diag.reason,
        status: diag.status,
      });
    });
    console.groupEnd();
  }, [slotHistoryDiagnostics, asset, isDev, slots]);
  useEffect(() => {
    console.debug('[Simulation CTA]', {
      filledSlotsCount: slots.filter((slot) => slot.node).length,
      validSlotsCount: slotsWithValidData.length,
      invalidSlotsReason: missingHistorySlots.map((slot) => slot.id),
      initialCapital: capital,
      baseAsset: asset,
      rawWeights,
      normalizedWeights: normalizedWeightFractions,
      canRun,
      blockingReasons: runBlockingReasons,
    });
  }, [
    slots,
    slotsWithValidData.length,
    missingHistorySlots,
    capital,
    asset,
    rawWeights,
    normalizedWeightFractions,
    canRun,
    runBlockingReasons,
  ]);

  const chartData = useMemo(
    () =>
      result
        ? result.timeline.map((entry) => {
            const slotValueMap = Object.fromEntries(
              Object.entries(entry.slots).map(([slotId, coins]) => [
                slotId,
                coins,
              ])
            );
            return {
              ...entry,
              ...slotValueMap,
            };
          })
        : [],
    [result]
  );

  const leadingContribution = useMemo(() => {
    if (!result || !result.slotSummaries.length) return null;
    const validSummaries = result.slotSummaries.filter(
      (summary) => summary.status !== 'na'
    );
    if (!validSummaries.length) return null;
    return [...validSummaries].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
    )[0];
  }, [result]);
  const runRequirements = [
    { label: 'Slot 2개 이상 (유효 데이터)', met: hasValidSlots },
    { label: '비중 합계 100%', met: weightsAligned },
    { label: '초기 코인 100개 이상', met: !capitalError },
  ];
  const metricTooltips = {
    pnl: '총 손익 = 최종 코인 수량 - 초기 코인 수량',
    roi: 'ROI = (최종 코인 수량 - 초기 코인 수량) ÷ 초기 코인 수량 × 100%',
    value: 'Final Value = 시뮬레이션 종료 시점의 코인 잔고',
  };
  const timelineLength = result?.timeline.length ?? 0;
  const slotContributionTotal = result
    ? result.slotSummaries.reduce((sum, slot) => sum + slot.contribution, 0)
    : 0;
  const contributionDelta =
    result && timelineLength > 0 ? (result.totalPnL ?? 0) - slotContributionTotal : 0;
  const contributionsAligned =
    Math.abs(contributionDelta) < Math.max(0.01, Math.abs(result?.totalPnL ?? 0) * 0.001);
  const formatMetricValue = useCallback(
    (value: number | null | undefined, digits = 2, signed = false) => {
      if (!result || result.status === 'na' || value === null || !Number.isFinite(value)) {
        return 'N/A';
      }
      const prefix = signed && value > 0 ? '+' : '';
      return `${prefix}${value.toFixed(digits)}`;
    },
    [result]
  );

  useEffect(() => {
    const needsZeroing = slots.some(
      (slot) =>
        slot.node &&
        slot.weight > 0.05 &&
        slotHistoryDiagnostics[slot.id]?.status !== 'ok'
    );
    if (needsZeroing) {
      setSlots((prev) => {
        const adjusted = prev.map((slotState) =>
          slotState.node &&
          slotState.weight > 0.05 &&
          slotHistoryDiagnostics[slotState.id]?.status !== 'ok'
            ? { ...slotState, weight: 0 }
            : slotState
        );
        return normalizeSlotWeights(adjusted);
      });
      return;
    }
    const activeWeight = slots.reduce(
      (sum, slot) => sum + (slot.node ? slot.weight : 0),
      0
    );
    const hasWeightOnEmpty = slots.some(
      (slot) => !slot.node && slot.weight > 0.05
    );
    if (
      hasWeightOnEmpty ||
      (activeWeight > 0 && Math.abs(activeWeight - 100) > 0.5)
    ) {
      setSlots((prev) => normalizeSlotWeights(prev));
    }
  }, [slots, setSlots, slotHistoryDiagnostics]);

  const handleRunSimulation = useCallback(() => {
    if (!canRun || !effectiveMarketData) {
      if (!canRun) {
        setSimulationError(runBlockingReasons.join(' / ') || '조건을 충족하세요.');
      }
      return;
    }
    if (capitalError) {
      showCapitalToast(capitalError, 'error');
      return;
    }
    setIsSimulating(true);
    setSimulationError(null);
    setTimeout(() => {
      try {
        const config: SimulationConfig = {
          initialCapital: capital,
          asset,
          mode: strategyMode,
          slots,
        };
        const simRes = calculateSimulation(config, effectiveMarketData, asset);
        setResult(simRes);
        setHasRun(true);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '시뮬레이션을 실행할 수 없습니다.';
        setResult(null);
        setHasRun(false);
        setSimulationError(message);
        showCapitalToast(message, 'error');
        console.error('Simulation failed', error);
      } finally {
        setIsSimulating(false);
      }
    }, 800);
  }, [canRun, effectiveMarketData, capitalError, capital, asset, strategyMode, slots, showCapitalToast, runBlockingReasons]);

  useEffect(() => {
    const weightA = slots[0]?.weight ?? 0;
    const weightC = slots[2]?.weight ?? 0;
    const derivedH1 = weightC;
    const derivedH2 = 100 - weightA;
    if (Math.abs(derivedH1 - h1) > 0.5) {
      setH1(derivedH1);
    }
    if (Math.abs(derivedH2 - h2) > 0.5) {
      setH2(derivedH2);
    }
  }, [slots, h1, h2]);

  const prevAssetRef = useRef<'ATOM' | 'ATOMONE'>(asset);
  useEffect(() => {
    const prevAsset = prevAssetRef.current;
    if (prevAsset === asset) return;
    prevAssetRef.current = asset;
    if (!hasRun) return;
    if (isSimulating) return;
    if (canRun && currentMarketData) {
      handleRunSimulation();
    } else {
      setHasRun(false);
      setResult(null);
    }
  }, [asset, handleRunSimulation, hasRun, isSimulating, canRun, currentMarketData]);

  const handleReset = () => {
    setHasRun(false);
    setResult(null);
  };

  // Slot Management
  const clearSlot = (index: number) => {
    if (controlsDisabled) return;
    setSlots((prevSlots) => {
      const nextSlots = prevSlots.map((slot, idx) =>
        idx === index ? { ...slot, node: null } : slot
      );
      return normalizeSlotWeights(nextSlots);
    });
  };

  const updateWeightsFromHandles = useCallback(
    (nextH1: number, nextH2: number) => {
      setH1(nextH1);
      setH2(nextH2);
      setSlots((prev) => {
        const weights = [
          Math.max(0, 100 - nextH2),
          Math.max(0, nextH2 - nextH1),
          Math.max(0, nextH1),
        ];
        const updated = prev.map((slot, idx) =>
          slot.node ? { ...slot, weight: weights[idx] } : { ...slot, weight: 0 }
        );
        return normalizeSlotWeights(updated);
      });
    },
    [setSlots]
  );

  // Drag Logic
  const handleMouseDown =
    (handle: 'h1' | 'h2') => (e: React.MouseEvent<HTMLDivElement>) => {
      if (controlsDisabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(handle);
    };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const relativeY = rect.bottom - e.clientY;
      let percent = (relativeY / rect.height) * 100;
      percent = Math.max(0, Math.min(100, percent));

      if (isDragging === 'h1') {
        const max = h2 - 5;
        updateWeightsFromHandles(Math.min(max, Math.max(0, percent)), h2);
      } else {
        const min = h1 + 5;
        updateWeightsFromHandles(h1, Math.max(min, Math.min(100, percent)));
      }
    };

    const handleMouseUp = () => setIsDragging(null);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, h1, h2, updateWeightsFromHandles]);

  const slotWeights = slots.map((slot) => slot.weight);
  const slotSegments = slots.map((slot) => ({
    id: slot.id,
    hasNode: !!slot.node,
    color: getBiasColor(slot.node?.bias as NodeData['bias']),
  }));
  const getSlotColorForId = useCallback(
    (slotId: string) => {
      const slot = slots.find((s) => s.id === slotId);
      return getBiasColor(slot?.node?.bias as NodeData['bias']);
    },
    [slots]
  );

  return (
    <div className="h-full glass-card-light dark:glass-card-dark rounded-[32px] flex relative overflow-hidden" style={{
      boxShadow: 'none',
      border: '1px solid rgba(200, 215, 232, 0.14)',
      isolation: 'isolate',
      borderRadius: '32px',
    }}>
      {/* LEFT PANEL: Controls & Allocation */}
      <div className="w-[42%] border-r border-white/20 dark:border-[#4ED6E6]/20 flex flex-col overflow-hidden relative" style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)'
      }}>
        <div className="px-4 py-4 border-b border-white/20 dark:border-[#4ED6E6]/20 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <div className="bg-white dark:bg-white/6 rounded-2xl px-4 py-3 border border-gray-100 dark:border-[#4ED6E6]/20 flex items-center justify-between shadow-sm group hover:border-indigo-100 dark:hover:border-[#4ED6E6]/40 transition-colors backdrop-blur-sm" style={{
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none'
              }}>
                <div className="flex items-center gap-2">
                  <div className="bg-green-50 p-1 rounded-full" style={{
                    border: 'none'
                  }}>
                    <DollarSign
                      size={10}
                      className="text-green-600"
                    />
                  </div>
                  <input
                    type="number"
                    value={capital}
                    min={0}
                    disabled={controlsDisabled}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setCapital(Number.isNaN(next) ? 0 : Math.max(0, next));
                    }}
                    className="bg-transparent text-sm font-bold text-gray-900 dark:text-white w-20 focus:outline-none disabled:text-gray-400"
                  />
                </div>
                <span className="text-[8px] font-bold text-gray-300 dark:text-white/60 uppercase tracking-wider">
                  INITIAL COINS
                </span>
              </div>
            </div>
            <div className="relative">
              {capitalToast && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div
                    className={`px-4 py-1.5 rounded-full text-[10px] font-semibold shadow-xl backdrop-blur-lg border ${
                      capitalToast.type === 'error'
                        ? 'bg-rose-50/95 text-rose-600 border-rose-100 dark:bg-rose-500/30 dark:text-rose-100 dark:border-rose-400/40'
                        : 'bg-amber-50/95 text-amber-700 border-amber-100 dark:bg-amber-400/30 dark:text-amber-100 dark:border-amber-300/40'
                    }`}
                  >
                    {capitalToast.message}
                  </div>
                </div>
              )}
              <div className="flex bg-white dark:bg-white/5 border border-gray-100 dark:border-[#4ED6E6]/20 rounded-2xl overflow-hidden p-1 shadow-sm backdrop-blur-sm" style={{
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none'
              }}>
                <button
                  disabled={controlsDisabled}
                  onClick={() => setAsset('ATOM')}
                  className={`flex-1 text-[9px] font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    asset === 'ATOM'
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-500 shadow-sm'
                      : 'text-gray-400 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  ATOM
                </button>
                <div className="w-px bg-transparent" />
                <button
                  disabled={controlsDisabled}
                  onClick={() => setAsset('ATOMONE')}
                  className={`flex-1 text-[9px] font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    asset === 'ATOMONE'
                      ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 shadow-sm'
                      : 'text-gray-400 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  ONE
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Allocation Splitter */}
        <div className="flex-1 p-3 flex gap-3 min-h-0 overflow-visible">
          {/* VERTICAL SLIDER */}
          <div className="w-16 h-full flex flex-col items-center relative py-2 shrink-0">
            <div className="absolute inset-x-0 -top-2 text-center text-[8px] font-bold text-gray-500 dark:text-white/50 uppercase opacity-60">
              100%
            </div>

            <div className="w-full h-full relative px-2">
            <div
              ref={sliderRef}
                className="w-3 h-full rounded-full relative mx-auto"
                style={{
                  background: 'linear-gradient(to bottom, #f3f4f6, #e5e7eb)',
                  border: '1px solid rgba(209, 213, 219, 0.4)',
                  boxShadow: 'inset 0 2px 4px rgba(196, 181, 253, 0.1), 0 1px 2px rgba(196, 181, 253, 0.15)',
                }}
              >
                {/* Segments with slot colors */}
                <div
                  className="absolute top-0 w-full rounded-t-full transition-all duration-200"
                  style={{
                    height: `${slotWeights[0]}%`,
                    background: slotSegments[0].hasNode
                      ? slotSegments[0].color.soft
                      : 'rgba(209, 213, 219, 0.6)',
                    borderTopLeftRadius: '9999px',
                    borderTopRightRadius: '9999px',
                    boxShadow: '0 2px 8px rgba(31, 41, 55, 0.1)',
                  }}
                />
                <div
                  className="absolute w-full transition-all duration-200"
                  style={{
                    bottom: `${slotWeights[2]}%`,
                    height: `${slotWeights[1]}%`,
                    background: slotSegments[1].hasNode
                      ? slotSegments[1].color.soft
                      : 'rgba(209, 213, 219, 0.6)',
                    boxShadow: '0 2px 8px rgba(31, 41, 55, 0.08)',
                  }}
                />
                <div
                  className="absolute bottom-0 w-full rounded-b-full transition-all duration-200"
                  style={{
                    height: `${slotWeights[2]}%`,
                    background: slotSegments[2].hasNode
                      ? slotSegments[2].color.soft
                      : 'rgba(209, 213, 219, 0.6)',
                    borderBottomLeftRadius: '9999px',
                    borderBottomRightRadius: '9999px',
                    boxShadow: '0 2px 8px rgba(31, 41, 55, 0.08)',
                  }}
                />

              {/* Handles */}
              <div
                onMouseDown={handleMouseDown('h2')}
                  className={`absolute left-1/2 -translate-x-1/2 z-30 flex items-center justify-center cursor-row-resize transition-all ${
                  isDragging === 'h2'
                      ? 'scale-110'
                      : 'hover:scale-105'
                }`}
                style={{
                  bottom: `${h2}%`,
                  transform: 'translate(-50%, 50%)',
                    width: '1.5rem',
                    height: '1rem',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '0.375rem',
                      background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 50%, #d1fae5 100%)',
                      border: isDragging === 'h2' 
                        ? '2px solid #34d399'
                        : '1px solid rgba(110, 231, 183, 0.6)',
                      boxShadow: isDragging === 'h2'
                        ? '0 0 12px rgba(110, 231, 183, 0.9), 0 2px 8px rgba(52, 211, 153, 0.4)'
                        : '0 2px 6px rgba(110, 231, 183, 0.4)',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-3 h-0.5 rounded-full bg-emerald-400" />
                  </div>
              </div>

              <div
                onMouseDown={handleMouseDown('h1')}
                  className={`absolute left-1/2 -translate-x-1/2 z-30 flex items-center justify-center cursor-row-resize transition-all ${
                  isDragging === 'h1'
                      ? 'scale-110'
                      : 'hover:scale-105'
                }`}
                style={{
                  bottom: `${h1}%`,
                  transform: 'translate(-50%, 50%)',
                    width: '1.5rem',
                    height: '1rem',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '0.375rem',
                      background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 50%, #d1fae5 100%)',
                      border: isDragging === 'h1'
                        ? '2px solid #34d399'
                        : '1px solid rgba(110, 231, 183, 0.6)',
                      boxShadow: isDragging === 'h1'
                        ? '0 0 12px rgba(110, 231, 183, 0.9), 0 2px 8px rgba(52, 211, 153, 0.4)'
                        : '0 2px 6px rgba(110, 231, 183, 0.4)',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-3 h-0.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 -bottom-2 text-center text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase opacity-60">
              0%
            </div>
          </div>

          {/* SLOT STACK */}
          <div className="flex-1 flex flex-col gap-2 h-full min-h-0 overflow-visible">
            {slots.map((slot, index) => {
              // slots[0] = A, slots[1] = B, slots[2] = C
              // 표시 순서: A(0), B(1), C(2) - A가 위, C가 아래
              const originalIndex = index;
              const slotLabels = ['A', 'B', 'C'];
              const isAnimating = animatingSlots[slot.id];
              const slotColor = slotSegments[index].color;
              const slotHasNode = slotSegments[index].hasNode;
              const infoLine = slot.node
                ? truncateAddress(slot.node.address || slot.node.id)
                : '상단 패널에서 계정을 지정하세요.';
              
              return (
                <div
                  key={slot.id}
                  className={`flex-1 border rounded-xl p-3 pl-4 relative overflow-hidden flex flex-col justify-center min-h-0 ${
                    slot.weight < 5
                      ? 'opacity-40 bg-gray-50 dark:bg-white/3 border-dashed dark:border-[#4ED6E6]/20'
                      : slotHasNode
                      ? 'bg-white/85 dark:bg-white/7 border-transparent shadow-sm hover:shadow-md hover:-translate-y-0.5'
                      : 'bg-white dark:bg-white/5 border-gray-100 dark:border-[#4ED6E6]/20 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-200/50 dark:hover:border-[#4ED6E6]/40'
                  } ${isAnimating ? 'slot-fill-animation' : ''}`}
                  style={{
                    transition:
                      'all 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.5s ease-out, border-color 0.5s ease-out',
                    borderColor: slotHasNode
                      ? `${slotColor.border}40`
                      : undefined,
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-1.5 rounded-full"
                    style={{
                      backgroundColor: slotColor.solid,
                      opacity: slotHasNode ? 0.9 : 0.25,
                    }}
                  />
                  {/* Drop fill effect when node is assigned */}
                  {isAnimating && (
                    <div 
                      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl slot-drop-fill"
                      style={{
                        background: slot.node?.bias === 'ATOM' 
                          ? 'radial-gradient(ellipse at center top, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.1) 50%, transparent 70%)'
                          : slot.node?.bias === 'ATOMONE'
                          ? 'radial-gradient(ellipse at center top, rgba(14, 165, 233, 0.4) 0%, rgba(14, 165, 233, 0.1) 50%, transparent 70%)'
                          : 'radial-gradient(ellipse at center top, rgba(168, 85, 247, 0.4) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)',
                      }}
                    />
                  )}
                  {/* Shimmer effect when node is assigned */}
                  {slot.node && slot.weight >= 5 && !isAnimating && (
                    <div 
                      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.08) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'slot-shimmer 3s ease-in-out infinite',
                      }}
                    />
                  )}
                  <div
                    className={`w-full h-full flex flex-col gap-2 relative overflow-hidden ${isAnimating ? 'slot-content-reveal' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-gray-400 dark:text-white/50">
                          <span>Slot {slotLabels[originalIndex]}</span>
                          {slot.node && (
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold" style={{ backgroundColor: `${slotColor.solid}15`, color: slotColor.solid }}>
                              {slot.node.bias}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] font-semibold text-gray-800 dark:text-white truncate">
                          {slot.node ? slot.node.name : 'Empty Slot'}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                          {infoLine}
                        </div>
                        {slot.node && slotHistoryDiagnostics[slot.id] && slotHistoryDiagnostics[slot.id]?.status !== 'ok' && (
                          <div className="text-[9px] font-semibold text-rose-500 dark:text-rose-400 mt-1">
                            {SLOT_REASON_MESSAGES[slotHistoryDiagnostics[slot.id]?.reason] ||
                              '선택 기간 데이터 없음'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div
                          className="text-sm font-bold text-gray-700 dark:text-white/80 whitespace-nowrap"
                          style={{
                            transition:
                              'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform:
                              slot.weight >= 5 ? 'scale(1.05)' : 'scale(1)',
                          }}
                        >
                          {Math.round(slot.weight)}%
                        </div>
                        <div className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500">
                          AII {slot.node ? Math.round(slot.node.size) : '—'}
                        </div>
                        {slot.node && (
                          <button
                            disabled={controlsDisabled}
                            onClick={() => clearSlot(originalIndex)}
                            className="p-1 text-gray-300 dark:text-white/60 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Chart & Results */}
      <div className="flex-1 bg-transparent p-6 flex flex-col relative">
        {/* Run Overlay */}
        {(!hasRun || isSimulating) && (
          <div
            className={`absolute inset-0 z-20 bg-white/90 dark:bg-[#090C12]/95 backdrop-blur-xl flex items-center justify-center flex-col rounded-[32px] transition-all duration-500 ${
              !canRun && !isSimulating ? 'opacity-50' : ''
            }`}
          >
            {isSimulating ? (
              <div className="flex flex-col items-center gap-8">
                {/* Epic loading animation */}
                <div className="relative w-32 h-32">
                  {/* Outer rotating ring */}
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-transparent"
                    style={{
                      borderTopColor: 'rgba(99, 102, 241, 0.8)',
                      borderRightColor: 'rgba(168, 85, 247, 0.4)',
                      animation: 'spin 1.5s linear infinite',
                    }}
                  />
                  {/* Middle rotating ring - opposite direction */}
                  <div 
                    className="absolute inset-3 rounded-full border-2 border-transparent"
                    style={{
                      borderBottomColor: 'rgba(168, 85, 247, 0.8)',
                      borderLeftColor: 'rgba(99, 102, 241, 0.4)',
                      animation: 'spin 2s linear infinite reverse',
                    }}
                  />
                  {/* Inner pulsing circle */}
                  <div 
                    className="absolute inset-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600"
                    style={{
                      animation: 'pulse-glow 1.5s ease-in-out infinite',
                    }}
                  />
                  {/* Ripple effects */}
                  <div 
                    className="absolute inset-0 rounded-full border border-indigo-400/50"
                    style={{
                      animation: 'ripple 2s ease-out infinite',
                    }}
                  />
                  <div 
                    className="absolute inset-0 rounded-full border border-purple-400/50"
                    style={{
                      animation: 'ripple 2s ease-out infinite 0.5s',
                    }}
                  />
                  <div 
                    className="absolute inset-0 rounded-full border border-indigo-400/50"
                    style={{
                      animation: 'ripple 2s ease-out infinite 1s',
                    }}
                  />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <TrendingUp
                      size={24}
                      className="text-white drop-shadow-lg"
                      style={{
                        animation: 'float 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
                
                {/* Animated text */}
                <div className="text-center space-y-3">
                  <div 
                    className="text-sm font-bold text-gray-700 dark:text-white/80 uppercase tracking-[0.3em]"
                    style={{
                      animation: 'text-shimmer 2s ease-in-out infinite',
                    }}
                  >
                    Analyzing Strategy
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                        style={{
                          animation: `bounce-dot 1.4s ease-in-out infinite`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleRunSimulation}
                  disabled={!canRun || isSimulating}
                  className="group relative transition-all disabled:cursor-not-allowed focus:outline-none"
                >
                  <div className="flex flex-col items-center justify-center gap-5 transform translate-y-6">
                    <div
                      className={`relative w-24 h-24 transition-all duration-500 ${
                        !canRun ? 'grayscale opacity-50' : ''
                      }`}
                    >
                      <div 
                        className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-2xl transition-all duration-500"
                        style={{
                          opacity: canRun ? 0.4 : 0.1,
                          transform: 'scale(1.2)',
                          animation: canRun ? 'pulse-glow 3s ease-in-out infinite' : 'none',
                        }}
                      />
                      <div 
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'conic-gradient(from 0deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8), rgba(99, 102, 241, 0.8))',
                          padding: '2px',
                          animation: canRun ? 'spin 4s linear infinite' : 'none',
                        }}
                      />
                      <div
                        className="absolute inset-0 rounded-full p-2"
                        style={{
                          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(79,70,229,0.35) 100%)',
                        }}
                      >
                        <div className="w-full h-full rounded-full bg-white/85 dark:bg-[#0F172A] flex items-center justify-center shadow-inner">
                          <PlayCircle
                            size={28}
                            className="text-indigo-500 drop-shadow-lg"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <div
                          className={`text-lg font-black tracking-tight transition-all duration-300 ${
                          canRun
                            ? 'text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-[#4ED6E6] group-hover:tracking-wide'
                            : 'text-gray-400 dark:text-white/50'
                        }`}
                      >
                        RUN SIMULATION
                      </div>
                      <div 
                        className="inline-flex items-center gap-1.5 text-[8px] font-bold text-gray-500 dark:text-white/60 uppercase tracking-[0.15em] bg-gray-100/80 dark:bg-white/6 px-3 py-1 rounded-full backdrop-blur-sm border border-gray-200/50 dark:border-[#4ED6E6]/20"
                      >
                        <div
                          className={`w-1 h-1 rounded-full ${canRun ? 'bg-emerald-500' : 'bg-gray-400'}`}
                          style={{
                            animation: canRun ? 'pulse 2s ease-in-out infinite' : 'none',
                          }}
                        />
                        <span>{totalAllocated}% Capital Allocated</span>
                      </div>
                    </div>
                  </div>
                </button>
                {simulationError && (
                  <div className="text-center text-[10px] font-semibold text-rose-500 dark:text-rose-400 max-w-xs">
                    {simulationError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {hasAllocation && (
          <>
            {historyBlocked && (
              <div className="mb-4 bg-white dark:bg-white/10 border border-rose-200 dark:border-rose-500/40 rounded-2xl p-4 text-sm text-gray-700 dark:text-gray-100 shadow-sm z-20">
                <div className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2">
                  백테스트를 실행할 수 없습니다
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-2">
                  선택한 기간에 유효한 거래 히스토리가 있는 계정이 최소 2개 필요합니다.
                </p>
                <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1 mb-2">
                  {missingSlotMessages.map((msg) => (
                    <li key={msg}>• {msg}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  기간을 늘리거나 다른 계정을 선택해 주세요.
                </p>
              </div>
            )}
            {/* Results Header */}
            <div
              className={`flex gap-6 mb-4 shrink-0 relative z-10 ${
                historyBlocked ? 'opacity-60 blur-[1px]' : ''
              }`}
            >
          <div className="flex-1 p-3 bg-white dark:bg-white/7 rounded-2xl shadow-soft dark:shadow-none border border-gray-50 dark:border-[#4ED6E6]/20 backdrop-blur-sm" style={{
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            boxShadow: undefined
          }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-gray-400 dark:text-white/60 uppercase tracking-widest">
                Total PnL (Coins)
              </span>
              <button
                type="button"
                title={metricTooltips.pnl}
                    className="text-gray-300 dark:text-white/40 hover:text-gray-500 dark:hover:text-white/70 transition-colors"
                  >
                    <Info size={12} />
                  </button>
            </div>
            <div
              className={`text-2xl font-light tracking-tighter ${
                !result
                  ? 'text-gray-900 dark:text-white'
                  : result.status === 'na'
                  ? 'text-gray-400 dark:text-white/50'
                  : result.totalPnL >= 0
                  ? 'text-[#4ED6E6] dark:text-[#4ED6E6]'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
                  style={{
                    transition: 'color 0.5s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform:
                      result && result.status !== 'na' && (result.totalPnL ?? 0) !== 0
                        ? 'scale(1.05)'
                        : 'scale(1)',
                  }}
            >
              {formatMetricValue(result?.totalPnL, 2, true)}{' '}
              {result?.status !== 'na' && (
                <span className="text-xs font-medium text-gray-600 dark:text-white/70">
                  {asset}
                </span>
              )}
            </div>
            <div className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mt-1">
              Coin Δ {formatMetricValue(result?.coinPnL, 2, true)}{' '}
              {result?.status !== 'na' ? asset : ''}
            </div>
          </div>
          <div className="flex-1 p-3 bg-white dark:bg-white/7 rounded-2xl shadow-soft dark:shadow-none border border-gray-50 dark:border-[#4ED6E6]/20 backdrop-blur-sm" style={{
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            boxShadow: undefined
          }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-gray-400 dark:text-white/60 uppercase tracking-widest">
                ROI (Percent)
              </span>
              <button
                type="button"
                title={metricTooltips.roi}
                className="text-gray-300 dark:text-white/40 hover:text-gray-500 dark:hover:text-white/70 transition-colors"
              >
                <Info size={12} />
              </button>
            </div>
            <div
              className={`text-2xl font-light tracking-tighter ${
                !result
                  ? 'text-gray-900 dark:text-white'
                  : result.status === 'na'
                  ? 'text-gray-400 dark:text-white/50'
                  : (result.roi ?? 0) >= 0
                  ? 'text-emerald-500 dark:text-emerald-300'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
              style={{
                transition: 'color 0.5s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform:
                  result && result.status !== 'na' && (result.roi ?? 0) !== 0
                    ? 'scale(1.05)'
                    : 'scale(1)',
              }}
            >
              {result?.status === 'na'
                ? 'N/A'
                : `${formatMetricValue(result?.roi ?? 0, 2, true)}%`}
            </div>
            {result && (
              <div className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mt-1">
                초기 {capital.toFixed(0)} {asset} → 최종{' '}
                {result?.status === 'na'
                  ? 'N/A'
                  : `${formatMetricValue(result?.finalValue, 2)} ${asset}`}
              </div>
            )}
          </div>
          <div className="flex-1 p-3 bg-gray-900 dark:bg-white/8 rounded-2xl shadow-soft dark:shadow-none border border-gray-900 dark:border-[#4ED6E6]/20 text-right backdrop-blur-sm" style={{}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-gray-500 dark:text-white/60 uppercase tracking-widest">
                Final Value (Coins)
              </span>
              <button
                type="button"
                title={metricTooltips.value}
                    className="text-gray-300 dark:text-white/50 hover:text-gray-100 transition-colors"
                  >
                    <Info size={12} />
                  </button>
                </div>
                <div 
              className="text-2xl font-bold text-white dark:text-aether-dark-text"
              style={{
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform:
                  result && result.status !== 'na' && (result.finalValue ?? 0) > 0
                    ? 'scale(1.05)'
                    : 'scale(1)',
              }}
            >
              {formatMetricValue(result?.finalValue, 2)}{' '}
              {result?.status !== 'na' && (
                <span className="text-xs font-medium text-gray-600 dark:text-white/70">
                  {asset}
                </span>
              )}
            </div>
            <div className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mt-1">
              ≈ {formatMetricValue(result?.finalCoins, 2)}{' '}
              {result?.status !== 'na' ? asset : ''}
            </div>
          </div>
        </div>
        {result?.status === 'na' && result?.reasons?.length && (
          <div className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 text-center">
            {result.reasons.join(', ')}
          </div>
        )}

            {/* Chart Container */}
            <div
              className={`flex-1 bg-gray-50/50 dark:bg-white/6 rounded-3xl border border-gray-100 dark:border-[#4ED6E6]/20 p-5 relative min-h-0 z-10 backdrop-blur-sm ${
                historyBlocked ? 'opacity-60 blur-[1px]' : ''
              }`}
              style={{
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              boxShadow: undefined
            }}>
              {hasRun && result && result.timeline.length > 0 && (
                <>
              <div className="flex flex-wrap items-center gap-2 mb-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/50">
                {SLOT_IDS.map((slotId) => {
                  const slotColor = getSlotColorForId(slotId);
                  const isActive = visibleSlotLines[slotId];
                  return (
                    <button
                      key={slotId}
                      type="button"
                      onClick={() =>
                        setVisibleSlotLines((prev) => ({
                          ...prev,
                          [slotId]: !prev[slotId],
                        }))
                      }
                      className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all ${
                        isActive
                          ? 'bg-white dark:bg-white/10 text-gray-700 dark:text-white border-gray-200 dark:border-white/20'
                          : 'text-gray-400 dark:text-gray-500 border-gray-200/40 dark:border-white/10'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: slotColor.solid }}
                      />
                      <span>Slot {slotId}</span>
                    </button>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={chartData}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorValue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={asset === 'ATOM' ? '#EF4444' : '#0EA5E9'}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={asset === 'ATOM' ? '#EF4444' : '#0EA5E9'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(215 28% 17%)"
                  />
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(216 28% 12% / 0.95)',
                      color: '#e2e8f0',
                      border: '1px solid hsl(0 0% 100% / 0.2)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      padding: '12px',
                      boxShadow:
                        '0 10px 15px -3px rgba(196, 181, 253, 0.2)',
                    }}
                    itemStyle={{ fontWeight: 700, color: '#e2e8f0' }}
                    labelStyle={{
                      color: '#cbd5e1',
                      marginBottom: '4px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'portfolioValue') {
                        return [`${value.toFixed(2)} ${asset}`, 'Portfolio Coins'];
                      } else if (name === 'benchmarkValue') {
                        return [`${value.toFixed(2)} ${asset}`, 'Benchmark (Hold)'];
                      } else if (SLOT_IDS.includes(name as 'A' | 'B' | 'C')) {
                        return [`${value.toFixed(2)} ${asset}`, `Slot ${name}`];
                      }
                      return [`${value.toFixed(2)}`, name];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="portfolioValue"
                    stroke={asset === 'ATOM' ? '#EF4444' : '#0EA5E9'}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    animationDuration={1000}
                    animationEasing="ease-out"
                    isAnimationActive={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkValue"
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                    strokeDasharray="6 6"
                    dot={false}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    isAnimationActive={true}
                  />
                  {SLOT_IDS.map((slotId) => {
                    const slotColor = getSlotColorForId(slotId);
                    return (
                      <Line
                        key={slotId}
                        type="monotone"
                        dataKey={slotId}
                        stroke={slotColor.solid}
                        strokeWidth={1.5}
                        dot={false}
                        hide={!visibleSlotLines[slotId]}
                        strokeOpacity={0.8}
                        animationDuration={900}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>

              <button
                onClick={handleReset}
                className="absolute top-4 right-4 p-2.5 bg-white dark:bg-white/6 hover:bg-red-50 dark:hover:bg-red-500/10 border border-gray-100 dark:border-[#4ED6E6]/20 shadow-sm rounded-xl text-gray-400 dark:text-white/60 hover:text-red-500 dark:hover:text-red-400 transition-all hover:rotate-180 duration-500 backdrop-blur-sm"
                style={{
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none'
                }}
              >
                <RotateCcw size={14} />
              </button>
              {leadingContribution && (
                <div className="mt-4 text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-gray-700 dark:text-white/80">
                    Slot {leadingContribution.id}{' '}
                    {leadingContribution.contribution >= 0 ? '+' : ''}
                    {leadingContribution.contribution.toFixed(2)} {asset}
                  </span>
                  {leadingContribution.label && (
                    <span className="text-gray-400 dark:text-gray-500">
                      {leadingContribution.label}
                    </span>
                  )}
                  {leadingContribution.address && (
                    <span className="text-gray-400 dark:text-gray-500">
                      {truncateAddress(leadingContribution.address)}
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-gray-500">
                    슬롯 기여도가 가장 컸습니다.
                  </span>
                </div>
              )}
              {result && (
                <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
                  ΣSlot Contributions = {slotContributionTotal.toFixed(2)} {asset}{' '}
                  {contributionsAligned
                    ? '(portfolio delta OK)'
                    : `(Δ ${contributionDelta.toFixed(2)} ${asset})`}
                </div>
              )}
              </>
            )}
          </div>
        </>
        )}
      </div>
    </div>
  );
};

export default SimulationEngine;
