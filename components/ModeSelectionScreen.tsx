import React from 'react';

interface ModeSelectionScreenProps {
  onModeSelect: (mode: 'ncert' | 'story') => void;
  onBack: () => void;
}

export const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({ onModeSelect, onBack }) => {
  return (
    <div className="w-full h-full text-white flex flex-col items-center justify-center p-8 animate-fade-in text-center">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 text-slate-300 hover:text-white transition-colors z-20 font-bold flex items-center gap-2 text-sm sm:text-base"
      >
        <span className="text-xl sm:text-2xl">&larr;</span> Back to Grades
      </button>
      <h2 className="text-2xl sm:text-3xl font-semibold text-slate-200 mb-12">
        Choose your reading adventure!
      </h2>
      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => onModeSelect('ncert')}
          className="w-64 h-40 bg-slate-800/70 rounded-2xl flex flex-col items-center justify-center text-slate-200 hover:bg-cyan-600 hover:text-white hover:scale-105 transition-all duration-300 shadow-lg backdrop-blur-sm p-4"
        >
          <span className="text-3xl font-bold mb-2">NCERT Books</span>
          <span className="text-sm">Read from your official school textbooks.</span>
        </button>
        <button
          onClick={() => onModeSelect('story')}
          className="w-64 h-40 bg-slate-800/70 rounded-2xl flex flex-col items-center justify-center text-slate-200 hover:bg-purple-600 hover:text-white hover:scale-105 transition-all duration-300 shadow-lg backdrop-blur-sm p-4"
        >
          <span className="text-3xl font-bold mb-2">Story Mode</span>
          <span className="text-sm">Read new, fun stories generated just for you.</span>
        </button>
      </div>
    </div>
  );
};
