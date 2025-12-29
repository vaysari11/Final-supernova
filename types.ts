
export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface VoiceOption {
  name: VoiceName;
  label: string;
  description: string;
}

export interface ParagraphBlock {
  id: string;
  text: string;
  audioUrl?: string | null;
  status: 'idle' | 'processing' | 'error';
}

export interface Chapter {
  id: string;
  title: string;
  paragraphs: ParagraphBlock[];
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  paragraphs: ParagraphBlock[];
  createdAt: number;
  voice: VoiceName;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  { name: 'Kore', label: 'Classic Narrator', description: 'Formal and authoritative Urdu' },
  { name: 'Zephyr', label: 'Poetic Soul', description: 'Smooth and expressive delivery' },
  { name: 'Puck', label: 'Clear & Bright', description: 'Modern, crisp articulation' },
  { name: 'Charon', label: 'Deep Sage', description: 'Rich, resonant tones for literature' }
];
