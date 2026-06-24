export interface Mineral {
  id: string; // Unique code
  normalizedId?: string; // Normalized version for uniqueness check
  name: string;
  photoUrl?: string;
  photos?: string[];
  origin: string;
  acquisitionMode: 'acquisto' | 'ritrovamento' | 'scambio' | 'donazione';
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
  notes?: string;
  ownerId: string;
  createdAt: any; // Firestore Timestamp
  docId?: string; // Firestore document ID
}
