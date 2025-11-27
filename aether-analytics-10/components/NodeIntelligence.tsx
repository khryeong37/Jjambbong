import React, { useEffect, useState } from 'react';
import { NodeData } from '../types';
import { Layers, Activity, Sparkles, TrendingUp, BarChart2, Info, CheckCircle, PlusCircle, Replace } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface NodeIntelligenceProps {
  selectedNode: NodeData | null;
  slots: { id: string; node: NodeData | null; weight: number; color: string }[];
  setSlots: React.Dispatch<React.SetStateAction<{ id: string; node: NodeData | null; weight: number; color: string }[]>>;
}

const NodeIntelligence: React.FC<NodeIntelligenceProps> = ({ selectedNode, slots, setSlots }) => {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);

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
        setSummary(`Account ${selectedNode.name} demonstrates high conviction with ${selectedNode.composition.swap}% swap activity. Its alignment with ${selectedNode.bias} suggests strategic accumulation.`);
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
      <div className="h-full bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-2xl rounded-[32px] shadow-float dark:shadow-float-dark border border-white/60 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center">
         <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-gray-100 dark:border-white/5">
            <Layers size={32} className="text-gray-300 dark:text-gray-700" />
         </div>
         <h3 className="text-xs font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-[0.2em]">Select a Node</h3>
         <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-2">Click on any bubble to view intelligence</p>
      </div>
    );
  }

  const compositionData = [
    { name: 'Swap', value: selectedNode.composition.swap, color: '#60A5FA' },
    { name: 'IBC', value: selectedNode.composition.ibc, color: '#A78BFA' },
    { name: 'Stake', value: selectedNode.composition.stake, color: '#4B5563' },
  ];

  return (
    <div className="h-full bg-white/80 dark:bg-aether-dark-card/80 backdrop-blur-2xl rounded-[32px] shadow-float dark:shadow-float-dark border border-white/60 dark:border-white/10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-50 dark:border-white/5 flex-shrink-0 bg-white/50 dark:bg-transparent backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-1.5 rounded-lg shadow-sm"><Layers size={12} className="text-indigo-500 dark:text-indigo-400" /></div>
          <h2 className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-widest">Node Intelligence</h2>
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-aether-dark-text truncate tracking-tight">{selectedNode.name}</h1>
        <div className="flex gap-2 mt-3">
           <span className={`text-[9px] font-bold px-3 py-1 rounded-full shadow-sm ${selectedNode.bias === 'ATOM' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : selectedNode.bias === 'ATOMONE' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
             {selectedNode.bias} ECOSYSTEM
           </span>
           <span className="text-[9px] font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-aether-dark-subtext">
             IMPACT SCORE: {Math.floor(selectedNode.size)}
           </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
        
        {/* 1. Price & Net Flow Chart */}
        <div className="space-y-3">
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wider">Price vs Net Flow</span>
             <div className="bg-gray-50 dark:bg-white/5 p-1 rounded"><TrendingUp size={12} className="text-gray-400 dark:text-aether-dark-subtext" /></div>
           </div>
           <div className="h-40 bg-white dark:bg-aether-dark-bg/50 rounded-2xl border border-gray-50 dark:border-white/5 p-4 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/50 dark:to-black/20 pointer-events-none"></div>
              <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={selectedNode.history}>
                    <Tooltip 
                       contentStyle={{backgroundColor: 'hsl(0 0% 100% / 0.8)', border: '1px solid hsl(0 0% 100% / 0.1)', backdropFilter: 'blur(8px)', borderRadius: '12px', fontSize: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                       itemStyle={{color: '#374151', padding: 0, fontWeight: 600}}
                       labelStyle={{display: 'none'}}
                    />
                    <Bar dataKey="netFlow" barSize={6} radius={[2, 2, 0, 0]}>
                      {selectedNode.history.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.netFlow > 0 ? '#F87171' : '#60A5FA'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="price" stroke="#9CA3AF" strokeWidth={2} dot={false} />
                 </ComposedChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* 2. Transaction Composition (Donut) */}
        <div className="space-y-3">
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wider">On-Chain Behavior</span>
             <div className="bg-gray-50 dark:bg-white/5 p-1 rounded"><Activity size={12} className="text-gray-400 dark:text-aether-dark-subtext" /></div>
           </div>
           <div className="flex items-center gap-6 bg-gray-50 dark:bg-white/5 rounded-2xl p-4 border border-gray-100 dark:border-white/5">
              <div className="w-24 h-24 relative flex-shrink-0">
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
                    <span className="text-[8px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase">SWAP</span>
                 </div>
              </div>
              <div className="flex-1 space-y-2">
                 {compositionData.map((d) => (
                   <div key={d.name} className="flex justify-between items-center text-[10px]">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: d.color}}></div>
                         <span className="font-bold text-gray-500 dark:text-aether-dark-subtext uppercase tracking-wide">{d.name}</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-aether-dark-text">{d.value}%</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* 3. AII Summary & AI Text */}
        <div className="space-y-4 pb-4">
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wider">AII Impact Analysis</span>
             <div className="bg-gray-50 dark:bg-white/5 p-1 rounded"><BarChart2 size={12} className="text-gray-400 dark:text-aether-dark-subtext" /></div>
           </div>
           
           {/* Score Breakdown */}
           <div className="grid grid-cols-3 gap-2">
             <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl text-center border border-gray-100 dark:border-white/5">
                <div className="text-[8px] text-gray-400 dark:text-aether-dark-subtext uppercase mb-1 font-bold">Volume</div>
                <div className="text-sm font-black text-gray-800 dark:text-aether-dark-text">{Math.floor(selectedNode.scaleScore)}</div>
             </div>
             <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl text-center border border-gray-100 dark:border-white/5">
                <div className="text-[8px] text-gray-400 dark:text-aether-dark-subtext uppercase mb-1 font-bold">Timing</div>
                <div className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.floor(selectedNode.timingScore)}</div>
             </div>
             <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl text-center border border-gray-100 dark:border-white/5">
                <div className="text-[8px] text-gray-400 dark:text-aether-dark-subtext uppercase mb-1 font-bold">Correlation</div>
                <div className="text-sm font-black text-purple-600 dark:text-purple-400">{selectedNode.correlationScore > 0 ? '+' : ''}{selectedNode.correlationScore.toFixed(2)}</div>
             </div>
           </div>

           {/* AI Insight */}
           <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-4 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors duration-500"></div>
              <div className="flex items-start gap-3 relative z-10">
                 <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                   <Sparkles size={14} className="text-yellow-300" />
                 </div>
                 <p className="text-[11px] text-indigo-100 dark:text-indigo-200 leading-relaxed font-medium">
                   {loading ? "Generating analysis..." : summary}
                 </p>
              </div>
           </div>
        </div>

        {/* Assign to Simulation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-gray-400 dark:text-aether-dark-subtext uppercase tracking-wider">Assign to Simulation</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
             {slots.map(slot => {
                const isOccupied = !!slot.node;
                const isCurrentNodeInSlot = isOccupied && slot.node!.id === selectedNode.id;
                
                let buttonText = `Slot ${slot.id}`;
                let ButtonIcon = PlusCircle;
                let buttonClass = 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-aether-dark-subtext hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 border-gray-100 dark:border-white/10';

                if (isCurrentNodeInSlot) {
                   buttonText = 'Assigned';
                   ButtonIcon = CheckCircle;
                   buttonClass = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20';
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
    </div>
  );
};

export default NodeIntelligence;