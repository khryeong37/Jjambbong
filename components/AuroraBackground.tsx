import React from "react";

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  showRadialGradient?: boolean;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  className = "",
  children,
  showRadialGradient = true,
  ...props
}) => {
  return (
    <div
      {...props}
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden ${className}`}
    >
      {/* Base background */}
      <div className="absolute inset-0 dark:bg-slate-950 bg-[#d1d5db]" />
      
      {/* Aurora effect - Light mode only */}
      <div className="absolute inset-0 dark:hidden overflow-hidden">
        <div
          className="absolute inset-0 animate-aurora"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 100% 0%, rgba(34, 197, 94, 0.35) 0%, transparent 50%),
              radial-gradient(ellipse at 0% 50%, rgba(16, 185, 129, 0.4) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 100%, rgba(5, 150, 105, 0.45) 0%, transparent 50%)
            `,
            backgroundSize: '200% 200%, 200% 200%, 200% 200%',
            backgroundPosition: '50% 50%, 50% 50%, 50% 50%',
            filter: 'blur(60px)',
            opacity: 0.8,
            maskImage: showRadialGradient 
              ? 'radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%)'
              : 'none',
            WebkitMaskImage: showRadialGradient 
              ? 'radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%)'
              : 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
      {children}
    </div>
  );
};
