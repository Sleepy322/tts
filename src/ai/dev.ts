import { config } from 'dotenv';
config();

import '@/ai/flows/voice-model-training.ts';
import '@/ai/flows/voice-customization.ts';
import '@/ai/flows/voice-generation.ts';