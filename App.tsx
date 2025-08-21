import React from 'react';
import { ReadingArenaGame } from './components/ReadingArena';
import { GradeSelectionScreen } from './components/GradeSelectionScreen';
import { LanguageSelectionScreen } from './components/LanguageSelectionScreen';
import { PermissionScreen } from './components/PermissionScreen';
import { ModeSelectionScreen } from './components/ModeSelectionScreen';
import { StoryArenaGame } from './components/StoryArena';


const preloadImages = (urls: string[]) => {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
};

export const App: React.FC = () => {
  const [userGrade, setUserGrade] = React.useState<number | null>(null);
  const [selectedMode, setSelectedMode] = React.useState<'ncert' | 'story' | null>(null);
  const [selectedLanguage, setSelectedLanguage] = React.useState<string | null>(null);
  const [micPermissionGranted, setMicPermissionGranted] = React.useState(false);

  React.useEffect(() => {
    preloadImages(['/Background.png', '/complete-background.png']);
  }, []);

  React.useEffect(() => {
    // Automatically check permission status if it's not already granted
    if (selectedMode && !micPermissionGranted) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
        if (permissionStatus.state === 'granted') {
          setMicPermissionGranted(true);
        }
      });
    }
  }, [selectedMode, selectedLanguage, micPermissionGranted]);

  const handleSetGrade = (grade: number) => {
    setUserGrade(grade);
    setSelectedMode(null);
    setSelectedLanguage(null);
    setMicPermissionGranted(false);
  };

  const handleModeSelect = (mode: 'ncert' | 'story') => {
    setSelectedMode(mode);
  };

  const handleLanguageSelect = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleBackToGrades = () => {
    setUserGrade(null);
    setSelectedMode(null);
    setSelectedLanguage(null);
    setMicPermissionGranted(false);
  };

  const handleBackToModes = () => {
    setSelectedMode(null);
    setSelectedLanguage(null);
    setMicPermissionGranted(false);
  };

  const handlePermissionGranted = () => {
    setMicPermissionGranted(true);
  };
  
  const renderContent = () => {
    if (!userGrade) {
      return <GradeSelectionScreen onGradeSelect={handleSetGrade} />;
    }
    if (!selectedMode) {
      return <ModeSelectionScreen onModeSelect={handleModeSelect} onBack={() => setUserGrade(null)} />;
    }
    
    if (selectedMode === 'ncert') {
      if (!micPermissionGranted) {
        return <PermissionScreen onPermissionGranted={handlePermissionGranted} onBack={handleBackToModes} />;
      }
      return <ReadingArenaGame
        onBack={handleBackToGrades}
        userName="Student"
        userClass={String(userGrade)}
      />;
    }

    if (selectedMode === 'story') {
      if (!selectedLanguage) {
        return <LanguageSelectionScreen onLanguageSelect={handleLanguageSelect} onBack={handleBackToModes} />;
      }
      if (!micPermissionGranted) {
        return <PermissionScreen onPermissionGranted={handlePermissionGranted} onBack={() => setSelectedLanguage(null)} />;
      }
      return <StoryArenaGame
        onBack={handleBackToGrades}
        userName="Student"
        userClass={String(userGrade)}
        language={selectedLanguage}
      />;
    }
    
    return null;
  };

  return (
    <main className="h-screen w-screen text-white font-sans flex flex-col select-none relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </div>
    </main>
  );
};