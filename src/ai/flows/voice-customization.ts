
'use server';

/**
 * @fileOverview Customizes voice parameters like speed and variability for TTS by calling an external Python API.
 *
 * - customizeVoice - A function that customizes the voice parameters and generates speech.
 * - CustomizeVoiceInput - The input type for the customizeVoice function.
 * - CustomizeVoiceOutput - The return type for the customizeVoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PYTHON_API_BASE_URL = 'http://localhost:8000/api'; // Replace with your Python service URL if different

const CustomizeVoiceInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voiceId: z.string().describe('The ID of the voice to use.'),
  speed: z.number().min(0.5).max(2.0).default(1.0).describe('The speed of the speech. 1.0 is normal speed.'),
  variability: z.number().min(0).max(1.0).default(0.5).describe('The variability of the voice. 0.0 is no variability, 1.0 is maximum variability.'),
});
export type CustomizeVoiceInput = z.infer<typeof CustomizeVoiceInputSchema>;

// Updated to return audioDataUri for consistency with generateSpeech and direct use
const CustomizeVoiceOutputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      'The generated speech as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type CustomizeVoiceOutput = z.infer<typeof CustomizeVoiceOutputSchema>;

export async function customizeVoice(input: CustomizeVoiceInput): Promise<CustomizeVoiceOutput> {
  return customizeVoiceFlow(input);
}

const customizeVoiceFlow = ai.defineFlow(
  {
    name: 'customizeVoiceFlow',
    inputSchema: CustomizeVoiceInputSchema,
    outputSchema: CustomizeVoiceOutputSchema,
  },
  async (input: CustomizeVoiceInput) => {
    /**
     * This flow calls an external Python API (e.g., using coqui/XTTS-v2) to generate speech
     * with specific speed and variability settings.
     *
     * Expected Python API endpoint: POST `${PYTHON_API_BASE_URL}/tts`
     * Request body (JSON):
     * {
     *   "text": "string",
     *   "voiceId": "string",
     *   "speed": number,
     *   "variability": number
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
        body: JSON.stringify(input), // Input schema matches the expected body
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`External TTS API (customization) request failed with status ${response.status}: ${errorBody}`);
      }

      const result: CustomizeVoiceOutput = await response.json();
       if (!result.audioDataUri || !result.audioDataUri.startsWith('data:audio')) {
        throw new Error('Invalid audioDataUri received from external TTS API (customization).');
      }
      return result;
    } catch (error) {
      console.error('Error calling external TTS API (customization):', error);
      if (error instanceof Error) {
         throw new Error(`Failed to customize voice via external API: ${error.message}`);
      }
      throw new Error('An unknown error occurred while customizing voice via external API.');
    }
  }
);
