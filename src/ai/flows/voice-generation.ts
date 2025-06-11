
'use server';

/**
 * @fileOverview Text-to-speech generation flow using a selected voice, by calling an external Python API.
 *
 * - generateSpeech - A function that generates speech from text using a selected voice.
 * - GenerateSpeechInput - The input type for the generateSpeech function.
 * - GenerateSpeechOutput - The return type for the generateSpeech function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PYTHON_API_BASE_URL = 'http://localhost:8000/api'; // Replace with your Python service URL if different

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
  voiceId: z.string().describe('The ID of the voice to use for speech generation.'),
  speed: z.number().optional().describe('The speed of the generated speech (e.g., 0.5 to 2.0).'),
  variability: z.number().optional().describe('The variability of the generated speech (e.g., 0.0 to 1.0).'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      'The generated speech as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;

export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  return generateSpeechFlow(input);
}

const generateSpeechFlow = ai.defineFlow(
  {
    name: 'generateSpeechFlow',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input: GenerateSpeechInput) => {
    /**
     * This flow calls an external Python API (e.g., using coqui/XTTS-v2) to generate speech.
     *
     * Expected Python API endpoint: POST `${PYTHON_API_BASE_URL}/tts`
     * Request body (JSON):
     * {
     *   "text": "string",
     *   "voiceId": "string",
     *   "speed": number (optional),
     *   "variability": number (optional)
     * }
     *
     * Expected Python API response (JSON):
     * {
     *   "audioDataUri": "data:audio/wav;base64,..."
     * }
     */
    try {
      const response = await fetch(`${PYTHON_API_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`External TTS API request failed with status ${response.status}: ${errorBody}`);
      }

      const result: GenerateSpeechOutput = await response.json();
      if (!result.audioDataUri || !result.audioDataUri.startsWith('data:audio')) {
        throw new Error('Invalid audioDataUri received from external TTS API.');
      }
      return result;
    } catch (error) {
      console.error('Error calling external TTS API:', error);
      // Provide a more specific error or a fallback if necessary
      // For now, re-throw to let the caller handle it.
      if (error instanceof Error) {
        throw new Error(`Failed to generate speech via external API: ${error.message}`);
      }
      throw new Error('An unknown error occurred while generating speech via external API.');
    }
  }
);
