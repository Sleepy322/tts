
"use client";

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TtsGenerator from '@/components/tts-generator';
import VoiceTrainer from '@/components/voice-trainer';
import { MicVocal } from 'lucide-react';

export type Voice = {
  id: string;
  name: string;
};

const initialVoices: Voice[] = [
  { id: 'default-male', name: 'Стандартный мужской' },
  { id: 'default-female', name: 'Стандартный женский' },
];

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>(() => {
    if (typeof window !== 'undefined') {
      const savedVoices = localStorage.getItem('trainedVoices');
      if (savedVoices) {
        try {
          const parsedVoices = JSON.parse(savedVoices);
          // Ensure initial voices are always present and merge with saved ones, avoiding duplicates by ID
          const uniqueSaved = parsedVoices.filter((sv: Voice) => !initialVoices.some(iv => iv.id === sv.id));
          return [...initialVoices, ...uniqueSaved];
        } catch (e) {
          console.error("Failed to parse voices from localStorage", e);
        }
      }
    }
    return initialVoices;
  });
  
  const [selectedTab, setSelectedTab] = useState("tts");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Save only user-trained voices to localStorage
      const userTrainedVoices = voices.filter(v => !initialVoices.some(iv => iv.id === v.id));
      localStorage.setItem('trainedVoices', JSON.stringify(userTrainedVoices));
    }
  }, [voices]);

  const addVoice = (newVoice: Voice) => {
    setVoices(prevVoices => {
      // Prevent adding duplicates
      if (prevVoices.find(v => v.id === newVoice.id)) {
        return prevVoices;
      }
      return [...prevVoices, newVoice];
    });
  };
  
  const userTrainedVoices = voices.filter(v => !initialVoices.some(iv => iv.id === v.id));

  return (
    <div className="container mx-auto px-2 py-4 md:px-4 md:py-8 flex flex-col min-h-screen bg-background text-foreground font-body">
      <header className="mb-6 md:mb-10 text-center">
        <div className="inline-flex items-center">
          <MicVocal className="h-10 w-10 md:h-12 md:w-12 text-primary mr-3" />
          <h1 className="text-3xl md:text-5xl font-headline font-bold text-primary">
            VoiceForge Studio
          </h1>
        </div>
      </header>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full flex-grow flex flex-col">
        <TabsList className="mx-auto mb-4 md:mb-8 sticky top-2 bg-background z-10 p-1 rounded-lg shadow-sm">
          <TabsTrigger value="tts" className="px-4 py-2 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Синтез речи</TabsTrigger>
          <TabsTrigger value="training" className="px-4 py-2 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Тренировка голоса</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tts" className="flex-grow outline-none ring-0 focus-visible:ring-0">
          <TtsGenerator voices={voices} />
        </TabsContent>
        <TabsContent value="training" className="flex-grow outline-none ring-0 focus-visible:ring-0">
          <VoiceTrainer onVoiceTrained={addVoice} trainedVoices={userTrainedVoices} />
        </TabsContent>
      </Tabs>
      
      <footer className="text-center mt-8 py-4 border-t border-border">
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} VoiceForge Studio. Все права защищены.</p>
      </footer>
    </div>
  );
}
