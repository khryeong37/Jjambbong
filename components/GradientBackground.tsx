import React from 'react';

const GradientBackground: React.FC = () => {
    return (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
            {/* Light Mode Background */}
            <div className="relative w-full h-full bg-gradient-to-br from-gray-200 via-gray-300/50 to-gray-400/30 dark:hidden">
                <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob-1"></div>
                <div className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-cyan-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob-2"></div>
                <div className="absolute bottom-[-15%] right-[20%] w-[350px] h-[350px] bg-blue-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob-3"></div>
                <div className="absolute bottom-[5%] left-[10%] w-[300px] h-[300px] bg-indigo-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob-4"></div>
            </div>
            {/* Dark Mode Background */}
            <div className="hidden dark:block relative w-full h-full bg-gradient-to-br from-black via-gray-950/80 to-gray-900/60">
                <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob-1"></div>
                <div className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob-2"></div>
                <div className="absolute bottom-[-15%] right-[20%] w-[350px] h-[350px] bg-blue-500/15 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob-3"></div>
                <div className="absolute bottom-[5%] left-[10%] w-[300px] h-[300px] bg-indigo-500/15 rounded-full mix-blend-screen filter blur-3xl opacity-35 animate-blob-4"></div>
            </div>
        </div>
    );
};

export default GradientBackground;
