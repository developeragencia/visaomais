import { calculateDistance, calculateAngle } from './geometry';

// Fator de calibração (mm por pixel)
const CALIBRATION_FACTOR = 0.264583333; // 1 pixel = 0.264583333 mm a 30cm de distância

// Calcular medições a partir dos landmarks
export function calculateMeasurements(
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
  },
  imageWidth: number,
  imageHeight: number
): {
  dp: number;
  dpnLeft: number;
  dpnRight: number;
  apLeft: number;
  apRight: number;
} {
  // Calcular distância pupilar total (DP)
  const dp = calculateDistance(landmarks.leftEye, landmarks.rightEye) * CALIBRATION_FACTOR;

  // Calcular distância pupilar nasal (DPN)
  const dpnLeft = calculateDistance(landmarks.leftEye, landmarks.nose) * CALIBRATION_FACTOR;
  const dpnRight = calculateDistance(landmarks.rightEye, landmarks.nose) * CALIBRATION_FACTOR;

  // Calcular altura pupilar (AP)
  // Assumindo que a linha horizontal dos olhos é a referência
  const eyeLineAngle = calculateAngle(landmarks.leftEye, landmarks.rightEye);
  const apLeft = Math.abs(
    (landmarks.leftEye.y - landmarks.nose.y) * Math.cos(eyeLineAngle) -
    (landmarks.leftEye.x - landmarks.nose.x) * Math.sin(eyeLineAngle)
  ) * CALIBRATION_FACTOR;

  const apRight = Math.abs(
    (landmarks.rightEye.y - landmarks.nose.y) * Math.cos(eyeLineAngle) -
    (landmarks.rightEye.x - landmarks.nose.x) * Math.sin(eyeLineAngle)
  ) * CALIBRATION_FACTOR;

  // Aplicar correções baseadas na distância da câmera
  const distanceCorrection = calculateDistanceCorrection(imageWidth, imageHeight);
  
  return {
    dp: dp * distanceCorrection,
    dpnLeft: dpnLeft * distanceCorrection,
    dpnRight: dpnRight * distanceCorrection,
    apLeft: apLeft * distanceCorrection,
    apRight: apRight * distanceCorrection
  };
}

// Calcular fator de correção baseado na distância da câmera
function calculateDistanceCorrection(imageWidth: number, imageHeight: number): number {
  // Assumindo que o rosto deve ocupar aproximadamente 60% da largura da imagem
  // quando a distância está correta (30cm)
  const expectedFaceWidth = imageWidth * 0.6;
  const actualFaceWidth = Math.abs(
    landmarks.rightEye.x - landmarks.leftEye.x
  ) * 3; // Aproximadamente 3x a distância entre os olhos

  // Calcular fator de correção
  const correctionFactor = expectedFaceWidth / actualFaceWidth;

  // Limitar o fator de correção para evitar valores extremos
  return Math.max(0.5, Math.min(2.0, correctionFactor));
}

// Calcular distância entre dois pontos
export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calcular ângulo entre dois pontos
export function calculateAngle(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  return Math.atan2(point2.y - point1.y, point2.x - point1.x);
}

// Calcular desvio pupilar
export function calculatePupilDeviation(
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
  }
): {
  horizontalDeviation: number;
  verticalDeviation: number;
} {
  // Calcular linha de referência (entre os olhos)
  const eyeLineAngle = calculateAngle(landmarks.leftEye, landmarks.rightEye);
  
  // Calcular desvio horizontal
  const horizontalDeviation = Math.abs(
    (landmarks.nose.x - landmarks.leftEye.x) * Math.cos(eyeLineAngle) +
    (landmarks.nose.y - landmarks.leftEye.y) * Math.sin(eyeLineAngle)
  ) * CALIBRATION_FACTOR;

  // Calcular desvio vertical
  const verticalDeviation = Math.abs(
    (landmarks.nose.y - landmarks.leftEye.y) * Math.cos(eyeLineAngle) -
    (landmarks.nose.x - landmarks.leftEye.x) * Math.sin(eyeLineAngle)
  ) * CALIBRATION_FACTOR;

  return {
    horizontalDeviation,
    verticalDeviation
  };
}

// Calcular assimetria facial
export function calculateFacialAsymmetry(
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
  }
): number {
  // Calcular distância do nariz até cada olho
  const leftEyeDistance = calculateDistance(landmarks.nose, landmarks.leftEye);
  const rightEyeDistance = calculateDistance(landmarks.nose, landmarks.rightEye);

  // Calcular diferença percentual
  const difference = Math.abs(leftEyeDistance - rightEyeDistance);
  const average = (leftEyeDistance + rightEyeDistance) / 2;

  return (difference / average) * 100;
}

// Calcular inclinação da cabeça
export function calculateHeadTilt(
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
  }
): number {
  const eyeLineAngle = calculateAngle(landmarks.leftEye, landmarks.rightEye);
  return (eyeLineAngle * 180) / Math.PI;
}

// Validar medições
export function validateMeasurements(measurements: {
  dp: number;
  dpnLeft: number;
  dpnRight: number;
  apLeft: number;
  apRight: number;
}): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar DP
  if (measurements.dp < 50 || measurements.dp > 80) {
    errors.push('A distância pupilar (DP) está fora do intervalo normal (50-80mm)');
  }

  // Validar DPN
  if (measurements.dpnLeft < 25 || measurements.dpnLeft > 40) {
    errors.push('A distância pupilar nasal esquerda está fora do intervalo normal (25-40mm)');
  }
  if (measurements.dpnRight < 25 || measurements.dpnRight > 40) {
    errors.push('A distância pupilar nasal direita está fora do intervalo normal (25-40mm)');
  }

  // Validar AP
  if (measurements.apLeft < 20 || measurements.apLeft > 35) {
    errors.push('A altura pupilar esquerda está fora do intervalo normal (20-35mm)');
  }
  if (measurements.apRight < 20 || measurements.apRight > 35) {
    errors.push('A altura pupilar direita está fora do intervalo normal (20-35mm)');
  }

  // Validar diferenças entre olhos
  if (Math.abs(measurements.dpnLeft - measurements.dpnRight) > 2) {
    errors.push('Há uma diferença significativa entre as distâncias pupilares nasais');
  }
  if (Math.abs(measurements.apLeft - measurements.apRight) > 2) {
    errors.push('Há uma diferença significativa entre as alturas pupilares');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
} 