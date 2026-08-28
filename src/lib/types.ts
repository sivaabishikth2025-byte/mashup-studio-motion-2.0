export type Classification = {
  kingdom: string;
  species: string;
  habitat: string;
  diet: string;
  lifespan: string;
  threatLevel: string;
};

export type Mashup = {
  id: string;
  name: string;
  tagline: string;
  origin: string;
  abilities: string[];
  personality: string;
  facts: string[];
  advertisement: string;
  warning: string;
  classification: Classification;
  patent: string;
  imagePrompt: string;
  imageUrl: string;
  audioUrl?: string;
  videoUrl?: string;
  videoStatus?: string;
  videoError?: string;
  videoStyle?: string;
  videoSeconds?: number;
  videoBeats?: string[];
  voiceId?: string;
  musicUrl?: string;
  ingredients: string[];
  ingredientIds?: string[];
  challengeDate: string | null;
  createdAt: string;
  language?: string;
  mode?: string;
};

export type GalleryItem = Pick<
  Mashup,
  "id" | "name" | "tagline" | "imageUrl" | "ingredients" | "createdAt" | "challengeDate"
> & { canDelete?: boolean; videoUrl?: string };
