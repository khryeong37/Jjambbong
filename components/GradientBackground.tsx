import React from 'react';

const GradientBackground: React.FC = () => {
    // CSS 변수 정의 (Inspira UI 스타일)
    const auroraStyles = {
        '--aurora': 'repeating-linear-gradient(100deg, #3b82f6 10%, #a5b4fc 15%, #93c5fd 20%, #ddd6fe 25%, #60a5fa 30%)',
        '--dark-gradient': 'repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)',
        '--white-gradient': 'repeating-linear-gradient(100deg, #fff 0%, #fff 7%, transparent 10%, transparent 12%, #fff 16%)',
        '--blue-300': '#93c5fd',
        '--blue-400': '#60a5fa',
        '--blue-500': '#3b82f6',
        '--indigo-300': '#a5b4fc',
        '--violet-200': '#ddd6fe',
        '--black': '#000',
        '--white': '#fff',
        '--transparent': 'transparent',
    } as React.CSSProperties;

    return (
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
            {/* === LIGHT MODE BACKGROUND === */}
            <div className="absolute inset-0 dark:hidden">
                {/* Base light background - 밝은 회색 */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: '#d1d5db'
                    }}
                />
            </div>

            {/* === DARK MODE BACKGROUND === */}
            <div className="absolute inset-0 hidden dark:block">
                {/* Base dark background */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: '#000000'
                    }}
                />

                {/* Aurora animated gradient layers */}
                <div 
                    className="absolute inset-0 opacity-80"
                    style={{
                        background: `
                            radial-gradient(
                                at 27% 37%,
                                rgba(99, 102, 241, 0.18) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 97% 21%,
                                rgba(139, 92, 246, 0.15) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 52% 99%,
                                rgba(59, 130, 246, 0.15) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 10% 29%,
                                rgba(168, 85, 247, 0.12) 0px,
                                transparent 40%
                            ),
                            radial-gradient(
                                at 97% 96%,
                                rgba(99, 102, 241, 0.1) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 33% 50%,
                                rgba(139, 92, 246, 0.08) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 79% 53%,
                                rgba(59, 130, 246, 0.1) 0px,
                                transparent 50%
                            )
                        `,
                        backgroundSize: '200% 200%',
                        backgroundPosition: '50% 50%, 50% 50%',
                        animation: 'aurora 60s linear infinite',
                    }}
                />

                {/* Additional animated gradient overlay */}
                <div 
                    className="absolute inset-0 opacity-60"
                    style={{
                        background: `
                            linear-gradient(
                                to bottom right,
                                rgba(99, 102, 241, 0.12) 0%,
                                rgba(139, 92, 246, 0.1) 25%,
                                rgba(168, 85, 247, 0.08) 50%,
                                rgba(99, 102, 241, 0.1) 75%,
                                rgba(139, 92, 246, 0.12) 100%
                            ),
                            linear-gradient(
                                to top left,
                                rgba(59, 130, 246, 0.1) 0%,
                                rgba(99, 102, 241, 0.08) 50%,
                                rgba(139, 92, 246, 0.1) 100%
                            )
                        `,
                        backgroundSize: '200% 200%',
                        backgroundPosition: '50% 50%, 50% 50%',
                        animation: 'aurora 60s linear infinite',
                    }}
                />

                {/* Subtle vignette */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
                    }}
                />
            </div>
        </div>
    );
};

export default GradientBackground;
