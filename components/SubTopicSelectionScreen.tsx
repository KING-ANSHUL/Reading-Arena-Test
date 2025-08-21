import React from 'react';
import { TOPICS_DATA, Topic } from '../constants';

interface SubTopicSelectionScreenProps {
  topic: Topic;
  onSubTopicSelect: (subTopic: string) => void;
  onBack: () => void;
}

export const SubTopicSelectionScreen: React.FC<SubTopicSelectionScreenProps> = ({ topic, onSubTopicSelect, onBack }) => {
  const subTopics = TOPICS_DATA[topic].subTopics;

  return (
    <div className="w-full h-full text-white flex flex-col items-center justify-center p-8 animate-fade-in text-center">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 text-slate-300 hover:text-white transition-colors z-20 font-bold flex items-center gap-2 text-sm sm:text-base"
      >
        <span className="text-xl sm:text-2xl">&larr;</span> Back to Topics
      </button>
      <h2 className="text-2xl sm:text-3xl font-semibold text-slate-200 mb-4">
        Now, choose a sub-topic from
      </h2>
      <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 mb-12" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>
        {topic}
      </h1>
      <div className="w-full max-w-4xl flex flex-wrap justify-center gap-4 sm:gap-6">
        {subTopics.map((subTopic) => (
          <button
            key={subTopic}
            onClick={() => onSubTopicSelect(subTopic)}
            className="px-6 py-3 bg-slate-800/70 rounded-xl text-slate-200 hover:bg-cyan-600 hover:text-white hover:scale-105 transition-all duration-300 shadow-lg backdrop-blur-sm text-lg"
          >
            {subTopic}
          </button>
        ))}
      </div>
    </div>
  );
};
