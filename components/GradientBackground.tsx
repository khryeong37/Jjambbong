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
                {/* Base dark background - Night-Navy Gradient */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(135deg, #080A10 0%, #0C111A 25%, #0D1422 50%, #0C1018 75%, #080A10 100%)'
                    }}
                />

                {/* Midnight Navy Mesh Layers - Soft Light Blending */}
                <div 
                    className="absolute inset-0 opacity-50"
                    style={{
                        background: `
                            radial-gradient(
                                at 15% 25%,
                                rgba(90, 127, 255, 0.08) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 85% 75%,
                                rgba(78, 214, 230, 0.06) 0px,
                                transparent 50%
                            ),
                            radial-gradient(
                                at 50% 50%,
                                rgba(255, 255, 255, 0.02) 0px,
                                transparent 70%
                            ),
                            radial-gradient(
                                at 30% 70%,
                                rgba(90, 127, 255, 0.05) 0px,
                                transparent 60%
                            )
                        `,
                        backgroundSize: '200% 200%',
                        backgroundPosition: '50% 50%',
                        animation: 'aurora 120s linear infinite',
                        mixBlendMode: 'soft-light',
                    }}
                />

                {/* Deep Vignette - Enhanced Depth */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(8, 10, 16, 0.5) 100%)',
                    }}
                />
            </div>
        </div>
    );
};

export default GradientBackground;
