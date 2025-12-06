import React from 'react';

const GradientBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
            {/* === LIGHT MODE BACKGROUND === */}
            <div className="absolute inset-0 dark:hidden">
                {/* Base gradient */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: '#d1d5db'
                    }}
                />
            </div>

            {/* === DARK MODE BACKGROUND === */}
            <div className="absolute inset-0 hidden dark:block">
                {/* Base gradient - deep and rich */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: '#000000'
                    }}
                />

                {/* Ambient glow orbs */}
                <div 
                    className="absolute w-[900px] h-[900px] rounded-full"
                    style={{
                        top: '-25%',
                        left: '-15%',
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 60%)',
                        filter: 'blur(80px)',
                    }}
                />
                <div 
                    className="absolute w-[700px] h-[700px] rounded-full"
                    style={{
                        top: '5%',
                        right: '-10%',
                        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 60%)',
                        filter: 'blur(80px)',
                    }}
                />
                <div 
                    className="absolute w-[800px] h-[800px] rounded-full"
                    style={{
                        bottom: '-20%',
                        left: '15%',
                        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 60%)',
                        filter: 'blur(80px)',
                    }}
                />
                <div 
                    className="absolute w-[600px] h-[600px] rounded-full"
                    style={{
                        bottom: '25%',
                        right: '5%',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
                        filter: 'blur(70px)',
                    }}
                />

                {/* Mesh gradient overlay */}
                <div 
                    className="absolute inset-0 opacity-40"
                    style={{
                        backgroundImage: `
                            radial-gradient(at 40% 20%, rgba(99, 102, 241, 0.12) 0px, transparent 50%),
                            radial-gradient(at 80% 0%, rgba(168, 85, 247, 0.1) 0px, transparent 50%),
                            radial-gradient(at 0% 50%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
                            radial-gradient(at 80% 50%, rgba(99, 102, 241, 0.08) 0px, transparent 50%),
                            radial-gradient(at 0% 100%, rgba(168, 85, 247, 0.08) 0px, transparent 50%),
                            radial-gradient(at 80% 100%, rgba(59, 130, 246, 0.1) 0px, transparent 50%)
                        `
                    }}
                />

                {/* Subtle vignette */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%)',
                    }}
                />

                {/* Noise texture */}
                <div 
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    }}
                />
            </div>
        </div>
    );
};

export default GradientBackground;
