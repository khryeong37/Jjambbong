import React, { useEffect, useState, useRef } from 'react';
import { NodeData } from '../types';
import { Layers, Activity, Sparkles, TrendingUp, BarChart2, Info, CheckCircle, PlusCircle, Replace } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface NodeIntelligenceProps {
  selectedNode: NodeData | null;
  slots: { id: string; node: NodeData | null; weight: number; color: string }[];
  setSlots: React.Dispatch<React.SetStateAction<{ id: string; node: NodeData | null; weight: number; color: string }[]>>;
  isLoadingDetail?: boolean;
}

const NodeIntelligence: React.FC<NodeIntelligenceProps> = ({ selectedNode, slots, setSlots, isLoadingDetail = false }) => {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const prevNodeId = useRef<string | null>(null);


  // Trigger animation when node changes
  useEffect(() => {
    if (selectedNode && selectedNode.id !== prevNodeId.current) {
      setAnimationKey(prev => prev + 1);
      prevNodeId.current = selectedNode.id;
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedNode) {
      setSummary("");
      return;
    }

    const generateSummary = async () => {
      setLoading(true);
      if (process.env.API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Analyze crypto account "${selectedNode.name}". 
          Stats: Impact Score ${Math.floor(selectedNode.size)}/100, Bias: ${selectedNode.bias}.
          Transaction breakdown: ${selectedNode.composition.swap}% Swap, ${selectedNode.composition.ibc}% IBC, ${selectedNode.composition.stake}% Stake.
          Write a professional 2-sentence financial insight explaining why this account is influential.`;
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          setSummary(response.text || "Analysis unavailable.");
        } catch (e) {
          console.error(e);
          setSummary("AI Analysis unavailable (Check API Key).");
        }
      } else {
        // Enhanced fallback analysis without API
        const impactLevel = selectedNode.size >= 70 ? 'high' : selectedNode.size >= 40 ? 'moderate' : 'emerging';
        const strategyType = selectedNode.composition.swap > 50 ? 'active trading' : selectedNode.composition.stake > 40 ? 'staking-focused' : 'balanced';
        const timingDesc = selectedNode.timing === 'LEADING' ? 'price movements' : selectedNode.timing === 'LAGGING' ? 'trends' : 'market conditions';
        
        setSummary(`This ${impactLevel}-impact account (AII: ${Math.floor(selectedNode.size)}) shows ${strategyType} behavior with ${selectedNode.composition.swap}% swap, ${selectedNode.composition.ibc}% IBC, and ${selectedNode.composition.stake}% stake activity. The ${selectedNode.bias} ecosystem bias and ${selectedNode.timing.toLowerCase()} timing pattern suggest ${selectedNode.netBuyRatio > 0 ? 'accumulation' : 'distribution'} strategy.`);
      }
      setLoading(false);
    };

    generateSummary();
  }, [selectedNode]);

  const handleAssignToSlot = (slotId: string) => {
    if (!selectedNode) return;
    setSlots(prevSlots => prevSlots.map(slot => 
      slot.id === slotId ? { ...slot, node: selectedNode } : slot
    ));
  };

  if (!selectedNode) {
    return (
      <div className="h-full bg-white/80 dark:bg-white/6 backdrop-blur-2xl rounded-[32px] p-6 flex flex-col items-center justify-center text-center" style={{
        boxShadow: 'none',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
         <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-gray-100 dark:border-[#4ED6E6]/20"
         style={{}}>
            <Layers size={32} className="text-gray-300 dark:text-white/70" />
         </div>
         <h3 className="text-xs font-bold text-gray-400 dark:text-white/80 uppercase tracking-[0.2em]">Select a Node</h3>
         <p className="text-[10px] text-gray-300 dark:text-white/70 mt-2">Click on any bubble to view intelligence</p>
      </div>
    );
  }

  const compositionData = [
    { name: 'Swap', value: selectedNode.composition.swap, color: '#60A5FA' },
    { name: 'IBC', value: selectedNode.composition.ibc, color: '#A78BFA' },
    { name: 'Stake', value: selectedNode.composition.stake, color: '#4B5563' },
  ];
  const historyData = selectedNode.history ?? [];

  return (
    <div key={animationKey} className="h-full glass-card-light dark:glass-card-dark rounded-[32px] flex flex-col relative overflow-hidden" style={{ 
      height: '100%', 
      maxHeight: '100%', 
      borderRadius: '32px', 
      isolation: 'isolate',
      boxShadow: 'none',
      border: '1px solid rgba(200, 215, 232, 0.14)',
    }}>
      {/* Header */}
      <div 
        className="px-6 py-5 border-b border-white/20 dark:border-[#4ED6E6]/20 flex-shrink-0 relative node-intel-animate"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animationDelay: '0ms',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-indigo-50 dark:bg-white/5 p-1.5 rounded-lg shadow-sm" style={{
            border: 'none'
          }}><Layers size={12} className="text-indigo-500 dark:text-white/70" /></div>
          <h2 className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-widest">Node Intelligence</h2>
        </div>
        <h1 
          className="text-2xl font-black text-gray-900 dark:text-aether-dark-text truncate tracking-tight node-intel-title"
          style={{ animationDelay: '50ms' }}
        >
          {selectedNode.name}
        </h1>
        <div className="flex gap-2 mt-3 node-intel-section" style={{ animationDelay: '100ms' }}>
           <span className={`text-[9px] font-bold px-3 py-1 rounded-full shadow-sm ${selectedNode.bias === 'ATOM' ? 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400' : selectedNode.bias === 'ATOMONE' ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-500 dark:text-purple-400'}`}>
             {selectedNode.bias} ECOSYSTEM
           </span>
           <span className="text-[9px] font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
             IMPACT SCORE: {Math.floor(selectedNode.size)}
           </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar" style={{ minHeight: 0, maxHeight: '100%', padding: '1.5rem', paddingRight: '1.5rem', marginRight: '0' }}>
        
        {/* 1. Price & Net Flow Chart */}
        {isLoadingDetail && (
          <div className="text-[10px] font-semibold text-amber-500 px-6">
            Fetching detailed history...
          </div>
        )}

        <div className="space-y-3 node-intel-section" style={{ animationDelay: '150ms' }}>
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">Price vs Net Flow</span>
             <div className="bg-gray-50 p-1 rounded" style={{}}><TrendingUp size={12} className="text-gray-400" /></div>
           </div>
           <div className="h-40 rounded-2xl p-4 relative overflow-hidden glass-input node-intel-chart" style={{ animationDelay: '200ms' }}>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/50 dark:to-black/20 pointer-events-none"></div>
              <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={historyData}>
                    <Tooltip 
                       contentStyle={{
                         backgroundColor: 'hsl(0 0% 100% / 0.8)', 
                         border: '1px solid hsl(0 0% 100% / 0.1)', 
                         backdropFilter: 'blur(8px)', 
                         borderRadius: '12px', 
                         fontSize: '10px', 
                         boxShadow: '0 4px 12px rgba(196, 181, 253, 0.2)',
                         color: '#374151'
                       }}
                       itemStyle={{
                         color: '#374151', 
                         padding: 0, 
                         fontWeight: 600
                       }}
                       labelStyle={{display: 'none'}}
                       formatter={(value, name) => {
                         if (name === 'price') {
                           return [`${(value as number).toFixed(2)} Ξ`, 'Price'];
                         }
                         return [value as number, name];
                       }}
                    />
                    <XAxis dataKey="date" hide />
                    <Bar dataKey="netFlow" barSize={6} radius={[2, 2, 0, 0]}>
                      {historyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.netFlow > 0 ? '#EF4444' : '#0EA5E9'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#9CA3AF"
                      strokeWidth={2}
                      dot={false}
                    />
                 </ComposedChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* 2. Transaction Composition (Donut) */}
        <div className="space-y-3 node-intel-section" style={{ animationDelay: '300ms' }}>
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-white/80 uppercase tracking-wider">On-Chain Behavior</span>
             <div className="bg-gray-50 p-1 rounded" style={{}}><Activity size={12} className="text-gray-400" /></div>
           </div>
           <div className="flex items-center gap-6 bg-gray-50 dark:bg-white/5 rounded-2xl p-4 border border-gray-100 dark:border-[#4ED6E6]/20 node-intel-chart" style={{ 
             animationDelay: '350ms',
           }}>
              <div className="w-24 h-24 relative flex-shrink-0 node-intel-pie">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie data={compositionData} innerRadius={30} outerRadius={40} paddingAngle={4} cornerRadius={4} dataKey="value" stroke="none">
                       {compositionData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                   </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xs font-black text-gray-800 dark:text-aether-dark-text">{selectedNode.composition.swap}%</span>
                          <span className="text-[8px] font-bold text-gray-400 dark:text-white/80 uppercase">SWAP</span>
                 </div>
              </div>
              <div className="flex-1 space-y-2">
                 {compositionData.map((d, i) => (
                   <div 
                     key={d.name} 
                     className="flex justify-between items-center text-[10px] node-intel-list-item"
                     style={{ animationDelay: `${400 + i * 50}ms` }}
                   >
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: d.color}}></div>
                         <span className="font-bold text-gray-500 dark:text-white/80 uppercase tracking-wide">{d.name}</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-aether-dark-text">{d.value}%</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* 3. AII Summary & AI Text */}
        <div className="space-y-4 pb-4 node-intel-section" style={{ animationDelay: '500ms' }}>
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-gray-200 uppercase tracking-wider">AII Impact Analysis</span>
             <div className="bg-gray-50 p-1 rounded" style={{}}><BarChart2 size={12} className="text-gray-400" /></div>
           </div>
           
           {/* Score Breakdown */}
           <div className="grid grid-cols-3 gap-2">
             {[
               { label: 'Volume', value: Math.floor(selectedNode.scaleScore), color: 'text-gray-800 dark:text-gray-100' },
               { label: 'Timing', value: Math.floor(selectedNode.timingScore), color: 'text-sky-600 dark:text-sky-400' },
               { label: 'Correlation', value: `${selectedNode.correlationScore > 0 ? '+' : ''}${selectedNode.correlationScore.toFixed(2)}`, color: 'text-purple-600 dark:text-purple-400' },
             ].map((item, i) => (
               <div 
                 key={item.label}
                 className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl text-center border border-gray-100 dark:border-[#4ED6E6]/20 node-intel-score"
                 style={{
                   animationDelay: `${550 + i * 80}ms`,
                 }}
               >
                  <div className="text-[8px] text-gray-400 dark:text-white/70 uppercase mb-1 font-bold">{item.label}</div>
                  <div className={`text-sm font-black ${item.color} node-intel-number`}>{item.value}</div>
             </div>
             ))}
           </div>

           {/* AI Insight */}
           <div 
             className="p-[2px] rounded-2xl relative overflow-hidden group node-intel-ai"
             style={{
               background: 'linear-gradient(135deg, #10b981, #059669)',
               animationDelay: '750ms',
             }}
           >
              <div className="dark:hidden bg-white/90 backdrop-blur-sm rounded-[14px] p-4">
                 <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 p-1.5 rounded-lg backdrop-blur-sm border border-emerald-400/30">
                      <Sparkles size={14} className="text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-gray-800 leading-relaxed font-medium">
                      {loading ? "Generating analysis..." : summary || "Select a node to view AI analysis."}
                    </p>
                 </div>
              </div>
              <div className="hidden dark:block bg-slate-900/90 backdrop-blur-sm rounded-[14px] p-4">
                 <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 p-1.5 rounded-lg backdrop-blur-sm border border-emerald-500/30">
                      <Sparkles size={14} className="text-emerald-400" />
                    </div>
                    <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                   {loading ? "Generating analysis..." : summary || "Select a node to view AI analysis."}
                 </p>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* Assign to Simulation - Fixed Bottom */}
      <div className="px-6 py-5 border-t border-white/20 dark:border-[#4ED6E6]/20 flex-shrink-0 relative" style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottomLeftRadius: '32px',
        borderBottomRightRadius: '32px'
      }}>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot, slotIndex) => {
            const isOccupied = !!slot.node;
            const isCurrentNodeInSlot = isOccupied && slot.node!.id === selectedNode.id;
            
            let buttonText = `Slot ${slot.id}`;
            let ButtonIcon = PlusCircle;
            let buttonClass = 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/70 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 border-gray-100 dark:border-[#4ED6E6]/20';

            if (isCurrentNodeInSlot) {
              buttonText = 'Assigned';
              ButtonIcon = CheckCircle;
              buttonClass = 'bg-[#5A7FFF]/10 dark:bg-[#5A7FFF]/15 text-[#5A7FFF] dark:text-[#5A7FFF] border-[#5A7FFF]/20 dark:border-[#5A7FFF]/30';
            } else if (isOccupied) {
              buttonText = 'Replace';
              ButtonIcon = Replace;
              buttonClass = 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border-amber-100 dark:border-amber-500/20';
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
