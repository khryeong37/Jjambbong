import React from 'react';

const GradientBackground: React.FC = () => {
    return (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
            <div className="relative w-full h-full">
                <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-blob-1"></div>
                <div className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-blob-2"></div>
                <div className="absolute bottom-[-15%] right-[20%] w-[350px] h-[350px] bg-aether-atom rounded-full mix-blend-multiply filter blur-3xl opacity-10 dark:opacity-20 animate-blob-3"></div>
                <div className="absolute bottom-[5%] left-[10%] w-[300px] h-[300px] bg-aether-one rounded-full mix-blend-multiply filter blur-3xl opacity-15 dark:opacity-25 animate-blob-4"></div>
            </div>
        </div>
    );
};

export default GradientBackground;
