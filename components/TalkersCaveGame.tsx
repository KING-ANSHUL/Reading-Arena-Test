import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { Topic } from '../constants';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { PracticeSoundIcon } from './icons/PracticeSoundIcon';
import { StopIcon } from './icons/StopIcon';
import { guidelines } from '../guidelines';

declare global {
  interface SpeechRecognition {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }

  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }
}

type Step = 'LOADING_PASSAGE' | 'GAME' | 'ANALYZING' | 'PRACTICE_PREP' | 'PRACTICE' | 'COMPLETE';
type GamePhase = 'AI_READING' | 'USER_PROMPT' | 'USER_READING';
type Mistake = { said: string; expected: string };
type PracticeWord = { word: string; phonemes: string[] };

interface TalkersCaveGameProps {
  onComplete: () => void;
  userGrade: number;
  currentLevel: number;
  onBackToTopics: () => void;
  topic: Topic;
  subTopic: string;
  language: string;
}

const cleanWord = (word: string) => word.trim().toLowerCase().replace(/[.,?!]/g, '');

const getPhoneticBreakdown = async (word: string): Promise<string[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const systemInstruction = `You are a linguistic expert specializing in English phonetics for children. Your task is to break down a given word into its distinct phonetic syllables. 
**RULES:**
- The syllables should be simple, intuitive, and easy for a child to read and pronounce. For example, for "together", respond with ["tu", "geh", "dhuh"].
- Your response MUST be a single, valid JSON array of strings.
- Do NOT use markdown code fences or any other text outside the JSON array.
- If the word is a single syllable, return an array with that one word.`;

        const prompt = `Break down the word "${word}" into phonetic syllables.`;
        const responseSchema = { type: Type.ARRAY, items: { type: Type.STRING } };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction, responseMimeType: 'application/json', responseSchema },
        });
        
        let jsonStr = response.text.trim();
        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        }
        
        const result = JSON.parse(jsonStr);
        if (Array.isArray(result) && result.every(item => typeof item === 'string')) return result;
        return [word];
    } catch (e) {
        console.error(`Phonetic breakdown failed for "${word}":`, e);
        return [word];
    }
};

const analyzeReadingWithAI = async (spokenText: string, targetText: string): Promise<Mistake[]> => {
    if (!spokenText.trim()) return targetText.split(' ').map(word => ({ said: '', expected: word }));

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const systemInstruction = `You are an expert English pronunciation analyst for children. Your task is to compare a 'target text' with a 'spoken text' from a speech-to-text service and identify mistakes. The 'spoken text' is from a child, so your analysis must be extremely lenient and encouraging.

**Core Principle: Focus on communication, not perfection.**

**Rules for Analysis:**
1.  **Extreme Leniency:** Be very forgiving. Accept pronunciations that are close enough to be understood. Do not penalize for common childhood speech patterns (e.g., "w" for "r").
2.  **Ignore Filler Words:** Completely disregard filler words like "um," "uh," "like," etc.
3.  **Handle Speech-to-Text Errors:** The transcription may be imperfect. If the spoken word sounds very similar to the target word (e.g., 'see' vs 'sea', 'two' vs 'to'), and makes sense, count it as correct.
4.  **Identify Key Mistakes Only:** Only flag a mistake if a word is:
    *   **Omitted:** The word was completely skipped. In this case, \`said\` should be \`""\`.
    *   **Mispronounced Unrecognizably:** The spoken word is completely different and cannot be understood as the target word.
    *   **Inserted:** An extra word was added that wasn't in the script. In this case, \`expected\` should be \`""\`.
5.  **No Mistakes is Good:** If the child's attempt is understandable, return an empty array \`[]\`.

**Response Format:**
- Your response MUST be a single, valid JSON array of objects.
- Each object must have two properties: "said" (string) and "expected" (string).
- Do NOT use markdown code fences or any other text.`;
        const prompt = `Target Text: "${targetText}"\nSpoken Text: "${spokenText}"`;
        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { said: { type: Type.STRING }, expected: { type: Type.STRING } },
                required: ['said', 'expected'],
            },
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction, responseMimeType: 'application/json', responseSchema },
        });
        
        let jsonStr = response.text.trim();
        const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
        const fenceMatch = jsonStr.match(fenceRegex);
        if (fenceMatch && fenceMatch[1]) jsonStr = fenceMatch[1].trim();
        else {
            const firstBracket = jsonStr.indexOf('[');
            const lastBracket = jsonStr.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket > firstBracket) {
                jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
            }
        }
        
        const result = JSON.parse(jsonStr);
        return Array.isArray(result) ? result : [];
    } catch (e) {
        console.error("AI analysis failed:", e);
        return []; 
    }
};

export const TalkersCaveGame: React.FC<TalkersCaveGameProps> = ({ onComplete, userGrade, currentLevel, onBackToTopics, topic, subTopic, language }) => {
  const [step, setStep] = useState<Step>('LOADING_PASSAGE');
  const [gamePhase, setGamePhase] = useState<GamePhase>('AI_READING');
  const [passage, setPassage] = useState<string[]>([]);
  const [passageImage, setPassageImage] = useState<string | null>(null);
  const [passageSubject, setPassageSubject] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  
  const [practiceWords, setPracticeWords] = useState<PracticeWord[]>([]);
  const [currentPracticeWordIndex, setCurrentPracticeWordIndex] = useState(0);
  const [practiceStatus, setPracticeStatus] = useState<'IDLE' | 'LISTENING' | 'SUCCESS' | 'TRY_AGAIN'>('IDLE');
  const [practiceTranscript, setPracticeTranscript] = useState('');

  const speechRecognizer = useRef<SpeechRecognition | null>(null);
  const practiceRecognizer = useRef<SpeechRecognition | null>(null);
  const practiceResultHandler = useRef<((event: SpeechRecognitionEvent) => void) | null>(null);
  const mainGameResultHandler = useRef<((event: SpeechRecognitionEvent) => void) | null>(null);
  const resultProcessed = useRef(false);

  const langCode = useMemo(() => (language === 'hi' ? 'hi-IN' : 'en-US'), [language]);

  useEffect(() => {
    mainGameResultHandler.current = (event: SpeechRecognitionEvent) => {
        if (resultProcessed.current) return;
        resultProcessed.current = true;
        
        const transcript = event.results[0][0].transcript;
        
        setUserTranscripts(prev => {
            const newTranscripts = [...prev];
            newTranscripts[currentLineIndex] = transcript;
            return newTranscripts;
        });

        if (currentLineIndex < passage.length - 1) {
            setCurrentLineIndex(prev => prev + 1);
            setGamePhase('AI_READING');
        } else {
            setStep('ANALYZING');
        }
    };
  }, [currentLineIndex, passage.length]);
  
  useEffect(() => {
    practiceResultHandler.current = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setPracticeTranscript(transcript);

        if (practiceWords.length > 0 && currentPracticeWordIndex < practiceWords.length) {
            const targetWord = practiceWords[currentPracticeWordIndex].word;
            if (cleanWord(transcript).includes(cleanWord(targetWord))) {
                setPracticeStatus('SUCCESS');
                setTimeout(() => {
                    if (currentPracticeWordIndex < practiceWords.length - 1) {
                        setCurrentPracticeWordIndex(prev => prev + 1);
                        setPracticeStatus('IDLE');
                        setPracticeTranscript('');
                    } else {
                        onComplete();
                    }
                }, 1500);
            } else {
                setPracticeStatus('TRY_AGAIN');
            }
        }
    };
  }, [practiceWords, currentPracticeWordIndex, onComplete]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;
    
    practiceRecognizer.current = new SpeechRecognitionAPI();
    practiceRecognizer.current.lang = langCode;
    practiceRecognizer.current.continuous = false;
    practiceRecognizer.current.interimResults = false;
    const recognizer = practiceRecognizer.current;

    const handleResult = (event: SpeechRecognitionEvent) => practiceResultHandler.current?.(event);
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setRecognitionError(`Mic error: "${event.error}".`);
        }
        setPracticeStatus('IDLE');
    };
    const handleEnd = (_event: Event) => {
        setPracticeStatus(currentStatus => (currentStatus === 'LISTENING' ? 'IDLE' : currentStatus));
    };

    recognizer.addEventListener('result', handleResult as EventListener);
    recognizer.addEventListener('error', handleError as EventListener);
    recognizer.addEventListener('end', handleEnd as EventListener);

    return () => {
        recognizer.removeEventListener('result', handleResult as EventListener);
        recognizer.removeEventListener('error', handleError as EventListener);
        recognizer.removeEventListener('end', handleEnd as EventListener);
        try { recognizer.abort(); } catch(e) {}
    };
  }, [langCode]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', loadVoices); };
  }, []);
  
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
        setRecognitionError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
        return;
    }
    const recognizer = new SpeechRecognitionAPI();
    speechRecognizer.current = recognizer;

    recognizer.lang = langCode;
    recognizer.continuous = false;
    recognizer.interimResults = false;

    const handleResult = (event: SpeechRecognitionEvent) => {
        mainGameResultHandler.current?.(event);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      const errorType = event.error;
      
      setIsRecognitionActive(false);

      if (errorType === 'aborted') {
        return; 
      }

      if (errorType === 'no-speech') {
        setRecognitionError("I didn't hear anything. Please try reading the line again.");
      } else if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        setRecognitionError('Microphone access denied.');
      } else {
        setRecognitionError(`Mic error: "${errorType}".`);
      }
      
      setGamePhase('USER_PROMPT');
    };

    const handleStart = (_event: Event) => {
        resultProcessed.current = false;
        setIsRecognitionActive(true);
    }
    
    const handleEnd = (_event: Event) => {
        setIsRecognitionActive(false);
        if (!resultProcessed.current) {
            setGamePhase(currentPhase => {
                if (currentPhase === 'USER_READING') {
                    return 'USER_PROMPT';
                }
                return currentPhase;
            });
        }
    };

    recognizer.addEventListener('result', handleResult as EventListener);
    recognizer.addEventListener('start', handleStart as EventListener);
    recognizer.addEventListener('end', handleEnd as EventListener);
    recognizer.addEventListener('error', handleError as EventListener);

    return () => {
      recognizer.removeEventListener('result', handleResult as EventListener);
      recognizer.removeEventListener('start', handleStart as EventListener);
      recognizer.removeEventListener('end', handleEnd as EventListener);
      recognizer.removeEventListener('error', handleError as EventListener);
      try { recognizer.abort(); } catch(e){}
    };
  }, [langCode]);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis || voices.length === 0) {
            setTimeout(resolve, text.length * 50);
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voiceLang = language === 'hi' ? 'hi' : 'en';
        const englishVoice = voices.find(v => v.lang.startsWith(voiceLang) && v.name.includes('Google')) || voices.find(v => v.lang.startsWith(voiceLang));
        if (englishVoice) utterance.voice = englishVoice;
        utterance.onstart = () => setIsAiSpeaking(true);
        utterance.onend = () => {
            setIsAiSpeaking(false);
            resolve();
        };
        utterance.onerror = (e) => {
            setIsAiSpeaking(false);
            reject(e);
        };
        window.speechSynthesis.speak(utterance);
    });
  }, [voices, language]);
  
  useEffect(() => {
    if (step === 'ANALYZING') {
      const analyze = async () => {
        const fullPassageText = passage.join(' ');
        const fullUserTranscript = userTranscripts.join(' ');
        const identifiedMistakes = await analyzeReadingWithAI(fullUserTranscript, fullPassageText);
        setMistakes(identifiedMistakes);
        setStep(identifiedMistakes.length > 0 ? 'PRACTICE_PREP' : 'COMPLETE');
      };
      analyze();
    }
  }, [step, passage, userTranscripts]);

  useEffect(() => {
    if (step !== 'PRACTICE_PREP') return;
    const preparePractice = async () => {
        const wordsToPractice = [...new Set(mistakes.map(m => m.expected).filter(Boolean))];
        if (wordsToPractice.length === 0) { onComplete(); return; }
        const phoneticData = await Promise.all(wordsToPractice.map(async (word) => ({ word, phonemes: await getPhoneticBreakdown(word) })));
        setPracticeWords(phoneticData.filter(p => p.phonemes.length > 0));
        setCurrentPracticeWordIndex(0);
        setPracticeStatus('IDLE');
        setPracticeTranscript('');
        setStep('PRACTICE');
    };
    preparePractice();
  }, [step, mistakes, onComplete]);

  const stopPracticeRecognition = useCallback(() => {
    const recognizer = practiceRecognizer.current;
    if (recognizer && practiceStatus === 'LISTENING') {
        try {
            recognizer.stop();
        } catch(e) {
            console.warn("Could not stop practice recognizer", e);
            setPracticeStatus('IDLE');
        }
    }
  }, [practiceStatus]);

  const startPracticeRecognition = useCallback(() => {
    const recognizer = practiceRecognizer.current;
    if (!recognizer || practiceStatus !== 'IDLE') return;
    try {
        setPracticeStatus('LISTENING');
        setPracticeTranscript('');
        recognizer.start();
    } catch (e) {
        setRecognitionError("Mic failed to start. Please try again.");
        setPracticeStatus('IDLE');
    }
  }, [practiceStatus]);
  
  const generatePassageAndImage = useCallback(async () => {
    setError(null); setStep('LOADING_PASSAGE');
    setMistakes([]);
    
    const gradeGuidelines = guidelines.grades.find(g => g.grade === userGrade);
    if (!gradeGuidelines) {
        console.error(`No guidelines found for grade ${userGrade}`);
        setError(`Sorry, I couldn't find the educational guidelines for grade ${userGrade}.`);
        return;
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    try {
        const languageName = language === 'hi' ? 'Hindi' : 'English';

        const passageSystemInstruction = `You are an expert educational content creator for children learning to read in ${languageName}. Your task is to generate a short, engaging, and age-appropriate informational passage.

**CRITICAL: Adhere strictly to ALL of the following rules for the user's grade level.**

**User Profile:**
- Grade: ${userGrade}
- Language: ${languageName}
- Topic: ${topic}
- Sub-Topic: ${subTopic}

**Content Generation Rules:**
1.  **Global Context & Tone:** ${guidelines.global_rules.context}. The tone must be ${guidelines.global_rules.tone}.
2.  **Reading Level:** The passage should be at this level: "${gradeGuidelines.reading_level_summary}".
3.  **Word Count:** The total passage must be between ${gradeGuidelines.word_range.min} and ${gradeGuidelines.word_range.max} words.
4.  **Sentence Structure:** Use only these sentence types: ${gradeGuidelines.sentence_types_allowed.join(', ')}. The passage must be composed of 4-6 simple sentences.
5.  **Vocabulary:** ${gradeGuidelines.syllables_per_word_target.source_text}.
6.  **Punctuation:** Only use the following punctuation: ${gradeGuidelines.punctuation_allowed.join(', ')}.
7.  **Language Control:** ${guidelines.global_rules.language_control}. Avoid rare or archaic words.

**Task:**
1.  Generate a passage about a specific, concrete subject within the chosen sub-topic ("${subTopic}").
2.  Suggest a concrete, simple subject for an image that illustrates the passage (e.g., 'Eiffel Tower', 'Rose', 'Tiger').

**RESPONSE FORMAT:**
- Your entire response MUST be a single, valid JSON object.
- Do NOT include markdown code fences.
- The object must have two properties: "subject" (string, for the image) and "passage" (array of strings, where each string is a sentence).`;

        const passagePrompt = `Generate content for a child in Grade ${userGrade} on the sub-topic "${subTopic}" from the main topic "${topic}" in ${languageName}.`;
        const passageSchema = { type: Type.OBJECT, properties: { subject: { type: Type.STRING }, passage: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['subject', 'passage'] };
        
        const passageResponse: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: passagePrompt, config: { systemInstruction: passageSystemInstruction, responseMimeType: "application/json", responseSchema: passageSchema } });
        
        let passageJsonStr = passageResponse.text.trim();
        const passageResult = JSON.parse(passageJsonStr);

        if (passageResult.subject && Array.isArray(passageResult.passage)) {
            const fetchedPassage = passageResult.passage.filter((line: string) => line.trim().length > 0);
            setPassage(fetchedPassage);
            setPassageSubject(passageResult.subject);
            setUserTranscripts(Array(fetchedPassage.length).fill(''));
            
            const imageResponse = await ai.models.generateImages({
                model: 'imagen-3.0-generate-002',
                prompt: `A vibrant, child-friendly, adorable illustration of: ${passageResult.subject}. Whimsical storybook style, bright colors, friendly expression.`,
                config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
            });

            if (imageResponse.generatedImages?.[0]?.image?.imageBytes) {
                const base64ImageBytes: string = imageResponse.generatedImages[0].image.imageBytes;
                setPassageImage(`data:image/jpeg;base64,${base64ImageBytes}`);
            } else {
                console.warn("Image generation failed or returned no images.");
                setPassageImage(null);
            }
            
            setStep('GAME');
            setCurrentLineIndex(0);
            setGamePhase('AI_READING');
        } else {
            throw new Error('Received invalid passage format from API.');
        }
    } catch (e) {
      console.error(e); 
      setError('Sorry, I couldn\'t create a story. Please try another topic or level.');
    }
  }, [userGrade, topic, subTopic, language]);

  useEffect(() => {
    generatePassageAndImage();
  }, [generatePassageAndImage]);

  const stopRecognition = useCallback(() => {
    if (speechRecognizer.current && isRecognitionActive) {
        speechRecognizer.current.stop();
    }
  }, [isRecognitionActive]);

  const startRecognition = useCallback(() => {
    const recognizer = speechRecognizer.current;
    if (!recognizer || isRecognitionActive) return;
    try {
        setRecognitionError(null);
        recognizer.start();
        setGamePhase('USER_READING');
    } catch(e: any) {
        if (e.name !== 'InvalidStateError') {
            setRecognitionError("Failed to start microphone.");
        }
        setGamePhase('USER_PROMPT');
    }
  }, [isRecognitionActive]);

  useEffect(() => {
    if (step !== 'GAME' || gamePhase !== 'AI_READING' || !passage.length) return;

    let isCancelled = false;
    const readCurrentLine = async () => {
        try {
            await speak(passage[currentLineIndex]);
            if (!isCancelled) {
                setGamePhase('USER_PROMPT');
            }
        } catch (e) {
            if (!isCancelled) {
                console.error("Speech synthesis failed", e);
                setError("Sorry, there was a problem with the voice playback.");
            }
        }
    };
    readCurrentLine();
    return () => { isCancelled = true; };
  }, [step, gamePhase, currentLineIndex, passage, speak, setError]);

  useEffect(() => () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (speechRecognizer.current) speechRecognizer.current.abort();
  }, []);

  const pronounceWord = (text: string) => {
    if (!window.speechSynthesis || voices.length === 0) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voiceLang = language === 'hi' ? 'hi' : 'en';
    const englishVoice = voices.find(v => v.lang.startsWith(voiceLang) && v.name.includes('Google')) || voices.find(v => v.lang.startsWith(voiceLang));
    if (englishVoice) utterance.voice = englishVoice;
    window.speechSynthesis.speak(utterance);
  };
  
  const renderContent = () => {
    switch (step) {
      case 'LOADING_PASSAGE': return <div className="text-center text-slate-300 animate-pulse text-2xl">Creating your reading adventure...</div>;
      case 'ANALYZING': return <div className="text-center text-slate-300 animate-pulse text-2xl">Checking your reading...</div>;
      case 'PRACTICE_PREP': return <div className="text-center text-slate-300 animate-pulse text-2xl">Analyzing words for practice...</div>;
      
      case 'GAME': {
        if (!passage.length) return null;

        const getGameStatus = () => {
          if (recognitionError) return <p className="text-red-400 font-semibold">{recognitionError}</p>;
          switch(gamePhase) {
              case 'AI_READING':
                  return <p className="animate-pulse text-lg">{isAiSpeaking ? 'Listen...' : 'Getting ready...'}</p>;
              case 'USER_PROMPT':
                  return <button onClick={startRecognition} className="px-8 py-4 bg-cyan-500 text-white font-bold rounded-lg text-xl sm:text-2xl hover:bg-cyan-600 transition-transform transform hover:scale-105 flex items-center gap-3">
                      <MicrophoneIcon className="w-6 h-6" /> Your Turn to Read
                  </button>;
              case 'USER_READING':
                  return <button onClick={stopRecognition} className="px-8 py-4 bg-red-500 text-white font-bold rounded-lg text-xl sm:text-2xl hover:bg-red-600 transition-transform transform hover:scale-105 flex items-center gap-3">
                      <StopIcon className="w-6 h-6" /> Stop
                  </button>;
              default:
                  return null;
          }
        }

        return (
          <div className='w-full h-full relative flex flex-col overflow-hidden'>
            <div className="flex-grow flex flex-col md:flex-row items-center justify-center gap-8 p-4 sm:p-8">
              {passageImage && (
                <div className="w-full md:w-1/3 max-w-sm flex-shrink-0">
                  <img src={passageImage} alt={passageSubject} className="rounded-2xl shadow-2xl w-full aspect-square object-cover" />
                </div>
              )}
              <div className={`w-full ${passageImage ? 'md:w-2/3' : 'md:w-full max-w-3xl'} h-full flex flex-col justify-center bg-black/30 rounded-2xl p-6 backdrop-blur-sm no-scrollbar overflow-y-auto`}>
                <h2 className="text-3xl font-bold text-cyan-300 mb-4">{passageSubject}</h2>
                <div className="space-y-4 text-xl sm:text-2xl text-slate-200 font-medium">
                  {passage.map((line, index) => {
                    const isCurrentLine = index === currentLineIndex;
                    const isAiTurn = gamePhase === 'AI_READING';
                    const isUserTurn = gamePhase === 'USER_PROMPT' || gamePhase === 'USER_READING';
                    const hasBeenRead = index < currentLineIndex;
                    const isActive = isCurrentLine && (isAiTurn || isUserTurn);
                    const userTranscriptForLine = userTranscripts[index];

                    return (
                    <div key={index} className={`p-3 rounded-lg transition-all duration-300 ${isActive ? 'bg-cyan-900/50 scale-105' : 'bg-transparent'}`}>
                        <p className={`${(hasBeenRead || isActive) ? 'text-white' : 'text-slate-400 opacity-60'}`}>
                           {line}
                        </p>
                        {userTranscriptForLine && (
                            <p className="text-sm text-cyan-300 mt-2 pl-4 border-l-2 border-cyan-500">
                                You said: "{userTranscriptForLine}"
                            </p>
                        )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="h-24 flex-shrink-0 bg-slate-900/50 flex items-center justify-center text-slate-300 relative">
              {getGameStatus()}
            </div>
          </div>
        );
      }
      case 'PRACTICE': {
          if (practiceWords.length === 0 || currentPracticeWordIndex >= practiceWords.length) {
              return <div className="text-center flex flex-col items-center justify-center h-full p-4">
                  <p className="text-xl text-slate-300 mb-8">No words to practice. Well done!</p>
                  <button onClick={onComplete} className="px-8 py-4 bg-green-600 text-white font-bold rounded-lg text-xl hover:bg-green-700 transition-transform transform hover:scale-105">Finish</button>
              </div>;
          }
          const practiceItem = practiceWords[currentPracticeWordIndex];
          const getStatusMessage = () => {
              switch (practiceStatus) {
                  case 'LISTENING': return <p className="text-cyan-400 animate-pulse">Listening...</p>;
                  case 'SUCCESS': return <p className="text-green-400 font-bold">Great job!</p>;
                  case 'TRY_AGAIN': return <p className="text-red-400">Not quite. You said: <span className="font-bold">{practiceTranscript}</span>. Try again!</p>;
                  default: return <p className="text-slate-300">Click the mic and say the word.</p>;
              }
          };
          return <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in">
              <div className="w-full max-w-2xl text-center">
                  <div className="flex justify-center flex-wrap gap-4 mb-12">
                      {practiceItem.phonemes.map((phoneme, index) => (
                          <div key={index} className="bg-white rounded-2xl p-4 flex flex-col items-center justify-between gap-4 shadow-lg w-32">
                              <span className="text-purple-600 font-bold text-4xl sm:text-5xl" style={{minHeight: '48px'}}>{phoneme}</span>
                              <button onClick={() => pronounceWord(phoneme)} className="p-1" aria-label={`Listen to ${phoneme}`}>
                                  <PracticeSoundIcon />
                              </button>
                          </div>
                      ))}
                  </div>
                  <div className="flex flex-col items-center gap-4">
                      {practiceStatus === 'LISTENING' ? (
                          <button onClick={stopPracticeRecognition}
                              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300 transform bg-red-500 hover:bg-red-600 hover:scale-105">
                              <StopIcon className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
                          </button>
                      ) : (
                          <button onClick={startPracticeRecognition} disabled={practiceStatus !== 'IDLE'}
                              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300 transform bg-purple-600 hover:bg-purple-500 hover:scale-105 disabled:bg-slate-500 disabled:scale-100 disabled:cursor-not-allowed">
                              <MicrophoneIcon className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                          </button>
                      )}
                      <div className="h-8 text-xl mt-2">{getStatusMessage()}</div>
                  </div>
              </div>
              <button onClick={onComplete} className="absolute bottom-6 right-6 text-slate-400 hover:text-white font-semibold transition-colors bg-black/30 px-4 py-2 rounded-lg">
                  Finish Practice
              </button>
          </div>
      }
      case 'COMPLETE': return <div className="text-center flex flex-col items-center justify-center h-full p-4">
            <p className="text-3xl sm:text-4xl text-green-400 mb-2">Perfect!</p>
            <p className="text-lg sm:text-xl text-slate-300 mb-8">You read everything correctly. Great job!</p>
            <button onClick={() => onComplete()} className="px-6 py-3 sm:px-8 sm:py-4 bg-green-600 text-white font-bold rounded-lg text-xl sm:text-2xl w-full max-w-xs hover:bg-green-700 transition-transform transform hover:scale-105">Finish</button>
        </div>;
      default: return null;
    }
  };

  return (
    <div className="w-full h-full text-white relative flex flex-col justify-center animate-fade-in">
        <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 w-full px-4 text-center z-20 pointer-events-none">
             <h1 className="text-3xl sm:text-5xl font-bold text-cyan-400" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>{step === 'PRACTICE' ? "Let's Practice!" : subTopic}</h1>
        </div>
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-slate-900/70 px-4 py-2 rounded-lg text-base sm:text-lg font-bold text-cyan-300 z-20 backdrop-blur-sm">
          Level: {currentLevel}
        </div>
        <button
            onClick={onBackToTopics}
            className="absolute top-4 left-4 sm:top-6 sm:left-6 text-slate-300 hover:text-white transition-colors z-20 font-bold flex items-center gap-2 text-sm sm:text-base"
        >
            <span className="text-xl sm:text-2xl">&larr;</span> Back to Topics
        </button>
        {error && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><div className="text-center text-red-400 p-4 bg-slate-800 rounded-lg shadow-lg"><p>{error}</p><button onClick={generatePassageAndImage} className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg">Try Again</button></div></div>}
        <div className="flex-grow flex flex-col justify-center overflow-hidden pt-20 sm:pt-24">
            {renderContent()}
        </div>
    </div>
  );
};
