import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { SoundIcon } from './icons/SoundIcon';
import { guidelines } from '../guidelines';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface StoryArenaGameProps {
  onBack: () => void;
  userName: string;
  userClass: string;
  language: string;
}

type Step = 'GENERATING' | 'READING' | 'FEEDBACK' | 'ERROR';
type Mistake = { said: string; expected: string; };

const analyzeReadingWithAI = async (spokenText: string, targetText: string): Promise<Mistake[]> => {
    if (!spokenText.trim()) return targetText.split(' ').map(word => ({ said: '', expected: word }));

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const systemInstruction = `You are an expert English pronunciation analyst for children. Your task is to compare a 'target text' with a 'spoken text' from a speech-to-text service and identify mistakes. Be forgiving of minor speech-to-text errors that don't change the word's meaning.

**Rules:**
- Identify mispronounced words, omitted (skipped) words, and inserted (extra) words.
- For omitted words, the "said" property in the JSON object should be an empty string ("").
- For inserted words, the "expected" property should be an empty string ("").
- If there are no mistakes, return an empty array.
- Your response MUST be a single, valid JSON array of objects.
- Each object must have two properties: "said" (string) and "expected" (string).
- Do not use markdown code fences.`;

        const prompt = `Target Text: "${targetText}"\nSpoken Text: "${spokenText}"`;

        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    said: { type: Type.STRING },
                    expected: { type: Type.STRING },
                },
                required: ['said', 'expected'],
            },
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
            },
        });

        const result = JSON.parse(response.text);
        if (Array.isArray(result)) {
            return result as Mistake[];
        }
        return [];
    } catch (e) {
        console.error("AI analysis failed:", e);
        return [];
    }
};

const generateStoryWithAI = async (grade: number, language: string): Promise<string> => {
    const gradeData = guidelines.grades.find(g => g.grade === grade);
    if (!gradeData) {
        return "Sorry, I couldn't find any guidelines for your grade. Here is a simple story: A cat sat on a mat.";
    }

    const promptParts = [
        `You are a creative and engaging storyteller for children.`,
        `Generate a short story for a Grade ${grade} student.`,
        `The story must be in ${language === 'hi' ? 'Hindi' : 'English'}.`,
        `Follow these rules strictly:`,
        `- Word count: Between ${gradeData.word_range.min} and ${gradeData.word_range.max} words.`,
        `- Sentence types: Use only ${gradeData.sentence_types_allowed.join(' and ')} sentences.`,
        `- Topics: The story should be about one of these topics: ${gradeData.topic_suggestions.join(', ')}.`,
        `- Tone: The tone must be clear, concrete, and child-safe. Avoid complex themes.`,
        `- Language: Use simple, age-appropriate words.`,
    ];

    if (gradeData.sight_words && gradeData.sight_words.examples.length > 0) {
        const sightWords = gradeData.sight_words.examples;
        const langSightWords = language === 'hi' 
            ? sightWords.filter((_, i) => i % 2 === 0).map(w => w.split(' ')[0])
            : sightWords.filter((_, i) => i % 2 !== 0);
        
        if (langSightWords.length > 0) {
            promptParts.push(`- Try to include a few of these words: ${langSightWords.slice(0, 5).join(', ')}.`);
        }
    }
    
    promptParts.push(`\nIMPORTANT: Only return the story text. Do not add any titles, headings, or explanations.`);
    
    const finalPrompt = promptParts.join('\n');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: finalPrompt,
        });
        return response.text.trim();
    } catch (e) {
        console.error("AI story generation failed:", e);
        throw new Error("Failed to generate a story. Please try again later.");
    }
};

export const StoryArenaGame: React.FC<StoryArenaGameProps> = ({ onBack, userName, userClass, language }) => {
    const [step, setStep] = useState<Step>('GENERATING');
    const [storyContent, setStoryContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [segments, setSegments] = useState<string[]>([]);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [mistakesBySegment, setMistakesBySegment] = useState<{ [key: number]: Mistake[] }>({});
    const [unattemptedIndices, setUnattemptedIndices] = useState<number[]>([]);
    const [isRecognitionActive, setIsRecognitionActive] = useState(false);
    const [recognitionError, setRecognitionError] = useState<string | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [matchedWordCount, setMatchedWordCount] = useState(0);
    const finalTranscriptRef = useRef('');
    const [attemptedSegments, setAttemptedSegments] = useState<Set<number>>(new Set());
    const [transcriptsBySegment, setTranscriptsBySegment] = useState<{ [key: number]: string }>({});
    const hasProcessedSegment = useRef(false);

    useEffect(() => {
        if (!window.speechSynthesis) return;
        const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    const segmentStory = useCallback((text: string) => {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const newSegments: string[] = [];
        let currentSegment = '';
        sentences.forEach((sentence, index) => {
            currentSegment += sentence + ' ';
            if ((index + 1) % 3 === 0 || index === sentences.length - 1) {
                newSegments.push(currentSegment.trim());
                currentSegment = '';
            }
        });

        setSegments(newSegments.filter(s => s));
        setCurrentSegmentIndex(0);
        setMistakesBySegment({});
        setUnattemptedIndices([]);
        setAttemptedSegments(new Set());
        setTranscriptsBySegment({});
        setStep('READING');
    }, []);

    useEffect(() => {
        const fetchStory = async () => {
            try {
                const story = await generateStoryWithAI(parseInt(userClass), language);
                setStoryContent(story);
                segmentStory(story);
            } catch (err: any) {
                setError(err.message || 'An unknown error occurred while generating the story.');
                setStep('ERROR');
            }
        };
        fetchStory();
    }, [userClass, language, segmentStory]);
    
    const speechRecognizer = useMemo(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setRecognitionError('Speech recognition is not supported in this browser.');
            return null;
        }
        const recognizer = new SpeechRecognitionAPI();
        recognizer.continuous = true;
        recognizer.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognizer.interimResults = true;
        return recognizer;
    }, [language]);

    const cleanWord = (word: string) => word.trim().toLowerCase().replace(/[.,?!]/g, '');

    const storeCurrentTranscript = useCallback(() => {
        if (attemptedSegments.has(currentSegmentIndex) && finalTranscriptRef.current) {
            setTranscriptsBySegment(prev => ({...prev, [currentSegmentIndex]: finalTranscriptRef.current}));
        }
    }, [currentSegmentIndex, attemptedSegments]);

    const compileReportAndFinish = useCallback(async () => {
        speechRecognizer?.abort();
        storeCurrentTranscript();

        setStep('GENERATING'); // Show a loading state while analyzing

        const finalTranscripts = {...transcriptsBySegment};
        if (attemptedSegments.has(currentSegmentIndex) && finalTranscriptRef.current) {
            finalTranscripts[currentSegmentIndex] = finalTranscriptRef.current;
        }

        const analysisPromises = Object.entries(finalTranscripts).map(async ([index, transcript]) => {
            const segmentIndex = parseInt(index);
            const mistakes = await analyzeReadingWithAI(transcript, segments[segmentIndex]);
            return { index: segmentIndex, mistakes };
        });

        const results = await Promise.all(analysisPromises);
        const newMistakesBySegment = results.reduce((acc, { index, mistakes }) => {
            acc[index] = mistakes;
            return acc;
        }, {} as { [key: number]: Mistake[] });

        setMistakesBySegment(newMistakesBySegment);
        
        const finalAttempted = new Set(Object.keys(finalTranscripts).map(Number));
        const finalUnattempted = [...Array(segments.length).keys()].filter(i => !finalAttempted.has(i));
        setUnattemptedIndices(finalUnattempted);
        
        setStep('FEEDBACK');
    }, [speechRecognizer, storeCurrentTranscript, transcriptsBySegment, attemptedSegments, currentSegmentIndex, segments]);


    const handleGoForward = useCallback(() => {
        speechRecognizer?.abort();
        storeCurrentTranscript();
        
        if (currentSegmentIndex < segments.length - 1) {
            setCurrentSegmentIndex(prev => prev + 1);
        } else {
            compileReportAndFinish();
        }
    }, [speechRecognizer, storeCurrentTranscript, currentSegmentIndex, segments.length, compileReportAndFinish]);

    const handleGoBackward = () => {
        if (currentSegmentIndex > 0) {
            speechRecognizer?.abort();
            storeCurrentTranscript();
            setCurrentSegmentIndex(prev => prev - 1);
        }
    };

    const handleEndEarly = () => {
        compileReportAndFinish();
    };

    const startRecognition = useCallback(() => {
        if (!speechRecognizer || isRecognitionActive) return;
        setAttemptedSegments(prev => new Set(prev).add(currentSegmentIndex));
        try {
            setRecognitionError(null);
            hasProcessedSegment.current = false;
            finalTranscriptRef.current = '';
            setMatchedWordCount(0);
            speechRecognizer?.start();
        } catch (e: any) {
            if (e.name !== 'InvalidStateError') {
                console.error("Could not start recognition:", e);
                setRecognitionError("Failed to start microphone.");
            }
        }
    }, [isRecognitionActive, speechRecognizer, currentSegmentIndex]);

    useEffect(() => {
        setMatchedWordCount(0);
        finalTranscriptRef.current = '';
        hasProcessedSegment.current = false;
        speechRecognizer?.abort();
    }, [currentSegmentIndex, speechRecognizer]);

    useEffect(() => {
        if (!speechRecognizer) return;

        const handleResult = (event: any) => {
            if (step !== 'READING' || hasProcessedSegment.current) return;
            
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) finalTranscriptRef.current = finalTranscript;
            
            const spokenText = (finalTranscript + interimTranscript).trim();
            const spokenWords = spokenText.split(' ').map(cleanWord).filter(Boolean);
            const targetWords = segments[currentSegmentIndex]?.split(' ').map(cleanWord).filter(Boolean) || [];
            
            setMatchedWordCount(spokenWords.length);

            const isComplete = spokenWords.length >= targetWords.length;
            if (isComplete) {
                hasProcessedSegment.current = true;
                speechRecognizer?.stop();
                setTimeout(() => {
                    handleGoForward();
                }, 1200);
            }
        };
        const handleEnd = () => setIsRecognitionActive(false);
        const handleStart = () => setIsRecognitionActive(true);
        const handleError = (e: any) => { 
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
              setRecognitionError(`Mic error: ${e.error}`);
            }
            setIsRecognitionActive(false);
        };
        speechRecognizer.addEventListener('result', handleResult);
        speechRecognizer.addEventListener('start', handleStart);
        speechRecognizer.addEventListener('end', handleEnd);
        speechRecognizer.addEventListener('error', handleError);
        return () => {
            speechRecognizer.removeEventListener('result', handleResult);
            speechRecognizer.removeEventListener('start', handleStart);
            speechRecognizer.removeEventListener('end', handleEnd);
            speechRecognizer.removeEventListener('error', handleError);
        };
    }, [speechRecognizer, step, currentSegmentIndex, segments, handleGoForward]);

    useEffect(() => {
        if (step !== 'READING' && isRecognitionActive) {
            speechRecognizer?.abort();
        }
    }, [step, isRecognitionActive, speechRecognizer]);

    const pronounceWord = (text: string) => {
        if (!window.speechSynthesis || voices.length === 0) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voices.find(v => v.lang.startsWith(language)) || voices.find(v => v.lang.startsWith('en')) || null;
        window.speechSynthesis.speak(utterance);
    };

    const renderContent = () => {
        switch (step) {
            case 'GENERATING': return <div className="text-center text-slate-300 animate-pulse text-2xl">Generating a magical story for you...</div>;
            case 'ERROR': return (
                <div className="text-center text-red-400 text-xl p-8">
                    <h2 className="text-3xl font-bold mb-4">Oops!</h2>
                    <p>{error}</p>
                    <button onClick={onBack} className="mt-8 px-6 py-3 bg-cyan-600 rounded-lg font-bold">Try Again</button>
                </div>
            );
            case 'READING': return (
                <div className="p-4 sm:p-8 w-full max-w-4xl mx-auto flex flex-col h-full">
                    <div className="pt-4 mb-4">
                        <p className="text-center text-3xl font-bold mb-2" style={{ color: '#a55a0a' }}>{currentSegmentIndex + 1} / {segments.length}</p>
                        <div className="w-full bg-slate-700 rounded-full h-4"><div className="bg-green-500 h-4 rounded-full transition-all duration-300" style={{ width: `${((currentSegmentIndex + 1) / segments.length) * 100}%` }}></div></div>
                    </div>
                    <div className="flex-grow flex items-center justify-center">
                        <div className="max-h-[50vh] overflow-y-auto no-scrollbar px-4">
                            <p className="text-4xl md:text-5xl font-medium leading-relaxed text-center">
                                {segments[currentSegmentIndex]?.split(' ').map((word, index) => <span key={index} className={`transition-colors duration-200 ${index < matchedWordCount ? 'text-green-400 font-bold' : 'text-[#633e0b]'}`}>{word} </span>)}
                            </p>
                        </div>
                    </div>
                    <div className="flex-shrink-0 pt-4 pb-8 flex flex-col items-center justify-center">
                        {recognitionError && <p className="text-red-400">{recognitionError}</p>}
                        <div className="flex items-center justify-center w-full gap-8">
                            <button onClick={handleGoBackward} disabled={currentSegmentIndex === 0} className="px-6 py-3 bg-slate-600 rounded-full font-bold text-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                Back
                            </button>
                            <button onClick={startRecognition} disabled={isRecognitionActive} className="text-lg px-6 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed">
                                <span className={isRecognitionActive ? 'animate-pulse' : ''}>{isRecognitionActive ? 'Listening...' : 'Click to Read'}</span>
                            </button>
                            <button onClick={handleGoForward} className="px-6 py-3 bg-green-600 rounded-full font-bold text-lg hover:bg-green-700 transition-colors">
                                {currentSegmentIndex === segments.length - 1 ? 'Finish' : 'Next'}
                            </button>
                        </div>
                        <button onClick={handleEndEarly} className="mt-4 text-sm text-slate-400 hover:text-red-400 transition-colors">
                            End & See Report
                        </button>
                    </div>
                </div>
            );
            case 'FEEDBACK':
                const allSegmentsUnattempted = attemptedSegments.size === 0 && segments.length > 0;
                const relevantMistakes = Object.values(mistakesBySegment).flat().filter(m => m.expected || m.said);
                const allAttemptedPerfectly = relevantMistakes.length === 0 && unattemptedIndices.length === 0 && !allSegmentsUnattempted;

                return (
                    <div className="text-center flex flex-col items-center justify-center h-full p-4 animate-fade-in">
                        {allSegmentsUnattempted ? (
                            <h2 className="text-4xl font-bold text-yellow-400 my-6">You haven't read anything from this story.</h2>
                        ) : (
                             <>
                                <h2 className="text-4xl font-bold text-green-400 my-6">{allAttemptedPerfectly ? 'Perfect!' : 'Great Effort!'}</h2>
                                { !allAttemptedPerfectly && <p className="text-lg text-slate-300 mb-6">Here's your reading report.</p> }
                            </>
                        )}
                        
                        {unattemptedIndices.length > 0 && !allSegmentsUnattempted && (
                            <div className="w-full max-w-2xl bg-yellow-900/50 rounded-lg p-3 mb-4 border border-yellow-700">
                                <p className="text-yellow-300">You did not attempt to read segment(s): {unattemptedIndices.map(i => i + 1).join(', ')}</p>
                            </div>
                        )}

                        {relevantMistakes.length > 0 && (
                            <div className="w-full max-w-2xl bg-slate-800 rounded-lg p-4 space-y-3 max-h-[40vh] overflow-y-auto">
                                {Object.entries(mistakesBySegment).map(([segmentIndex, segmentMistakes]) => {
                                    const relevantSegmentMistakes = segmentMistakes.filter(m => m.expected || m.said);
                                    if (relevantSegmentMistakes.length === 0) return null;
                                    return (
                                        <div key={segmentIndex} className="mb-4">
                                            <h4 className="font-bold text-lg text-cyan-400 mb-2 border-b border-cyan-700 pb-1">Segment {parseInt(segmentIndex) + 1}</h4>
                                            {relevantSegmentMistakes.map((mistake, index) => (
                                                <div key={index} className="flex items-center justify-between bg-slate-700 p-3 rounded-md mb-2 transition-all duration-300 hover:shadow-lg hover:ring-2 hover:ring-cyan-500">
                                                    <div className="flex-grow text-left">
                                                        <p className="text-sm text-slate-400">You said: <span className="font-bold text-red-400">{mistake.said || '(skipped)'}</span></p>
                                                        <p className="text-lg">Correct word: <span className="font-bold text-green-400">{mistake.expected || '(extra word)'}</span></p>
                                                    </div>
                                                    <button onClick={() => pronounceWord(mistake.expected)} className="p-3 ml-4 rounded-full bg-cyan-600 hover:bg-cyan-500 transition-colors" aria-label={`Listen to ${mistake.expected}`}><SoundIcon /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        <button onClick={onBack} className="mt-8 px-8 py-4 bg-green-600 text-white font-bold rounded-lg text-2xl hover:bg-green-700">Finish</button>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="w-full h-full text-white relative flex flex-col justify-center animate-fade-in">
            {step === 'READING' || step === 'FEEDBACK' ? (
                <div className="absolute inset-0 w-full h-full bg-cover bg-center z-0" style={{ backgroundImage: "url('/complete-background.png')" }}></div>
            ) : (
                 <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-900 to-slate-900 z-0"></div>
            )}

            <div className="relative z-10 h-full flex flex-col">
                 <button onClick={onBack} className="absolute top-6 left-6 text-slate-300 hover:text-white transition-colors z-20 font-bold flex items-center gap-2 text-lg">&larr; Back to Grades</button>
                 <h1 className="text-4xl sm:text-5xl font-bold text-purple-400 text-center absolute top-6 left-1/2 -translate-x-1/2" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>Story Arena</h1>
                <div className="flex-grow flex flex-col justify-center overflow-auto">{renderContent()}</div>
            </div>
        </div>
    );
};
