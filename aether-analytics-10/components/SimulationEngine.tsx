import React, { useState, useEffect, useRef } from 'react';
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
  Settings2,
  DollarSign,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { calculateSimulation } from '../utils/mockData';
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
const NoiseMolecule: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
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
      detail = 40;
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
        this.add(this.mesh);
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

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
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
  }, []);

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
  // Config State
  const [capital, setCapital] = useState<number>(100);
  const [strategyMode, setStrategyMode] =
    useState<StrategyMode>('COPY_TRADING');
  const [asset, setAsset] = useState<'ATOM' | 'ATOMONE'>('ATOM');

  // Slider Handles (0-100%)
  const [h1, setH1] = useState(50);
  const [h2, setH2] = useState(80);

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState<'h1' | 'h2' | null>(null);

  // Simulation State
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Check if at least one slot has a node
  const isRunnable = slots.some((slot) => slot.node !== null);

  // Sync Slider Handles to Weights
  useEffect(() => {
    const wA = h1;
    const wB = h2 - h1;
    const wC = 100 - h2;

    setSlots((prev) => [
      { ...prev[0], weight: wA },
      { ...prev[1], weight: wB },
      { ...prev[2], weight: wC },
    ]);
  }, [h1, h2, setSlots]);

  // Manual Run Handler
  const handleRunSimulation = () => {
    if (!isRunnable) return;
    const currentMarketData = asset === 'ATOM' ? atomData : oneData;
    if (!currentMarketData) return;

    setIsSimulating(true);

    setTimeout(() => {
      const config: SimulationConfig = {
        initialCapital: capital,
        asset: asset,
        mode: strategyMode,
        slots: slots,
      };
      const simRes = calculateSimulation(config, currentMarketData);
      setResult(simRes);
      setHasRun(true);
      setIsSimulating(false);
    }, 800);
  };

  const handleReset = () => {
    setHasRun(false);
    setResult(null);
  };

  // Slot Management
  const clearSlot = (index: number) => {
    setSlots(prevSlots => {
        const newSlots = [...prevSlots];
        newSlots[index].node = null;
        return newSlots;
    });
  };

  // Drag Logic
  const handleMouseDown = (handle: 'h1' | 'h2') => (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
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
        setH1(Math.min(max, Math.max(0, percent)));
      } else {
        const min = h1 + 5;
        setH2(Math.max(min, Math.min(100, percent)));
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
  }, [isDragging, h1, h2]);

  return (
    <div className="h-full bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-2xl rounded-[32px] shadow-float dark:shadow-float-dark border border-white/60 dark:border-white/10 flex overflow-hidden">
      {/* LEFT PANEL: Controls & Allocation */}
      <div className="w-[42%] border-r border-gray-50 dark:border-white/5 flex flex-col bg-gray-50/30 dark:bg-black/10">
        {/* Top: Strategy Settings */}
        <div className="p-6 border-b border-gray-50 dark:border-white/5 shrink-0 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-white dark:bg-aether-dark-card p-1.5 rounded-lg shadow-sm">
                <Settings2
                  size={14}
                  className="text-gray-400 dark:text-aether-dark-subtext"
                />
              </div>
              <h2 className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-widest">
                Config
              </h2>
            </div>
            <div className="flex bg-white dark:bg-aether-dark-bg border border-gray-100 dark:border-white/10 p-1 rounded-xl shadow-sm">
              <button
                onClick={() => setStrategyMode('LONG_ONLY')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all duration-300 ${
                  strategyMode === 'LONG_ONLY'
                    ? 'bg-gray-900 dark:bg-aether-dark-text text-white dark:text-aether-dark-bg shadow-md'
                    : 'text-gray-400 dark:text-aether-dark-subtext hover:text-gray-600 dark:hover:text-aether-dark-text'
                }`}
              >
                BUY ONLY
              </button>
              <button
                onClick={() => setStrategyMode('COPY_TRADING')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all duration-300 ${
                  strategyMode === 'COPY_TRADING'
                    ? 'bg-gray-900 dark:bg-aether-dark-text text-white dark:text-aether-dark-bg shadow-md'
                    : 'text-gray-400 dark:text-aether-dark-subtext hover:text-gray-600 dark:hover:text-aether-dark-text'
                }`}
              >
                COPY TRADE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-aether-dark-card rounded-2xl px-4 py-3 border border-gray-100 dark:border-white/10 flex items-center justify-between shadow-sm group hover:border-indigo-100 dark:hover:border-indigo-500/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="bg-green-50 dark:bg-green-500/10 p-1 rounded-full">
                  <DollarSign
                    size={10}
                    className="text-green-600 dark:text-green-400"
                  />
                </div>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(Number(e.target.value))}
                  className="bg-transparent text-sm font-bold text-gray-900 dark:text-aether-dark-text w-14 focus:outline-none"
                />
              </div>
              <span className="text-[8px] font-bold text-gray-300 dark:text-aether-dark-subtext uppercase tracking-wider">
                CAPITAL
              </span>
            </div>
            <div className="flex bg-white dark:bg-aether-dark-bg border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden p-1 shadow-sm">
              <button
                onClick={() => setAsset('ATOM')}
                className={`flex-1 text-[9px] font-bold rounded-xl transition-all ${
                  asset === 'ATOM'
                    ? 'bg-red-50 dark:bg-red-500/10 text-red-500 shadow-sm'
                    : 'text-gray-400 dark:text-aether-dark-subtext hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                ATOM
              </button>
              <div className="w-px bg-transparent" />
              <button
                onClick={() => setAsset('ATOMONE')}
                className={`flex-1 text-[9px] font-bold rounded-xl transition-all ${
                  asset === 'ATOMONE'
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500 shadow-sm'
                    : 'text-gray-400 dark:text-aether-dark-subtext hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                ONE
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Allocation Splitter */}
        <div className="flex-1 p-6 flex gap-6 min-h-0">
          {/* VERTICAL SLIDER */}
          <div className="w-16 h-full flex flex-col items-center relative py-4 shrink-0">
            <div className="absolute inset-x-0 -top-2 text-center text-[8px] font-bold text-purple-400 uppercase opacity-60">
              100%
            </div>

            <div
              ref={sliderRef}
              className="w-3 h-full bg-gray-100 dark:bg-white/5 rounded-full relative shadow-inner overflow-visible"
            >
              {/* Segments */}
              <div
                className="absolute top-0 w-full rounded-t-full bg-purple-400/20 backdrop-blur-sm border-b border-white/50 dark:border-black/20 transition-all duration-100"
                style={{ height: `${100 - h2}%` }}
              />
              <div
                className="absolute w-full bg-blue-400/20 backdrop-blur-sm border-b border-white/50 dark:border-black/20 transition-all duration-100"
                style={{ bottom: `${h1}%`, height: `${h2 - h1}%` }}
              />
              <div
                className="absolute bottom-0 w-full rounded-b-full bg-red-400/20 backdrop-blur-sm transition-all duration-100"
                style={{ height: `${h1}%` }}
              />

              {/* Handles */}
              <div
                onMouseDown={handleMouseDown('h2')}
                className={`absolute left-1/2 -translate-x-1/2 w-8 h-5 bg-white dark:bg-slate-300 border border-gray-200 dark:border-slate-400/50 shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-lg z-30 flex items-center justify-center cursor-row-resize hover:scale-110 transition-all ${
                  isDragging === 'h2'
                    ? 'scale-110 ring-2 ring-purple-400 ring-offset-2 ring-offset-aether-dark-card'
                    : ''
                }`}
                style={{
                  bottom: `${h2}%`,
                  transform: 'translate(-50%, 50%)',
                }}
              >
                <div className="w-3 h-0.5 bg-gray-300 dark:bg-slate-500 rounded-full" />
              </div>

              <div
                onMouseDown={handleMouseDown('h1')}
                className={`absolute left-1/2 -translate-x-1/2 w-8 h-5 bg-white dark:bg-slate-300 border border-gray-200 dark:border-slate-400/50 shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-lg z-30 flex items-center justify-center cursor-row-resize hover:scale-110 transition-all ${
                  isDragging === 'h1'
                    ? 'scale-110 ring-2 ring-blue-400 ring-offset-2 ring-offset-aether-dark-card'
                    : ''
                }`}
                style={{
                  bottom: `${h1}%`,
                  transform: 'translate(-50%, 50%)',
                }}
              >
                <div className="w-3 h-0.5 bg-gray-300 dark:bg-slate-500 rounded-full" />
              </div>
            </div>

            <div className="absolute inset-x-0 -bottom-2 text-center text-[8px] font-bold text-red-400 uppercase opacity-60">
              0%
            </div>
          </div>

          {/* SLOT STACK */}
          <div className="flex-1 flex flex-col gap-3 h-full min-h-0">
            {[...slots].reverse().map((slot, reversedIndex) => {
              const originalIndex = 2 - reversedIndex;
              return (
                <div
                  key={slot.id}
                  className={`flex-1 border rounded-2xl p-3 relative overflow-hidden flex flex-col justify-center transition-all duration-300 ${
                    slot.weight < 5
                      ? 'opacity-40 bg-gray-50 dark:bg-white/5 border-dashed'
                      : 'bg-white dark:bg-aether-dark-card/50 border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: slot.color }}
                  />

                  <div className="pl-4 w-full">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">
                          Slot {slot.id}
                        </span>
                        <span className="text-[10px] font-bold text-gray-700 dark:text-aether-dark-text bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                          {Math.round(slot.weight)}%
                        </span>
                      </div>

                      <div className="flex gap-1">
                        {slot.node && (
                          <button
                            onClick={() => clearSlot(originalIndex)}
                            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {slot.node ? (
                      <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="text-[11px] font-bold text-gray-800 dark:text-aether-dark-text truncate leading-tight">
                          {slot.node.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${
                              slot.node.bias === 'ATOM'
                                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                                : slot.node.bias === 'ATOMONE'
                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {slot.node.bias}
                          </span>
                          <span className="text-[9px] text-gray-400 dark:text-aether-dark-subtext font-medium">
                            AII: {Math.floor(slot.node.size)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-300 dark:text-gray-600 italic font-medium pl-1">
                        Select node to assign
                      </div>
                    )}
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
            className={`absolute inset-0 z-20 bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-md flex items-center justify-center flex-col rounded-[32px] transition-opacity duration-300 ${
              !isRunnable && !isSimulating ? 'opacity-50' : ''
            }`}
          >
            {isSimulating ? (
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-100 dark:border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <TrendingUp
                      size={20}
                      className="text-indigo-500 dark:text-indigo-400"
                    />
                  </div>
                </div>
                <div className="text-xs font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-[0.2em] animate-pulse">
                  Processing Strategy
                </div>
              </div>
            ) : (
              <button
                onClick={handleRunSimulation}
                disabled={!isRunnable}
                className="group relative transition-all disabled:cursor-not-allowed"
              >
                {/* Sphere + 텍스트를 한 덩어리로 아래로 내려서 중앙 정렬 */}
                <div className="flex flex-col items-center justify-center gap-8 transform translate-y-10">
                  <div
                    className={`relative w-28 h-28 transition-all ${
                      !isRunnable ? 'grayscale' : ''
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse" />

                    <div className="relative w-full h-full rounded-full overflow-hidden">
                      <NoiseMolecule />
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <PlayCircle
                        size={36}
                        className="text-white drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <div
                      className={`text-2xl font-black tracking-tight transition-colors ${
                        isRunnable
                          ? 'text-gray-900 dark:text-aether-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          : 'text-gray-400 dark:text-aether-dark-subtext'
                      }`}
                    >
                      {isRunnable ? 'RUN SIMULATION' : 'ADD NODES TO SLOTS'}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-[0.2em] bg-gray-50 dark:bg-white/5 px-3 py-1 rounded-full">
                      Allocated{' '}
                      {Math.round(
                        slots.reduce(
                          (a, b) => a + (b.node ? b.weight : 0),
                          0
                        )
                      )}
                      % Capital
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Results Header */}
        <div className="flex gap-6 mb-6 shrink-0 relative z-10">
          <div className="flex-1 p-3 bg-white dark:bg-aether-dark-card/50 rounded-2xl shadow-soft dark:shadow-none border border-gray-50 dark:border-white/10">
            <span className="text-[9px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-widest block mb-1">
              Total PnL
            </span>
            <div
              className={`text-2xl font-light tracking-tighter ${
                result && result.totalPnL >= 0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
            >
              {result && result.totalPnL >= 0 ? '+' : ''}
              {result ? result.totalPnL.toFixed(2) : '0.00'}
            </div>
          </div>
          <div className="flex-1 p-3 bg-white dark:bg-aether-dark-card/50 rounded-2xl shadow-soft dark:shadow-none border border-gray-50 dark:border-white/10">
            <span className="text-[9px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-widest block mb-1">
              ROI
            </span>
            <div
              className={`text-2xl font-light tracking-tighter ${
                result && result.roi >= 0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
            >
              {result && result.roi > 0 ? '+' : ''}
              {result ? result.roi.toFixed(2) : '0.00'}%
            </div>
          </div>
          <div className="flex-1 p-3 bg-gray-900 dark:bg-aether-dark-text rounded-2xl shadow-soft dark:shadow-none border border-gray-900 text-right">
            <span className="text-[9px] font-bold text-gray-500 dark:text-aether-dark-bg uppercase tracking-widest block mb-1">
              Final Value
            </span>
            <div className="text-2xl font-bold text-white dark:text-aether-dark-bg">
              {result ? result.finalValue.toFixed(0) : '0'}{' '}
              <span className="text-xs font-medium text-gray-600 dark:text-gray-800">
                {asset}
              </span>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="flex-1 bg-gray-50/50 dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-white/5 p-5 relative min-h-0 z-10">
          {hasRun && result && result.timeline.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.timeline}>
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
                        stopColor={asset === 'ATOM' ? '#F87171' : '#60A5FA'}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={asset === 'ATOM' ? '#F87171' : '#60A5FA'}
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
                      backgroundColor: 'hsl(216 28% 12% / 0.8)',
                      color: '#E6EDF3',
                      border: '1px solid hsl(0 0% 100% / 0.1)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      padding: '12px',
                      boxShadow:
                        '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                    itemStyle={{ fontWeight: 700 }}
                    labelStyle={{
                      color: '#8B949E',
                      marginBottom: '4px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                    }}
                    formatter={(value: number) => [
                      value.toFixed(2),
                      asset,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="portfolioValue"
                    stroke={asset === 'ATOM' ? '#F87171' : '#60A5FA'}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkValue"
                    stroke="#484f58"
                    strokeWidth={1.5}
                    strokeDasharray="6 6"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <button
                onClick={handleReset}
                className="absolute top-4 right-4 p-2.5 bg-white dark:bg-aether-dark-card/50 hover:bg-red-50 dark:hover:bg-red-500/10 border border-gray-100 dark:border-white/10 shadow-sm rounded-xl text-gray-400 dark:text-aether-dark-subtext hover:text-red-500 dark:hover:text-red-400 transition-all hover:rotate-180 duration-500"
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationEngine;