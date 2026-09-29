export interface Presentation {
  topic: string;
  event: string;
  eventType: 'conference' | 'workshop' | 'summit' | 'seminar';
  link?: string;
  year: number;
}

export interface Speaker {
  id: string;
  name: string;
  imageUrl?: string | string[];
  presentations: Presentation[];
}
