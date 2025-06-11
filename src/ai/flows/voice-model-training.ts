
'use server';

/**
 * @fileOverview Flow for training a custom voice model using a user-provided audio sample, by calling an external Python API.
 *
 * - trainVoiceModel - A function that initiates the voice model training process.
 * - TrainVoiceModelInput - The input type for the trainVoiceModel function, including the audio sample.
 * - TrainVoiceModelOutput - The return type for the trainVoiceModel function, indicating the status of the training.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PYTHON_API_BASE_URL = 'http://localhost:8000/api'; // Replace with your Python service URL if different

// Define the input schema for the voice model training flow.
const TrainVoiceModelInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      'An audio sample of the user voice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
  modelName: z.string().describe('A name for the new voice model.'),
});
export type TrainVoiceModelInput = z.infer<typeof TrainVoiceModelInputSchema>;

// Define the output schema for the voice model training flow.
const TrainVoiceModelOutputSchema = z.object({
  trainingStatus: z
    .string()
    .describe('The status of the voice model training process (e.g., "pending", "completed", "failed").'),
  modelId: z.string().optional().describe('The ID of the trained voice model, if training is successful.'),
});
export type TrainVoiceModelOutput = z.infer<typeof TrainVoiceModelOutputSchema>;

// Exported function to initiate voice model training.
export async function trainVoiceModel(input: TrainVoiceModelInput): Promise<TrainVoiceModelOutput> {
  return trainVoiceModelFlow(input);
}

// Define the Genkit flow for training the voice model.
const trainVoiceModelFlow = ai.defineFlow(
  {
    name: 'trainVoiceModelFlow',
    inputSchema: TrainVoiceModelInputSchema,
    outputSchema: TrainVoiceModelOutputSchema,
  },
  async (input: TrainVoiceModelInput) => {
    /**
     * This flow calls an external Python API (e.g., using coqui/XTTS-v2) to train a voice model.
     *
     * Expected Python API endpoint: POST `${PYTHON_API_BASE_URL}/train-voice`
     * Request body (JSON):
     * {
     *   "modelName": "string",
     *   "audioDataUri": "data:audio/wav;base64,..."
     * }
     *
     * Expected Python API response (JSON):
     * {
     *   "trainingStatus": "string (e.g., 'completed', 'pending', 'failed')",
     *   "modelId": "string (optional, ID of the new model)"
     * }
     */
    try {
      const response = await fetch(`${PYTHON_API_BASE_URL}/train-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`External voice training API request failed with status ${response.status}: ${errorBody}`);
      }

      const result: TrainVoiceModelOutput = await response.json();
      return result;
    } catch (error) {
      console.error('Error calling external voice training API:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to train voice model via external API: ${error.message}`);
      }
      throw new Error('An unknown error occurred while training voice model via external API.');
    }
  }
);
