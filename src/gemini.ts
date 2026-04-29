import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptionSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<TranscriptionSegment[]> {
  const model = "gemini-3.1-pro-preview"; // Best for analysis
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          data: base64Audio,
          mimeType,
        },
      },
      {
        text: "Transcribe this audio precisely. Return a JSON array of objects, each containing 'startTime' (seconds), 'endTime' (seconds), and 'text'. Include 'speaker' if there are multiple people. Ensure the timestamps are as accurate as possible to the speech.",
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse transcription JSON", e);
    return [];
  }
}

export const VOICE_PROFILES = [
  { id: 'Puck', name: 'Puck', gender: 'Male', description: 'Energetic and bright' },
  { id: 'Charon', name: 'Charon', gender: 'Male', description: 'Deep and resonant' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', description: 'Strong and authoritative' },
  { id: 'Kore', name: 'Kore', gender: 'Female', description: 'Warm and clear' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', description: 'Soft and airy' },
] as const;

export type VoiceID = typeof VOICE_PROFILES[number]['id'];

export interface SpeakerMapping {
  [speakerId: string]: VoiceID;
}

export async function recreateDialogue(
  base64Audio: string, 
  mimeType: string, 
  speakerMapping: SpeakerMapping,
  editedSegments?: TranscriptionSegment[]
): Promise<{ audioBase64: string; mimeType: string }> {
  // Use a model that supports audio output
  const model = "gemini-3.1-flash-live-preview"; 
  
  const mappingString = Object.entries(speakerMapping)
    .map(([speaker, voice]) => `${speaker} should use the '${voice}' voice profile`)
    .join(', ');

  const textReference = editedSegments 
    ? `\n\nUSE THIS CORRECTED TRANSCRIPT AND TIMING AS THE SOURCE OF TRUTH:\n${JSON.stringify(editedSegments)}`
    : '';
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          data: base64Audio,
          mimeType,
        },
      },
      {
        text: `Recreate this multi-person dialogue. ${mappingString}.${textReference}
        CRITICAL REQUIREMENT: The output audio MUST match the original audio's duration and timing perfectly. 
        Keep the exactly same pauses and speaking speed. Use the text provided in the transcript reference to ensure correct pronunciation.
        Respond with ONLY the audio data. Ensure character voices are distinct according to the mapping.`,
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  
  if (!audioPart || !audioPart.inlineData) {
    throw new Error("No audio returned from Gemini");
  }

  return {
    audioBase64: audioPart.inlineData.data,
    mimeType: audioPart.inlineData.mimeType || "audio/wav",
  };
}
