import React from 'react';

const GradientBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
            {/* === LIGHT MODE BACKGROUND === */}
            <div className="absolute inset-0 dark:hidden bg-gray-300" />

            {/* === DARK MODE BACKGROUND === */}
            <div className="absolute inset-0 hidden dark:block bg-gray-900" />
        </div>
    );
};

export default GradientBackground;
