
"use client";

import type { ChangeEvent } from 'react';
import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UploadCloud, MicVocal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trainVoiceModel } from '@/ai/flows/voice-model-training';
import type { Voice } from '@/app/page';

interface VoiceTrainerProps {
  onVoiceTrained: (newVoice: Voice) => void;
  trainedVoices: Voice[];
}

export default function VoiceTrainer({ onVoiceTrained, trainedVoices }: VoiceTrainerProps) {
  const [modelName, setModelName] = useState<string>("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Ошибка", description: "Размер файла не должен превышать 5MB.", variant: "destructive" });
        event.target.value = ''; // Reset file input
        return;
      }
      if (!['audio/wav', 'audio/mpeg', 'audio/mp3'].includes(file.type)) {
         toast({ title: "Ошибка", description: "Пожалуйста, загрузите файл в формате WAV или MP3.", variant: "destructive" });
         event.target.value = ''; // Reset file input
         return;
      }
      setAudioFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAudioDataUri(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAudioFile(null);
      setAudioDataUri(null);
    }
  };

  const handleTrainModel = async () => {
    if (!modelName.trim()) {
      toast({ title: "Ошибка", description: "Пожалуйста, введите название модели.", variant: "destructive" });
      return;
    }
    if (!audioDataUri) {
      toast({ title: "Ошибка", description: "Пожалуйста, загрузите аудиофайл.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const result = await trainVoiceModel({ modelName, audioDataUri });
      if (result.modelId) {
        onVoiceTrained({ id: result.modelId, name: modelName });
        toast({ title: "Успех", description: `Модель "${modelName}" обучена. Статус: ${result.trainingStatus}` });
        setModelName("");
        setAudioFile(null);
        setAudioDataUri(null);
        // Reset file input visually
        const fileInput = document.getElementById('audio-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

      } else {
         toast({ title: "Ошибка обучения", description: "Не удалось получить ID модели.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error training model:", error);
      toast({ title: "Ошибка обучения", description: (error as Error).message || "Не удалось обучить модель.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-center text-primary">Тренировка новой голосовой модели</CardTitle>
          <CardDescription className="text-center">
            Загрузите аудио сэмпл (рекомендуется .wav или .mp3, &lt;5MB, чистая речь без фонового шума, длительностью 1-5 минут) для создания новой озвучки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="model-name" className="font-semibold">Название модели</Label>
            <Input
              id="model-name"
              placeholder="Например, Мой Голос v1"
              value={modelName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setModelName(e.target.value)}
              className="border-input focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audio-upload" className="font-semibold">Аудиофайл для обучения</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="audio-upload"
                type="file"
                accept="audio/wav, audio/mpeg, audio/mp3"
                onChange={handleFileChange}
                className="border-input file:text-primary file:font-medium hover:file:bg-primary/10 focus:ring-primary"
              />
              {audioFile && <UploadCloud className="h-5 w-5 text-accent" />}
            </div>
            {audioFile && (
              <p className="text-sm text-muted-foreground">Выбран файл: {audioFile.name} ({(audioFile.size / 1024).toFixed(2)} KB)</p>
            )}
          </div>

          <Button onClick={handleTrainModel} disabled={isLoading || !audioDataUri || !modelName} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isLoading ? "Обучение..." : "Начать обучение модели"}
          </Button>
        </CardContent>
      </Card>

      {trainedVoices.length > 0 && (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-headline text-primary flex items-center">
              <MicVocal className="mr-2 h-5 w-5" />
              Ваши обученные голоса
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {trainedVoices.map(voice => (
                <li key={voice.id} className="p-3 bg-muted/50 rounded-md text-sm">
                  <span className="font-medium">{voice.name}</span> (ID: {voice.id})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
