import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [isDark, setIsDark] = useState(false);
  
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
  
  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };
    checkDarkMode();
    const observer = new MutationObserver(() => {
      checkDarkMode();
    });
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'],
      subtree: false
    });
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => checkDarkMode();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

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
    <div className="h-full glass-card-light dark:glass-card-dark rounded-[32px] flex overflow-hidden relative">
      {/* LEFT PANEL: Controls & Allocation */}
      <div className="w-[42%] border-r border-white/20 dark:border-white/10 flex flex-col overflow-hidden relative" style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)'
      }}>
        {/* Top: Strategy Settings */}
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg glass-button" style={{
                background: 'rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.4)'
              }}>
                <Settings2
                  size={14}
                  className="text-gray-400 dark:text-aether-dark-subtext"
                />
              </div>
              <h2 className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-widest">
                Config
              </h2>
            </div>
            <div className="flex glass-input p-1 rounded-xl">
              <button
                onClick={() => setStrategyMode('LONG_ONLY')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold glass-button transition-all duration-300 ${
                  strategyMode === 'LONG_ONLY'
                    ? 'text-white dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                style={strategyMode === 'LONG_ONLY' ? {
                  background: 'linear-gradient(135deg, rgba(55, 65, 81, 0.9) 0%, rgba(17, 24, 39, 0.9) 100%)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 12px rgba(196, 181, 253, 0.3)'
                } : {
                  background: 'transparent'
                }}
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
        <div className="flex-1 p-4 flex gap-4 min-h-0 overflow-hidden">
          {/* VERTICAL SLIDER */}
          <div className="w-16 h-full flex flex-col items-center relative py-4 shrink-0">
            <div className="absolute inset-x-0 -top-2 text-center text-[8px] font-bold text-purple-400 uppercase opacity-60">
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
                {/* Segments - 노드의 bias에 따라 색상 변경, 노드가 없으면 무채색 */}
                <div
                  className="absolute top-0 w-full rounded-t-full transition-all duration-200"
                  style={{ 
                    height: `${100 - h2}%`,
                    background: slots[0].node 
                      ? slots[0].node.bias === 'ATOM' 
                        ? 'linear-gradient(to bottom, #fb923c, #f97316)' 
                        : slots[0].node.bias === 'ATOMONE' 
                        ? 'linear-gradient(to bottom, #38bdf8, #0ea5e9)' 
                        : 'linear-gradient(to bottom, #a855f7, #9333ea)'
                      : 'linear-gradient(to bottom, #d1d5db, #e5e7eb)',
                    boxShadow: '0 2px 8px rgba(196, 181, 253, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  }}
                />
                <div
                  className="absolute w-full transition-all duration-200"
                  style={{ 
                    bottom: `${h1}%`, 
                    height: `${h2 - h1}%`,
                    background: slots[1].node 
                      ? slots[1].node.bias === 'ATOM' 
                        ? 'linear-gradient(to bottom, #fb923c, #f97316)' 
                        : slots[1].node.bias === 'ATOMONE' 
                        ? 'linear-gradient(to bottom, #38bdf8, #0ea5e9)' 
                        : 'linear-gradient(to bottom, #a855f7, #9333ea)'
                      : 'linear-gradient(to bottom, #d1d5db, #e5e7eb)',
                    boxShadow: '0 2px 8px rgba(196, 181, 253, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  }}
                />
                <div
                  className="absolute bottom-0 w-full rounded-b-full transition-all duration-200"
                  style={{ 
                    height: `${h1}%`,
                    background: slots[2].node 
                      ? slots[2].node.bias === 'ATOM' 
                        ? 'linear-gradient(to bottom, #fb923c, #f97316)' 
                        : slots[2].node.bias === 'ATOMONE' 
                        ? 'linear-gradient(to bottom, #38bdf8, #0ea5e9)' 
                        : 'linear-gradient(to bottom, #a855f7, #9333ea)'
                      : 'linear-gradient(to bottom, #d1d5db, #e5e7eb)',
                    boxShadow: '0 2px 8px rgba(196, 181, 253, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
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
                      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 50%, #f3e8ff 100%)',
                      border: isDragging === 'h2' ? '2px solid #a78bfa' : '1px solid rgba(196, 181, 253, 0.6)',
                      boxShadow: isDragging === 'h2'
                        ? '0 0 12px rgba(196, 181, 253, 0.9), 0 2px 8px rgba(167, 139, 250, 0.4)'
                        : '0 2px 6px rgba(196, 181, 253, 0.4)',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-3 h-0.5 bg-purple-400 rounded-full" />
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
                      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 50%, #f3e8ff 100%)',
                      border: isDragging === 'h1' ? '2px solid #a78bfa' : '1px solid rgba(196, 181, 253, 0.6)',
                      boxShadow: isDragging === 'h1'
                        ? '0 0 12px rgba(196, 181, 253, 0.9), 0 2px 8px rgba(167, 139, 250, 0.4)'
                        : '0 2px 6px rgba(196, 181, 253, 0.4)',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-3 h-0.5 bg-purple-400 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 -bottom-2 text-center text-[8px] font-bold text-red-400 uppercase opacity-60">
              0%
            </div>
          </div>

          {/* SLOT STACK */}
          <div className="flex-1 flex flex-col gap-2 h-full min-h-0 overflow-hidden">
            {slots.map((slot, index) => {
              // slots[0] = A, slots[1] = B, slots[2] = C
              // 표시 순서: A(0), B(1), C(2) - A가 위, C가 아래
              const originalIndex = index;
              const slotLabels = ['A', 'B', 'C'];
              const isAnimating = animatingSlots[slot.id];
              
              return (
                <div
                  key={slot.id}
                  className={`flex-1 border rounded-xl p-2 relative overflow-hidden flex flex-col justify-center transition-all duration-300 min-h-0 ${
                    slot.weight < 5
                      ? 'opacity-40 bg-gray-50 dark:bg-white/5 border-dashed'
                      : slot.node
                      ? 'bg-white/80 dark:bg-slate-800/60 border-indigo-200/50 dark:border-indigo-500/30 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                      : 'bg-white dark:bg-aether-dark-card/50 border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  } ${isAnimating ? 'slot-fill-animation' : ''}`}
                >
                  {/* Drop fill effect when node is assigned */}
                  {isAnimating && (
                    <div 
                      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl slot-drop-fill"
                      style={{
                        background: slot.node?.bias === 'ATOM' 
                          ? 'radial-gradient(ellipse at center top, rgba(249, 115, 22, 0.4) 0%, rgba(249, 115, 22, 0.1) 50%, transparent 70%)'
                          : slot.node?.bias === 'ATOMONE'
                          ? 'radial-gradient(ellipse at center top, rgba(56, 189, 248, 0.4) 0%, rgba(56, 189, 248, 0.1) 50%, transparent 70%)'
                          : 'radial-gradient(ellipse at center top, rgba(168, 85, 247, 0.4) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)',
                      }}
                    />
                  )}
                  {/* Shimmer effect when node is assigned */}
                  {slot.node && slot.weight >= 5 && !isAnimating && (
                    <div 
                      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(129, 140, 248, 0.08) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'slot-shimmer 3s ease-in-out infinite',
                      }}
                    />
                  )}
                  <div className={`px-2 w-full h-full flex items-center gap-2 relative overflow-hidden ${isAnimating ? 'slot-content-reveal' : ''}`}>
                    {/* A/B/C 레이블 - 세로 중앙 */}
                    <div 
                      className="flex items-center justify-center w-5 h-5 border-2 rounded-full text-[9px] font-bold text-white transition-colors duration-200 flex-shrink-0"
                      style={{ 
                        backgroundColor: slot.node 
                          ? slot.node.bias === 'ATOM' 
                            ? '#EF4444' 
                            : slot.node.bias === 'ATOMONE' 
                            ? '#3B82F6' 
                            : '#A855F7'
                          : '#d1d5db', // 노드가 없으면 무채색 (회색)
                        borderColor: slot.node 
                          ? slot.node.bias === 'ATOM' 
                            ? '#EF4444' 
                            : slot.node.bias === 'ATOMONE' 
                            ? '#3B82F6' 
                            : '#A855F7'
                          : '#d1d5db' // 노드가 없으면 무채색 (회색)
                      }}
                    >
                      {slotLabels[originalIndex]}
                    </div>

                    {/* 계정 이름과 타입 - 레이블 옆에 배치 */}
                    <div className="flex-1 flex flex-col justify-center min-h-0 min-w-0 overflow-hidden">
                      {slot.node ? (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-0.5">
                          <div className="text-[10px] font-bold text-gray-800 dark:text-aether-dark-text truncate leading-tight">
                            {slot.node.name}
                          </div>
                          <div>
                            <span
                              className={`text-[8px] px-1.5 py-0.5 rounded font-bold inline-block ${
                                slot.node.bias === 'ATOM'
                                  ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                                  : slot.node.bias === 'ATOMONE'
                                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              {slot.node.bias}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[9px] text-gray-300 dark:text-gray-300 italic font-medium truncate">
                          Select node
                        </div>
                      )}
                    </div>

                    {/* 퍼센트와 삭제 버튼 - 오른쪽 */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                      <div className="text-[9px] font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {Math.round(slot.weight)}%
                      </div>
                      {slot.node && (
                        <button
                          onClick={() => clearSlot(originalIndex)}
                          className="p-1 text-gray-300 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
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
            className={`absolute inset-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl flex items-center justify-center flex-col rounded-[32px] transition-all duration-500 ${
              !isRunnable && !isSimulating ? 'opacity-50' : ''
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
                    className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-[0.3em]"
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
              <button
                onClick={handleRunSimulation}
                disabled={!isRunnable}
                className="group relative transition-all disabled:cursor-not-allowed focus:outline-none"
              >
                {/* Main container */}
                <div className="flex flex-col items-center justify-center gap-8 transform translate-y-5">
                  {/* Animated orb */}
                  <div
                    className={`relative w-32 h-32 transition-all duration-500 ${
                      !isRunnable ? 'grayscale opacity-50' : ''
                    }`}
                  >
                    {/* Background glow */}
                    <div 
                      className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-2xl transition-all duration-500"
                      style={{
                        opacity: isRunnable ? 0.4 : 0.1,
                        transform: 'scale(1.2)',
                        animation: isRunnable ? 'pulse-glow 3s ease-in-out infinite' : 'none',
                      }}
                    />
                    
                    {/* Rotating border ring */}
                    <div 
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'conic-gradient(from 0deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8), rgba(99, 102, 241, 0.8))',
                        padding: '2px',
                        animation: isRunnable ? 'spin 4s linear infinite' : 'none',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                      }}
                    >
                      <div className="w-full h-full rounded-full bg-white/90 dark:bg-slate-900/90" />
                    </div>
                    
                    {/* Inner gradient circle */}
                    <div 
                      className="absolute inset-2 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-500"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(236, 72, 153, 0.15) 100%)',
                      }}
                    >
                      {/* Shimmer overlay */}
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 2s ease-in-out infinite',
                        }}
                      />
                    </div>

                    {/* Play icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div 
                        className="relative group-hover:scale-110 transition-all duration-300"
                        style={{
                          filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.4))',
                        }}
                      >
                        <PlayCircle
                          size={40}
                          className="text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>
                    
                    {/* Hover ripple effect */}
                    <div 
                      className="absolute inset-0 rounded-full border-2 border-indigo-400/0 group-hover:border-indigo-400/50 group-hover:scale-110 transition-all duration-500 group-hover:opacity-0"
                      style={{
                        transitionDelay: '0.1s',
                      }}
                    />
                  </div>

                  {/* Text content */}
                  <div className="text-center space-y-3">
                    <div
                      className={`text-2xl font-black tracking-tight transition-all duration-300 ${
                        isRunnable
                          ? 'text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:tracking-wide'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {isRunnable ? 'RUN SIMULATION' : 'ADD NODES TO SLOTS'}
                    </div>
                    <div 
                      className="inline-flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] bg-gray-100/80 dark:bg-white/5 px-4 py-1.5 rounded-full backdrop-blur-sm border border-gray-200/50 dark:border-white/10"
                    >
                      <div 
                        className={`w-1.5 h-1.5 rounded-full ${isRunnable ? 'bg-emerald-500' : 'bg-gray-400'}`}
                        style={{
                          animation: isRunnable ? 'pulse 2s ease-in-out infinite' : 'none',
                        }}
                      />
                      <span>
                        {Math.round(
                          slots.reduce(
                            (a, b) => a + (b.node ? b.weight : 0),
                            0
                          )
                        )}% Capital Allocated
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Results Header */}
        <div className="flex gap-6 mb-4 shrink-0 relative z-10">
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
              {result ? result.totalPnL.toFixed(1) : '0.0'}
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
          <div className="flex-1 p-3 bg-gray-900 dark:bg-aether-dark-text rounded-2xl shadow-soft dark:shadow-none border border-gray-900 dark:border-aether-dark-text text-right">
            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest block mb-1">
              Final Value
            </span>
            <div className="text-2xl font-bold text-white dark:text-aether-dark-text">
              {result ? result.finalValue.toFixed(0) : '0'}{' '}
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {asset}
              </span>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="flex-1 bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5 p-5 relative min-h-0 z-10">
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
                        '0 10px 15px -3px rgba(196, 181, 253, 0.2)',
                    }}
                    itemStyle={{ fontWeight: 700 }}
                    labelStyle={{
                      color: '#8B949E',
                      marginBottom: '4px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'portfolioValue') {
                        return [`${value.toFixed(1)} ${asset}`, 'Portfolio Coins'];
                      } else if (name === 'benchmarkValue') {
                        return [`${value.toFixed(1)} ${asset}`, 'Benchmark (Hold)'];
                      }
                      return [`${value.toFixed(2)}`, name];
                    }}
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