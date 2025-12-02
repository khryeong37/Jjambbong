import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = "", 
  padding = "p-6" 
}) => {
  return (
    <div className={`
      relative
      bg-[#0f172a]/40 
      backdrop-blur-2xl 
      border border-white/10
      shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] 
      rounded-3xl 
      text-slate-200
      overflow-hidden
      before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none
      ${padding} 
      ${className}
    `}>
      {children}
    </div>
  );
};