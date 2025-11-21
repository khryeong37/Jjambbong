
import React, { useState, useEffect, useMemo, useRef }
from 'react';
import {
  Activity,
  TrendingUp,
  Share2,
  Wallet,
  Settings,
  Search,
  Menu,
  X,
  ArrowRight,
  Cpu,
  Database,
  AlertCircle,
  PlayCircle,
  BarChart3,
  Filter,
  Sliders,
  Calendar,
  CheckSquare,
  DollarSign,
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
  Bot,
  Key,
  User,
  PieChart,
  Trash2,
  Plus,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Move,
  Globe,
  Zap,
  BarChart2,
  Clock,
  Link as LinkIcon,
  Info,
  FileText,
  MousePointer2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Wifi
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

// --- API / Mock Data Helpers ---

const fetchCryptoPrice = async (id) => {
  try {
    // Example CoinGecko Call (Commented out to prevent rate limits in demo)
    // const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`);
    // return await res.json();
    return null;
  } catch (e) { console.error(e); return null; }
};

// Initial Mock Data
const INITIAL_ATOM_DATA = { chain: 'Atom', price: 3.33, marketCap: 1577331971, apr: 17.02, inflation: 10.0, bonded: 272495509, supply: 473348994 };
const INITIAL_ATOMONE_DATA = { chain: 'AtomOne', price: 3.32, marketCap: 401285200, apr: 53.68, inflation: 20.0, bonded: 47004487, supply: 132815628 };

// --- Components ---

// Premium Glass Card
const GlassCard = ({ children, className = "", hoverEffect = false }) => (
  <div className={`
    relative overflow-hidden
    bg-white/5 backdrop-blur-2xl
    border border-white/10
    rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]
    ${hoverEffect ? 'hover:bg-white/10 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] hover:border-white/20' : ''}
    transition-all duration-500 ease-out
    p-6 ${className}
  `}>
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    {children}
  </div>
);

const StatItem = ({ label, value, change, prefix = "", suffix = "" }) => (
  <div className="flex flex-col relative z-10">
    <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
      {label}
    </span>
    <div className="flex items-end gap-2">
      <span className="text-2xl lg:text-3xl font-black text-white tracking-tight drop-shadow-lg font-mono">
        {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}{suffix}
      </span>
      {change !== null && change !== undefined && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold mb-1.5 ${change >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      )}
    </div>
  </div>
);

// Collapsible Filter Section
const FilterSection = ({ title, icon: Icon, children, isOpenDefault = true }) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);
  return (
    <div className="border-b border-white/5 pb-4 mb-4 last:border-0 group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left mb-2 p-2 rounded-xl hover:bg-white/5 transition-all duration-300"
      >
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 group-hover:text-white transition-colors">
          <div className={`p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 transition-colors`}>
            <Icon size={14} className="text-indigo-400 group-hover:text-indigo-300" />
          </div>
          {title}
        </h3>
        <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} className="text-slate-600 group-hover:text-white"/>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-4 px-2 pt-1 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Main Application ---

export default function CryptoAnalyticsDashboard() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [statsChain, setStatsChain] = useState('Atom');

  // Live Data State
  const [marketData, setMarketData] = useState({
    Atom: INITIAL_ATOM_DATA,
    AtomOne: INITIAL_ATOMONE_DATA
  });
  const [isLive, setIsLive] = useState(true);

  // Filters
  const [periodPreset, setPeriodPreset] = useState('30D');
  const [startDate, setStartDate] = useState('2024-11-01');
  const [endDate, setEndDate] = useState('2024-11-21');
  const [totalVolMin, setTotalVolMin] = useState(10000);
  const [avgTxSizeMin, setAvgTxSizeMin] = useState(500);
  const [netBuyRatio, setNetBuyRatio] = useState(0);
  const [txFreqMin, setTxFreqMin] = useState(5);
  const [atomShareMin, setAtomShareMin] = useState(0);
  const [atomOneShareMin, setAtomOneShareMin] = useState(0);
  const [ibcRatioMin, setIbcRatioMin] = useState(0);
  const [activeDaysMin, setActiveDaysMin] = useState(3);
  const [recentActive, setRecentActive] = useState('30D');
  const [aiiScoreMin, setAiiScoreMin] = useState(30);
  const [timingType, setTimingType] = useState('All');
  const [correlationMin, setCorrelationMin] = useState(0.5);

  // Graph Interaction
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Portfolio
  const [selectedNode, setSelectedNode] = useState(null);
  const [portfolio, setPortfolio] = useState([
    { id: 'A', node: null, weight: 50, color: '#818cf8' },
    { id: 'B', node: null, weight: 30, color: '#34d399' },
    { id: 'C', node: null, weight: 20, color: '#f472b6' }
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);

  // AI
  const [showAIChat, setShowAIChat] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [tempApiKeyInput, setTempApiKeyInput] = useState('');
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', text: 'Hello! Analyzing holder clusters. Ask me anything!' }]);
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef(null);

  // --- Data Fetching Effect (Simulation) ---
  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        // Simulate real-time price fluctuation
        setMarketData(prev => {
          const fluctuate = (val) => val * (1 + (Math.random() * 0.02 - 0.01)); // +/- 1%
          return {
            Atom: { ...prev.Atom, price: fluctuate(prev.Atom.price), marketCap: fluctuate(prev.Atom.marketCap) },
            AtomOne: { ...prev.AtomOne, price: fluctuate(prev.AtomOne.price), marketCap: fluctuate(prev.AtomOne.marketCap) }
          };
        });
      }, 3000); // Update every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isLive]);

  const currentStatsData = statsChain === 'Atom' ? marketData.Atom : marketData.AtomOne;
  const totalWeight = portfolio.reduce((acc, curr) => acc + curr.weight, 0);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), [aiMessages, showAIChat]);

  // Chart Helpers
  const CHART_WIDTH = 800;
  const CHART_HEIGHT = 500;
  const CHART_PADDING = 60;

  const yAxisConfig = useMemo(() => {
    if (periodPreset === '7D') return { min: 100, max: 100000, label: '7D Vol' };
    if (periodPreset === '90D') return { min: 10000, max: 100000000, label: '90D Vol' };
    if (periodPreset === '180D') return { min: 50000, max: 500000000, label: '180D Vol' };
    return { min: 1000, max: 10000000, label: '30D Vol' };
  }, [periodPreset]);

  const getX = (ratio) => CHART_PADDING + ratio * (CHART_WIDTH - CHART_PADDING * 2);
  const getY = (vol) => {
    const minLog = Math.log10(yAxisConfig.min);
    const maxLog = Math.log10(yAxisConfig.max);
    const vLog = Math.log10(Math.max(vol, yAxisConfig.min));
    const normalized = (vLog - minLog) / (maxLog - minLog);
    return CHART_HEIGHT - CHART_PADDING - (normalized * (CHART_HEIGHT - CHART_PADDING * 2));
  };

  // Data Gen
  const bubbleData = useMemo(() => {
    const count = 150;
    const volumeMultiplier = periodPreset === '7D' ? 0.2 : periodPreset === '90D' ? 2.5 : periodPreset === '180D' ? 4 : 1;

    return Array.from({ length: count }, (_, i) => {
      const randGroup = Math.random();
      let atomShareRatio, type, color, fill;

      if (randGroup < 0.35) {
        atomShareRatio = Math.random() * 0.3;
        type = 'ATOMONE Only';
        color = '#f97316';
        fill = '#f97316';
      } else if (randGroup < 0.7) {
        atomShareRatio = 0.7 + Math.random() * 0.3;
        type = 'ATOM Only';
        color = '#3b82f6';
        fill = '#3b82f6';
      } else {
        atomShareRatio = 0.3 + Math.random() * 0.4;
        type = 'Both (Dual)';
        color = '#10b981';
        fill = '#10b981';
      }

      const isWhale = Math.random() > 0.9;
      const baseVolume = 100000;
      const totalVol = (baseVolume * Math.pow(10, Math.random() * 2)) * volumeMultiplier;
      const totalHoldings = totalVol * (Math.random() * 2 + 0.5);

      return {
        id: `addr_${i}`, type, color, fill, atomShareRatio, totalVol,
        avgTxSize: totalVol / (Math.floor(Math.random() * 50) + 1),
        netBuyRatio: (Math.random() * 2) - 1, txCount: Math.floor(Math.random() * 100),
        atomShare: atomShareRatio, atomOneShare: 1 - atomShareRatio, ibcRatio: Math.random(),
        activeDays: Math.floor(Math.random() * 30), lastActive: Math.floor(Math.random() * 30),
        aiiScore: Math.floor(Math.random() * 100), timingLag: Math.floor(Math.random() * 10) - 5,
        correlation: (Math.random() * 2) - 1, balance: totalHoldings.toFixed(0),
        winRate: (Math.random() * 40 + 40).toFixed(1),
      };
    });
  }, [periodPreset]);

  const processedNodes = useMemo(() => {
    return bubbleData.map(node => {
      const passVol = node.totalVol >= totalVolMin;
      const passAvg = node.avgTxSize >= avgTxSizeMin;
      const passNetBuy = node.netBuyRatio >= netBuyRatio;
      const passFreq = node.txCount >= txFreqMin;
      const passAtomShare = node.atomShare >= atomShareMin;
      const passAtomOneShare = node.atomOneShare >= atomOneShareMin;
      const passIbc = node.ibcRatio >= ibcRatioMin;
      const passActiveDays = node.activeDays >= activeDaysMin;
      let passRecent = true;
      if (recentActive === '3D') passRecent = node.lastActive <= 3;
      if (recentActive === '7D') passRecent = node.lastActive <= 7;
      if (recentActive === '30D') passRecent = node.lastActive <= 30;
      const passAii = node.aiiScore >= aiiScoreMin;
      let passTiming = true;
      if (timingType === 'Leading') passTiming = node.timingLag < 0;
      if (timingType === 'Lagging') passTiming = node.timingLag > 0;
      const passCorr = node.correlation >= correlationMin;

      const isMatch = passVol && passAvg && passNetBuy && passFreq && passAtomShare && passAtomOneShare && passIbc && passActiveDays && passRecent && passAii && passTiming && passCorr;

      const cx = getX(node.atomShareRatio);
      const cy = getY(node.totalVol);
      const r = Math.min(Math.max(Math.sqrt(node.balance) / 20, 4), 30);

      return { ...node, cx, cy, r, isMatch, opacity: isMatch ? 0.9 : 0.2 };
    });
  }, [bubbleData, totalVolMin, avgTxSizeMin, netBuyRatio, txFreqMin, atomShareMin, atomOneShareMin, ibcRatioMin, activeDaysMin, recentActive, aiiScoreMin, timingType, correlationMin, yAxisConfig]);

  // Interaction
  const handleMouseDown = (e) => { if (e.target.tagName === 'circle') return; setIsDragging(true); setLastMousePos({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e) => { if (!isDragging) return; const dx = e.clientX - lastMousePos.x; const dy = e.clientY - lastMousePos.y; setPan(prev => ({ x: prev.x + dx, y: prev.y + dy })); setLastMousePos({ x: e.clientX, y: e.clientY }); };
  const handleMouseUp = () => setIsDragging(false);
  const handleWheel = (e) => { const scaleAdjustment = -e.deltaY * 0.001; setZoom(prev => Math.min(Math.max(0.5, prev + scaleAdjustment), 5)); };

  // Portfolio
  const updateWeight = (slotId, newWeightVal) => {
    const newWeight = Number(newWeightVal);
    const otherWeights = portfolio.filter(p => p.id !== slotId).reduce((acc, curr) => acc + curr.weight, 0);
    if (otherWeights + newWeight <= 100) setPortfolio(prev => prev.map(p => p.id === slotId ? { ...p, weight: newWeight } : p));
    else setPortfolio(prev => prev.map(p => p.id === slotId ? { ...p, weight: 100 - otherWeights } : p));
  };
  const assignNodeToPortfolio = (slotId) => selectedNode && setPortfolio(prev => prev.map(p => p.id === slotId ? { ...p, node: selectedNode } : p));
  const clearPortfolioSlot = (slotId) => setPortfolio(prev => prev.map(p => p.id === slotId ? { ...p, node: null } : p));

  // Backtest
  const runBacktest = () => {
    setIsSimulating(true);
    setTimeout(() => {
      let weightedRoi = 0, totalPnl = 0, weightedWinRate = 0;
      portfolio.forEach(p => {
        if (p.node) {
          const nodeRoi = (Math.random() * 40 - 5);
          const nodePnl = (Math.random() * 5000);
          weightedRoi += nodeRoi * (p.weight / 100);
          totalPnl += nodePnl * (p.weight / 100);
          weightedWinRate += parseFloat(p.node.winRate) * (p.weight / 100);
        }
      });
      setBacktestResults({ roi: weightedRoi.toFixed(2), pnl: totalPnl.toFixed(0), trades: Math.floor(Math.random() * 50) + 20, winRate: weightedWinRate.toFixed(1), chartData: [{name:'Start',value:10000},{name:'W1',value:10000*(1+weightedRoi*0.25/100)},{name:'W2',value:10000*(1+weightedRoi*0.5/100)},{name:'W3',value:10000*(1+weightedRoi*0.75/100)},{name:'End',value:10000*(1+weightedRoi/100)}] });
      setIsSimulating(false);
    }, 1200);
  };

  // AI
  async function callGemini(prompt, systemContext, key) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: `Crypto Analyst. Context: ${systemContext}` }] } }) });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Unavailable.";
    } catch (error) { return `Error: ${error.message}`; }
  }
  const getSystemContext = () => JSON.stringify({ statsChain, filters: { startDate, endDate, totalVolMin }, visibleNodes: processedNodes.filter(n => n.isMatch).length, portfolio: portfolio.map(p => ({ id: p.id, address: p.node?.id, weight: p.weight })) });
  const handleSendMessage = async () => {
    if (!aiInput.trim() || !userApiKey) return;
    const userMsg = aiInput; setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]); setAiInput(''); setIsAiThinking(true);
    const response = await callGemini(userMsg, getSystemContext(), userApiKey);
    setAiMessages(prev => [...prev, { role: 'assistant', text: response }]); setIsAiThinking(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30 flex overflow-hidden relative">
      {/* Aurora Background Effect */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[100px] animate-pulse-slow" style={{animationDelay: '4s'}}></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'w-20' : 'w-80'} bg-slate-900/40 backdrop-blur-2xl border-r border-white/10 transform transition-all duration-500 ease-out flex flex-col shadow-2xl`}>
         <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-gradient-to-b from-white/5 to-transparent">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.6)] bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0 transition-transform hover:scale-110 duration-300">
              <Database size={20} className="text-white" />
            </div>
            {!isSidebarCollapsed && <span className="text-lg font-bold text-white tracking-tight animate-in fade-in slide-in-from-left-4 duration-500">ChainInsight</span>}
          </div>

          {!isSidebarCollapsed && (
            <div className="grid grid-cols-2 gap-1 bg-black/20 p-1.5 rounded-2xl border border-white/5">
              {['Atom', 'AtomOne'].map(chain => (
                <button
                  key={chain}
                  onClick={() => setStatsChain(chain)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${statsChain === chain ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/20 scale-[1.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                  {chain.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute top-6 -right-3 p-1.5 bg-slate-800 border border-white/20 rounded-full text-slate-400 hover:text-white hover:bg-indigo-600 transition-all shadow-lg z-50">
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {isSidebarCollapsed ? (
             <div className="flex flex-col items-center gap-6 mt-4 animate-in fade-in duration-500">
               <Calendar size={20} className="text-slate-500" />
               <DollarSign size={20} className="text-slate-500" />
               <BarChart2 size={20} className="text-slate-500" />
               <Globe size={20} className="text-slate-500" />
               <Zap size={20} className="text-slate-500" />
               <Share2 size={20} className="text-slate-500" />
             </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500 space-y-1">
              {/* Filters... (Same as before) */}
              <FilterSection title="0. Period" icon={Calendar}>
                <div className="flex gap-1 mb-3 bg-black/20 p-1 rounded-xl">
                  {['7D', '30D', '90D', '180D'].map(d => (
                    <button key={d} onClick={() => setPeriodPreset(d)} className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all ${periodPreset === d ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>{d}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-indigo-500 transition-colors" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:border-indigo-500 outline-none transition-colors" />
                </div>
              </FilterSection>

              <FilterSection title="1. Scale" icon={DollarSign}>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>Min Vol</span><span className="text-white font-mono">${totalVolMin.toLocaleString()}</span></div>
                    <input type="range" min="0" max="200000" step="1000" value={totalVolMin} onChange={(e) => setTotalVolMin(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>Min Avg Tx</span><span className="text-white font-mono">${avgTxSizeMin.toLocaleString()}</span></div>
                    <input type="range" min="0" max="10000" step="100" value={avgTxSizeMin} onChange={(e) => setAvgTxSizeMin(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                </div>
              </FilterSection>

              <FilterSection title="2. Behavior" icon={BarChart2} isOpenDefault={false}>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>Net Buy Ratio</span><span className="text-white">{netBuyRatio}</span></div>
                    <input type="range" min="-1" max="1" step="0.1" value={netBuyRatio} onChange={(e) => setNetBuyRatio(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>Min Tx Count</span><span className="text-white">{txFreqMin}</span></div>
                    <input type="range" min="0" max="100" value={txFreqMin} onChange={(e) => setTxFreqMin(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                </div>
              </FilterSection>

              <FilterSection title="3. Chain" icon={Globe} isOpenDefault={false}>
                <div className="space-y-3">
                  {['ATOM Share', 'ONE Share', 'IBC Ratio'].map((label, idx) => {
                    const val = idx === 0 ? atomShareMin : idx === 1 ? atomOneShareMin : ibcRatioMin;
                    const setVal = idx === 0 ? setAtomShareMin : idx === 1 ? setAtomOneShareMin : setIbcRatioMin;
                    const color = idx === 0 ? 'accent-indigo-400' : idx === 1 ? 'accent-orange-400' : 'accent-emerald-400';
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>{label}</span><span className="text-white">{(val*100).toFixed(0)}%</span></div>
                        <input type="range" min="0" max="1" step="0.1" value={val} onChange={(e) => setVal(Number(e.target.value))} className={`w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer ${color}`} />
                      </div>
                    );
                  })}
                </div>
              </FilterSection>

              <FilterSection title="4. Activity" icon={Zap} isOpenDefault={false}>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>Active Days</span><span className="text-white">{activeDaysMin}+</span></div>
                  <input type="range" min="1" max="30" value={activeDaysMin} onChange={(e) => setActiveDaysMin(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                </div>
                <div className="mt-3">
                  <div className="flex bg-black/20 border border-white/5 rounded-lg p-1">
                    {['3D', '7D', '30D', 'All'].map(t => (
                      <button key={t} onClick={() => setRecentActive(t)} className={`flex-1 text-[9px] py-1.5 rounded-md transition-all ${recentActive === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </FilterSection>

              <FilterSection title="5. Influence" icon={Share2} isOpenDefault={false}>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1.5"><span>AII Score</span><span className="text-white">{aiiScoreMin}</span></div>
                  <input type="range" min="0" max="100" value={aiiScoreMin} onChange={(e) => setAiiScoreMin(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                </div>
                <div className="mt-3">
                  <div className="flex bg-black/20 border border-white/5 rounded-lg p-1">
                    {['Lead', 'Sync', 'Lag', 'All'].map(t => (
                      <button key={t} onClick={() => setTimingType(t === 'Lead' ? 'Leading' : t === 'Lag' ? 'Lagging' : t)} className={`flex-1 text-[9px] py-1.5 rounded-md transition-all ${timingType.startsWith(t) || timingType === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </FilterSection>
            </div>
          )}
        </div>
      </aside>

      {/* --- Content --- */}
      <main className={`flex-1 h-screen overflow-y-auto bg-transparent relative flex flex-col transition-all duration-500 ${isSidebarCollapsed ? 'ml-20' : 'lg:ml-80'}`}>
        <div className="flex-1 p-6 lg:p-8 max-w-[1800px] mx-auto w-full space-y-6 relative z-10">

          {/* Header Row with Stats */}
          <div className="flex justify-between items-end mb-2">
             <div>
                <h1 className="text-2xl font-bold text-white mb-1">Market Overview</h1>
                <p className="text-slate-400 text-xs flex items-center gap-2">
                  Data Source: Mintscan / CoinGecko
                  {isLive && (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold animate-pulse">
                      <Wifi size={10} /> Live Updates
                    </span>
                  )}
                </p>
             </div>
             <div className="flex gap-2">
               <button onClick={() => setIsLive(!isLive)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${isLive ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                 {isLive ? 'Live: ON' : 'Live: OFF'}
               </button>
             </div>
          </div>

          {/* Stats Row */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {[{l:`${statsChain} Price`,v:currentStatsData.price,p:'$'},{l:'Market Cap',v:(currentStatsData.marketCap/1000000).toFixed(0),p:'$',s:'M'},{l:'APR',v:currentStatsData.apr,s:'%'},{l:'Bonded',v:((currentStatsData.bonded/currentStatsData.supply)*100).toFixed(1),s:'%'}].map((s,i) => (
               <GlassCard key={i} hoverEffect className="p-6">
                 <StatItem label={s.l} value={s.v} prefix={s.p} suffix={s.s} change={i===0?0.47:null} />
               </GlassCard>
             ))}
          </section>

          {/* 2. MIDDLE ROW: Chart + Detail (Strict Horizontal Layout) */}
          <section className="flex flex-row gap-6 h-[600px] overflow-hidden">

            {/* Left: Bubble Chart Area */}
            <GlassCard className="flex-1 min-w-0 relative p-0 overflow-hidden flex flex-col">
              {/* Chart Header */}
              <div className="absolute top-6 left-6 z-20 pointer-events-none bg-black/40 p-4 rounded-2xl backdrop-blur-xl border border-white/10 shadow-lg">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <Share2 size={18} className="text-indigo-400" /> Holder Ecosystem Map
                </h3>
                <p className="text-[11px] text-slate-300 mb-3">
                  X: ATOM Share • Y: {yAxisConfig.label} (Log) • Size: Holdings
                </p>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div> <span className="text-slate-300">ATOM</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div> <span className="text-slate-300">ONE</span></div>
                  <div className="flex items-center gap-2 font-bold text-emerald-400"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div> Dual</div>
                </div>
              </div>

              {/* Interactive SVG Canvas */}
              <div className="w-full h-full cursor-move bg-[#050b14]/30 relative overflow-hidden">
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>
                <svg
                  className="w-full h-full relative z-10"
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
                >
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Grid & Labels */}
                    {[yAxisConfig.min, yAxisConfig.min*10, yAxisConfig.min*100, yAxisConfig.min*1000, yAxisConfig.max].map(val => (
                      <g key={val}>
                        <line x1={CHART_PADDING} y1={getY(val)} x2={CHART_WIDTH-CHART_PADDING} y2={getY(val)} stroke="#334155" strokeDasharray="4 4" strokeWidth="0.5" />
                        <text x={CHART_PADDING-10} y={getY(val)+3} textAnchor="end" fontSize="8" fill="#64748b" fontWeight="bold">${val.toLocaleString()}</text>
                      </g>
                    ))}
                    {[0, 0.25, 0.5, 0.75, 1].map(val => (
                      <g key={val}>
                        <line x1={getX(val)} y1={CHART_HEIGHT-CHART_PADDING} x2={getX(val)} y2={CHART_PADDING} stroke="#334155" strokeDasharray="4 4" strokeWidth="0.5" />
                        <text x={getX(val)} y={CHART_HEIGHT-CHART_PADDING+15} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="bold">{val}</text>
                      </g>
                    ))}
                    <line x1={getX(0.5)} y1={CHART_PADDING} x2={getX(0.5)} y2={CHART_HEIGHT-CHART_PADDING} stroke="#4f46e5" strokeWidth="1" strokeOpacity="0.5" />

                    {/* Bubbles */}
                    {processedNodes.map((node) => (
                      <g
                        key={node.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
                        className="cursor-pointer transition-all duration-700 ease-out"
                        style={{ opacity: node.isMatch ? 1 : 0.35, transitionProperty: 'opacity, transform' }}
                      >
                        <circle
                          cx={node.cx} cy={node.cy} r={node.r}
                          fill={node.isMatch ? node.fill : '#334155'}
                          filter={node.isMatch ? "url(#glow)" : ""}
                          stroke={selectedNode?.id === node.id ? '#fff' : 'none'} strokeWidth={2}
                          className="hover:scale-110 transition-transform duration-200 origin-center"
                        />
                        {selectedNode?.id === node.id && (
                          <circle cx={node.cx} cy={node.cy} r={node.r + 6} fill="none" stroke="white" strokeOpacity="0.6" strokeDasharray="3 2" className="animate-spin-slow" />
                        )}
                      </g>
                    ))}
                  </g>
                </svg>
              </div>

              <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
                  <button onClick={() => setZoom(Math.min(zoom + 0.5, 5))} className="p-3 bg-black/40 backdrop-blur-md rounded-xl text-white hover:bg-white/10 border border-white/10 shadow-lg transition-all"><ZoomIn size={18}/></button>
                  <button onClick={() => setZoom(Math.max(zoom - 0.5, 0.5))} className="p-3 bg-black/40 backdrop-blur-md rounded-xl text-white hover:bg-white/10 border border-white/10 shadow-lg transition-all"><ZoomOut size={18}/></button>
                  <button onClick={() => {setPan({x:0,y:0}); setZoom(1);}} className="p-3 bg-black/40 backdrop-blur-md rounded-xl text-white hover:bg-white/10 border border-white/10 shadow-lg transition-all" title="Reset"><Move size={18}/></button>
              </div>
            </GlassCard>

            {/* Right: Detail Panel (Fixed Width) */}
            <GlassCard className="w-96 flex flex-col flex-shrink-0 overflow-hidden p-0 border-l-0 lg:border-l border-white/10 h-full">
              <div className="p-6 border-b border-white/10 bg-white/5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Info size={16} className="text-indigo-400"/> Account Details
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/20">
                {selectedNode ? (
                  <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: selectedNode.fill, color: selectedNode.fill }}></div>
                        <span className="text-xs font-bold uppercase text-slate-300 tracking-wider">{selectedNode.type}</span>
                      </div>
                      <h2 className="text-2xl font-black text-white truncate font-mono tracking-tight">{selectedNode.id}</h2>
                    </div>

                    <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Total Holdings</span>
                        <span className="font-bold text-white text-lg">${parseInt(selectedNode.balance).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-black/40 rounded-full h-2 flex overflow-hidden border border-white/5">
                        <div className="bg-blue-500 h-full shadow-[0_0_10px_#3b82f6]" style={{ width: `${selectedNode.atomShare * 100}%` }}></div>
                        <div className="bg-orange-500 h-full shadow-[0_0_10px_#f97316]" style={{ width: `${selectedNode.atomOneShare * 100}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-medium text-slate-400">
                        <span className="text-blue-400">ATOM {(selectedNode.atomShare * 100).toFixed(0)}%</span>
                        <span className="text-orange-400">ONE {(selectedNode.atomOneShare * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[{l:'AII Score',v:selectedNode.aiiScore,c:'text-emerald-400'},{l:'Activity',v:`${selectedNode.activeDays}d`,c:'text-white'},{l:'Correlation',v:selectedNode.correlation.toFixed(2),c:'text-indigo-400'},{l:'Win Rate',v:`${selectedNode.winRate}%`,c:'text-white'}].map((item, i) => (
                        <div key={i} className="bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase">{item.l}</div>
                          <div className={`text-lg font-bold ${item.c}`}>{item.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-white/10">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Quick Add to Portfolio</h4>
                      <div className="flex gap-2">
                        {portfolio.map(slot => (
                          <button
                            key={slot.id}
                            onClick={() => { assignNodeToPortfolio(slot.id); document.getElementById('backtest-section').scrollIntoView({ behavior: 'smooth' }); }}
                            className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-900 hover:scale-105 hover:brightness-110 transition-all shadow-lg"
                            style={{ backgroundColor: slot.color }}
                          >
                            Slot {slot.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center mb-4 border border-white/5 animate-pulse">
                        <MousePointer2 size={36} strokeWidth={1} />
                    </div>
                    <p className="text-sm font-medium text-center">Select a bubble to view<br/>on-chain insights.</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </section>

          {/* 2. Backtest Section */}
          <section id="backtest-section" className="pb-4">
             <GlassCard className="border-t-4 border-t-emerald-500/50">
               {/* ... Existing Backtest Code ... */}
               <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4 border-b border-white/5 pb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                       <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"><PieChart size={24} /></div>
                       Portfolio Strategy Backtest
                     </h3>
                     <p className="text-sm text-slate-400 mt-1 pl-11">Simulate historical performance with custom weights.</p>
                  </div>
                   <div className={`text-sm font-bold px-5 py-2.5 rounded-xl border backdrop-blur-md ${totalWeight === 100 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                     Total: {totalWeight}% {totalWeight < 100 && <span className="text-amber-400 ml-1">(Left: {100 - totalWeight}%)</span>}
                   </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {portfolio.map((slot) => (
                   <div key={slot.id} className="bg-black/20 rounded-2xl p-5 border border-white/5 relative group hover:border-white/20 transition-all hover:bg-white/5">
                      <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl opacity-80" style={{ backgroundColor: slot.color }}></div>
                      <div className="pl-4">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-slate-900 shadow-md" style={{ backgroundColor: slot.color }}>{slot.id}</div>
                            <span className="text-sm font-bold text-white">Account {slot.id}</span>
                          </div>
                          {slot.node && <button onClick={() => clearPortfolioSlot(slot.id)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>}
                        </div>
                        {slot.node ? (
                          <div className="mb-5 bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="text-xs font-mono text-white truncate mb-2" title={slot.node.id}>{slot.node.id}</div>
                            <div className="flex gap-2 text-[10px]">
                              <span className="px-2 py-1 bg-black/40 rounded-md text-slate-300">Win: <span className="text-emerald-400">{slot.node.winRate}%</span></span>
                              <span className="px-2 py-1 bg-black/40 rounded-md text-slate-300">Bal: <span className="text-white">${parseInt(slot.node.balance/1000)}k</span></span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-20 flex items-center justify-center text-xs text-slate-600 italic mb-5 border border-dashed border-slate-800 rounded-xl bg-white/5">Empty Slot</div>
                        )}
                        <div>
                          <div className="flex justify-between text-xs mb-2"><span className="text-slate-400 font-medium">Weight</span><span className="text-white font-bold">{slot.weight}%</span></div>
                          <input type="range" min="0" max="100" step="5" value={slot.weight} onChange={(e) => updateWeight(slot.id, e.target.value)} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" style={{ accentColor: slot.color }} />
                        </div>
                      </div>
                   </div>
                 ))}
               </div>

               <div className="mt-8 flex flex-col lg:flex-row gap-8">
                 <div className="lg:w-72 flex flex-col gap-4">
                   <button onClick={runBacktest} disabled={isSimulating || totalWeight === 0} className={`flex-1 w-full py-6 rounded-2xl font-bold text-white shadow-xl transition-all flex flex-col items-center justify-center gap-3 ${isSimulating ? 'bg-slate-800 cursor-wait text-slate-400' : 'bg-gradient-to-br from-emerald-600 to-teal-800 hover:scale-[1.02] active:scale-95 border border-emerald-500/30'}`}>
                     {isSimulating ? <Loader2 className="animate-spin w-8 h-8" /> : <><div className="p-3 bg-white/10 rounded-full"><PlayCircle size={32}/></div><span className="text-lg">Run Simulation</span></>}
                   </button>
                   {backtestResults && (
                      <div className="bg-emerald-900/20 p-5 rounded-2xl border border-emerald-500/30 text-center animate-in fade-in zoom-in duration-300">
                        <div className="text-xs text-emerald-200 uppercase mb-1 font-bold tracking-wide">Portfolio Return</div>
                        <div className="text-4xl font-black text-emerald-400 tracking-tighter drop-shadow-lg">+{backtestResults.roi}%</div>
                        <div className="text-xs text-emerald-200/60 mt-2 pt-2 border-t border-emerald-500/20">Est. PnL: +${parseInt(backtestResults.pnl).toLocaleString()}</div>
                      </div>
                   )}
                 </div>
                 <div className="flex-1 h-72 bg-black/20 rounded-2xl border border-white/5 p-4">
                   {backtestResults ? (
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={backtestResults.chartData}><defs><linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} /><XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} /><Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fill="url(#colorPnl)" /></AreaChart>
                     </ResponsiveContainer>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60"><BarChart3 size={48} strokeWidth={1} className="mb-3"/><p className="text-sm">Run simulation to view performance curve</p></div>
                   )}
                 </div>
               </div>
             </GlassCard>
          </section>

          {/* 3. Market Overview (Moved Bottom) */}
          <div className="mt-8 pt-8 border-t border-white/10 pb-12">
             <div className="flex justify-between items-end mb-6">
               <div>
                  <h1 className="text-2xl font-bold text-white mb-1">Market Overview</h1>
                  <p className="text-slate-400 text-xs flex items-center gap-2">
                    Data Source: Mintscan / CoinGecko
                    {isLive && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold animate-pulse">
                        <Wifi size={10} /> Live Updates
                      </span>
                    )}
                  </p>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setIsLive(!isLive)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${isLive ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                   {isLive ? 'Live: ON' : 'Live: OFF'}
                 </button>
               </div>
            </div>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {[{l:`${statsChain} Price`,v:currentStatsData.price,p:'$'},{l:'Market Cap',v:(currentStatsData.marketCap/1000000).toFixed(0),p:'$',s:'M'},{l:'APR',v:currentStatsData.apr,s:'%'},{l:'Bonded',v:((currentStatsData.bonded/currentStatsData.supply)*100).toFixed(1),s:'%'}].map((s,i) => (
                 <GlassCard key={i} hoverEffect className="p-6">
                   <StatItem label={s.l} value={s.v} prefix={s.p} suffix={s.s} change={i===0?0.47:null} />
                 </GlassCard>
               ))}
            </section>
          </div>

        </div>

        {/* AI Chat Overlay */}
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${showAIChat ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <GlassCard className="w-80 sm:w-96 h-[500px] flex flex-col overflow-hidden p-0 border-white/20 shadow-2xl">
            <div className={`p-4 bg-indigo-600/90 backdrop-blur flex justify-between items-center`}>
              <div className="flex items-center gap-2 text-white">
                <Bot size={20} />
                <span className="font-bold text-sm">ChainInsight AI Analyst</span>
              </div>
              <button onClick={() => setShowAIChat(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>

            {!userApiKey && (
              <div className="p-4 bg-amber-500/10 border-b border-amber-500/20">
                 <div className="flex items-center gap-2 text-amber-400 mb-2 text-xs font-bold uppercase tracking-wider"><Key size={12} /> API Key Required</div>
                 <div className="flex gap-2">
                   <input type="password" placeholder="Paste key..." value={tempApiKeyInput} onChange={(e) => setTempApiKeyInput(e.target.value)} className="flex-1 bg-slate-950 border border-amber-500/30 rounded px-2 py-1.5 text-xs text-white outline-none" />
                   <button onClick={() => userApiKey ? null : setUserApiKey(tempApiKeyInput)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold rounded">Save</button>
                 </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl text-xs sm:text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiThinking && <div className="text-xs text-slate-500 ml-4 animate-pulse">Thinking...</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
               <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask AI..." disabled={!userApiKey} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors" />
               <button onClick={handleSendMessage} disabled={!aiInput.trim() || !userApiKey} className={`p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-md`}><Send size={16} /></button>
            </div>
          </GlassCard>
        </div>

        {!showAIChat && (
          <button onClick={() => setShowAIChat(true)} className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-indigo-600 text-white shadow-2xl hover:scale-110 hover:shadow-indigo-500/50 transition-all duration-300`}>
            <MessageSquare size={24} />
          </button>
        )}

      </main>
    </div>
  );
}
