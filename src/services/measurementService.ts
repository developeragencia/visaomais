import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from 'face-api.js';
import { canvas, faceDetectionNet, faceDetectionOptions } from '../utils/faceDetection';
import { calculateMeasurements } from '../utils/measurementCalculations';
import { MeasurementQuality } from '../types/measurements';

// Inicializar modelos do face-api.js
let modelsLoaded = false;

async function loadModels() {
  if (!modelsLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromDisk('models');
    await faceapi.nets.faceLandmark68Net.loadFromDisk('models');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('models');
    modelsLoaded = true;
  }
}

// Detectar landmarks faciais
export async function detectFacialLandmarks(imageData: string): Promise<{
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
  };
  confidence: number;
}> {
  try {
    await loadModels();

    // Converter imagem base64 para tensor
    const image = await canvas.loadImage(imageData);
    const detections = await faceapi
      .detectSingleFace(image, faceDetectionOptions)
      .withFaceLandmarks();

    if (!detections) {
      throw new Error('Nenhum rosto detectado na imagem');
    }

    // Extrair pontos faciais relevantes
    const landmarks = detections.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();

    // Calcular centro dos olhos
    const leftEyeCenter = {
      x: leftEye.reduce((sum, point) => sum + point.x, 0) / leftEye.length,
      y: leftEye.reduce((sum, point) => sum + point.y, 0) / leftEye.length
    };

    const rightEyeCenter = {
      x: rightEye.reduce((sum, point) => sum + point.x, 0) / rightEye.length,
      y: rightEye.reduce((sum, point) => sum + point.y, 0) / rightEye.length
    };

    const noseCenter = {
      x: nose.reduce((sum, point) => sum + point.x, 0) / nose.length,
      y: nose.reduce((sum, point) => sum + point.y, 0) / nose.length
    };

    // Calcular confiança baseada na qualidade da detecção
    const confidence = detections.detection.score;

    return {
      landmarks: {
        leftEye: leftEyeCenter,
        rightEye: rightEyeCenter,
        nose: noseCenter
      },
      confidence
    };
  } catch (error) {
    console.error('Erro na detecção de landmarks:', error);
    throw new Error('Falha ao detectar pontos faciais');
  }
}

// Analisar medições
export async function analyzeMeasurements(
  imageData: string,
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
  }
): Promise<{
  dp: number;
  dpnLeft: number;
  dpnRight: number;
  apLeft: number;
  apRight: number;
  quality: MeasurementQuality;
  confidence: number;
  warnings: string[];
}> {
  try {
    // Carregar imagem para análise
    const image = await canvas.loadImage(imageData);
    const imageWidth = image.width;
    const imageHeight = image.height;

    // Calcular medições usando os landmarks
    const measurements = calculateMeasurements(landmarks, imageWidth, imageHeight);

    // Verificar qualidade da imagem
    const quality = await assessImageQuality(imageData, landmarks);

    // Gerar avisos baseados na qualidade e medições
    const warnings = generateWarnings(measurements, quality, landmarks.confidence);

    return {
      ...measurements,
      quality,
      confidence: landmarks.confidence,
      warnings
    };
  } catch (error) {
    console.error('Erro na análise de medições:', error);
    throw new Error('Falha ao analisar medições');
  }
}

// Avaliar qualidade da imagem
async function assessImageQuality(
  imageData: string,
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
  }
): Promise<MeasurementQuality> {
  try {
    const image = await canvas.loadImage(imageData);
    
    // Verificar resolução
    const minResolution = 640 * 480;
    const resolution = image.width * image.height;
    
    // Verificar iluminação
    const brightness = await calculateBrightness(image);
    
    // Verificar nitidez
    const sharpness = await calculateSharpness(image);
    
    // Verificar ângulo do rosto
    const faceAngle = calculateFaceAngle(landmarks);
    
    // Pontuação geral
    let score = 0;
    
    // Resolução
    if (resolution >= minResolution) score += 2;
    else if (resolution >= minResolution * 0.75) score += 1;
    
    // Iluminação
    if (brightness >= 0.4 && brightness <= 0.8) score += 2;
    else if (brightness >= 0.3 && brightness <= 0.9) score += 1;
    
    // Nitidez
    if (sharpness >= 0.7) score += 2;
    else if (sharpness >= 0.5) score += 1;
    
    // Ângulo do rosto
    if (Math.abs(faceAngle) <= 5) score += 2;
    else if (Math.abs(faceAngle) <= 15) score += 1;
    
    // Determinar qualidade
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  } catch (error) {
    console.error('Erro ao avaliar qualidade:', error);
    return 'low';
  }
}

// Calcular brilho da imagem
async function calculateBrightness(image: HTMLCanvasElement): Promise<number> {
  const ctx = image.getContext('2d');
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  
  let brightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    brightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  }
  
  return brightness / (data.length / 4);
}

// Calcular nitidez da imagem
async function calculateSharpness(image: HTMLCanvasElement): Promise<number> {
  const ctx = image.getContext('2d');
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  
  let sharpness = 0;
  const width = image.width;
  
  for (let y = 1; y < image.height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Calcular diferença entre pixels adjacentes
      const diffX = Math.abs(
        data[idx] - data[idx + 4] +
        data[idx + 1] - data[idx + 5] +
        data[idx + 2] - data[idx + 6]
      );
      
      const diffY = Math.abs(
        data[idx] - data[idx + width * 4] +
        data[idx + 1] - data[idx + width * 4 + 1] +
        data[idx + 2] - data[idx + width * 4 + 2]
      );
      
      sharpness += (diffX + diffY) / 6;
    }
  }
  
  return sharpness / (image.width * image.height);
}

// Calcular ângulo do rosto
function calculateFaceAngle(landmarks: {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  nose: { x: number; y: number };
}): number {
  const eyeAngle = Math.atan2(
    landmarks.rightEye.y - landmarks.leftEye.y,
    landmarks.rightEye.x - landmarks.leftEye.x
  );
  
  return (eyeAngle * 180) / Math.PI;
}

// Gerar avisos baseados na análise
function generateWarnings(
  measurements: {
    dp: number;
    dpnLeft: number;
    dpnRight: number;
    apLeft: number;
    apRight: number;
  },
  quality: MeasurementQuality,
  confidence: number
): string[] {
  const warnings: string[] = [];

  // Avisos de qualidade
  if (quality === 'low') {
    warnings.push('A qualidade da imagem está baixa. Tente melhorar a iluminação e manter o rosto centralizado.');
  }

  // Avisos de confiança
  if (confidence < 0.7) {
    warnings.push('A detecção facial não está muito precisa. Tente reposicionar o rosto.');
  }

  // Avisos de medições
  if (Math.abs(measurements.dpnLeft - measurements.dpnRight) > 2) {
    warnings.push('Há uma diferença significativa entre as medições dos olhos esquerdo e direito.');
  }

  if (Math.abs(measurements.apLeft - measurements.apRight) > 2) {
    warnings.push('Há uma diferença significativa entre as alturas das pupilas.');
  }

  // Verificar valores fora do normal
  if (measurements.dp < 55 || measurements.dp > 75) {
    warnings.push('A distância pupilar (DP) está fora do intervalo normal.');
  }

  if (measurements.dpnLeft < 27 || measurements.dpnLeft > 37) {
    warnings.push('A distância pupilar nasal esquerda está fora do intervalo normal.');
  }

  if (measurements.dpnRight < 27 || measurements.dpnRight > 37) {
    warnings.push('A distância pupilar nasal direita está fora do intervalo normal.');
  }

  if (measurements.apLeft < 22 || measurements.apLeft > 32) {
    warnings.push('A altura pupilar esquerda está fora do intervalo normal.');
  }

  if (measurements.apRight < 22 || measurements.apRight > 32) {
    warnings.push('A altura pupilar direita está fora do intervalo normal.');
  }

  return warnings;
} 