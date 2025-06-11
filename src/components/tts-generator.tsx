
"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useRef } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Play, Pause, Download, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateSpeech } from '@/ai/flows/voice-generation';
import type { Voice } from '@/app/page';

interface TtsGeneratorProps {
  voices: Voice[];
}

export default function TtsGenerator({ voices }: TtsGeneratorProps) {
  const [text, setText] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(voices[0]?.id || "");
  const [speed, setSpeed] = useState<number>(1.0);
  const [variability, setVariability] = useState<number>(0.5);
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const handleGenerateSpeech = async () => {
    if (!text.trim()) {
      toast({ title: "Ошибка", description: "Пожалуйста, введите текст для озвучки.", variant: "destructive" });
      return;
    }
    if (!selectedVoiceId) {
      toast({ title: "Ошибка", description: "Пожалуйста, выберите голос.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setAudioDataUri(null);
    try {
      const result = await generateSpeech({ text, voiceId: selectedVoiceId, speed, variability });
      setAudioDataUri(result.audioDataUri);
      toast({ title: "Успех", description: "Аудио сгенерировано." });
    } catch (error) {
      console.error("Error generating speech:", error);
      toast({ title: "Ошибка генерации", description: (error as Error).message || "Не удалось сгенерировать аудио.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    if (!audioDataUri) return;
    const link = document.createElement('a');
    link.href = audioDataUri;
    const mimeType = audioDataUri.substring(audioDataUri.indexOf(':') + 1, audioDataUri.indexOf(';'));
    const extension = mimeType.split('/')[1] || 'wav';
    link.download = `generated_speech_${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Загрузка", description: "Аудиофайл начал скачиваться." });
  };
  
  // Ensure selectedVoiceId is valid
  React.useEffect(() => {
    if (voices.length > 0 && !voices.find(v => v.id === selectedVoiceId)) {
      setSelectedVoiceId(voices[0].id);
    }
  }, [voices, selectedVoiceId]);


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-center text-primary">Синтез речи</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="text-input" className="font-semibold">Текст для озвучки</Label>
          <Textarea
            id="text-input"
            placeholder="Введите текст здесь..."
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            rows={6}
            className="border-input focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="voice-select" className="font-semibold">Выберите голос</Label>
            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
              <SelectTrigger id="voice-select" className="border-input focus:ring-primary">
                <SelectValue placeholder="Выберите голос" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center"><Settings2 className="mr-2 h-5 w-5 text-accent" />Настройки голоса</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="speed-slider" className="font-medium">Скорость: {speed.toFixed(1)}</Label>
              <Slider
                id="speed-slider"
                min={0.5}
                max={2.0}
                step={0.1}
                value={[speed]}
                onValueChange={(value) => setSpeed(value[0])}
                className="[&>span:first-child]:bg-accent"
              />
            </div>
            <div>
              <Label htmlFor="variability-slider" className="font-medium">Вариативность: {variability.toFixed(1)}</Label>
              <Slider
                id="variability-slider"
                min={0}
                max={1.0}
                step={0.1}
                value={[variability]}
                onValueChange={(value) => setVariability(value[0])}
                className="[&>span:first-child]:bg-accent"
              />
            </div>
          </div>
        </Card>

        <Button onClick={handleGenerateSpeech} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isLoading ? "Генерация..." : "Сгенерировать аудио"}
        </Button>

        {audioDataUri && (
          <Card className="mt-6 bg-muted/50">
            <CardHeader>
              <CardTitle className="text-xl font-headline text-center">Результат</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <audio 
                ref={audioRef} 
                src={audioDataUri} 
                onEnded={() => setIsPlaying(false)} 
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full"
                controls
              />
            </CardContent>
            <CardFooter className="flex justify-center space-x-4">
                <Button onClick={handlePlayPause} variant="outline" className="border-accent text-accent hover:bg-accent/10">
                  {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {isPlaying ? "Пауза" : "Воспроизвести"}
                </Button>
                <Button onClick={handleDownload} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Download className="mr-2 h-4 w-4" />
                  Скачать
                </Button>
            </CardFooter>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
