import React from 'react';
import { TOPICS, TOPIC_IMAGES, Topic } from '../constants';

interface TopicSelectionScreenProps {
  onTopicSelect: (topic: Topic) => void;
  onBack: () => void;
}

export const TopicSelectionScreen: React.FC<TopicSelectionScreenProps> = ({ onTopicSelect, onBack }) => {
  return (
    <div className="w-full h-full text-white flex flex-col items-center justify-center p-8 animate-fade-in">
      <h1 className="text-3xl sm:text-5xl font-bold text-cyan-400 mb-4" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>Choose a Topic</h1>
      <p className="text-lg sm:text-xl text-slate-200 mb-12">What would you like to read about?</p>
      <div className="flex flex-wrap justify-center gap-8">
        {TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => onTopicSelect(topic)}
            className="relative w-60 h-80 bg-slate-800/70 rounded-2xl flex flex-col items-center justify-end text-slate-200 hover:bg-cyan-600 hover:text-white hover:scale-105 transition-all duration-300 shadow-lg backdrop-blur-sm overflow-hidden group"
          >
            <img src={TOPIC_IMAGES[topic]} alt={topic} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            <span className="relative text-2xl font-bold p-4">{topic}</span>
          </button>
        ))}
      </div>
       <button
          onClick={onBack}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 text-slate-300 hover:text-white transition-colors z-20 font-bold flex items-center gap-2 text-sm sm:text-base"
        >
          <span className="text-xl sm:text-2xl">&larr;</span> Back to Grades
      </button>
    </div>
  );
};
