// Tipo para qualidade da medição
export type MeasurementQuality = 'high' | 'medium' | 'low';

// Tipo para landmarks faciais
export interface FacialLandmarks {
  leftEye: {
    x: number;
    y: number;
  };
  rightEye: {
    x: number;
    y: number;
  };
  nose: {
    x: number;
    y: number;
  };
  confidence: number;
}

// Tipo para medições ópticas
export interface OpticalMeasurements {
  dp: number; // Distância pupilar total
  dpnLeft: number; // Distância pupilar nasal esquerda
  dpnRight: number; // Distância pupilar nasal direita
  apLeft: number; // Altura pupilar esquerda
  apRight: number; // Altura pupilar direita
  type: 'manual' | 'digital';
  notes?: string;
  imageUrl?: string;
  landmarks?: FacialLandmarks;
  quality?: MeasurementQuality;
  confidence?: number;
  warnings?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Tipo para resultado da análise de qualidade
export interface QualityAnalysis {
  isGood: boolean;
  message: string;
  quality: MeasurementQuality;
  details: {
    resolution: {
      width: number;
      height: number;
      isGood: boolean;
    };
    brightness: {
      value: number;
      isGood: boolean;
    };
    sharpness: {
      value: number;
      isGood: boolean;
    };
    faceAngle: {
      value: number;
      isGood: boolean;
    };
  };
}

// Tipo para resultado da detecção facial
export interface FaceDetectionResult {
  success: boolean;
  landmarks?: FacialLandmarks;
  error?: string;
  quality?: QualityAnalysis;
}

// Tipo para resultado da análise de medições
export interface MeasurementAnalysis {
  measurements: OpticalMeasurements;
  quality: QualityAnalysis;
  warnings: string[];
  recommendations?: string[];
}

// Tipo para histórico de medições
export interface MeasurementHistory {
  id: string;
  userId: string;
  measurements: OpticalMeasurements;
  createdAt: Date;
  updatedAt: Date;
}

// Tipo para estatísticas de medições
export interface MeasurementStats {
  average: {
    dp: number;
    dpnLeft: number;
    dpnRight: number;
    apLeft: number;
    apRight: number;
  };
  min: {
    dp: number;
    dpnLeft: number;
    dpnRight: number;
    apLeft: number;
    apRight: number;
  };
  max: {
    dp: number;
    dpnLeft: number;
    dpnRight: number;
    apLeft: number;
    apRight: number;
  };
  standardDeviation: {
    dp: number;
    dpnLeft: number;
    dpnRight: number;
    apLeft: number;
    apRight: number;
  };
  trends: {
    dp: 'increasing' | 'decreasing' | 'stable';
    dpnLeft: 'increasing' | 'decreasing' | 'stable';
    dpnRight: 'increasing' | 'decreasing' | 'stable';
    apLeft: 'increasing' | 'decreasing' | 'stable';
    apRight: 'increasing' | 'decreasing' | 'stable';
  };
  significantChanges: {
    dp: boolean;
    dpnLeft: boolean;
    dpnRight: boolean;
    apLeft: boolean;
    apRight: boolean;
  };
} 