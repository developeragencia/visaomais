import { createCanvas, loadImage } from 'canvas';
import { QualityAnalysis, MeasurementQuality } from '../types/measurements';

// Validar qualidade da imagem
export async function validateImageQuality(imageData: string): Promise<QualityAnalysis> {
  try {
    const image = await loadImage(imageData);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // Analisar resolução
    const resolution = analyzeResolution(image.width, image.height);

    // Analisar brilho
    const brightness = await analyzeBrightness(ctx, image.width, image.height);

    // Analisar nitidez
    const sharpness = await analyzeSharpness(ctx, image.width, image.height);

    // Determinar qualidade geral
    const quality = determineQuality(resolution, brightness, sharpness);

    // Gerar mensagem baseada na qualidade
    const message = generateQualityMessage(quality, {
      resolution,
      brightness,
      sharpness
    });

    return {
      isGood: quality !== 'low',
      message,
      quality,
      details: {
        resolution,
        brightness,
        sharpness,
        faceAngle: {
          value: 0, // Será calculado durante a detecção facial
          isGood: true
        }
      }
    };
  } catch (error) {
    console.error('Erro ao validar qualidade da imagem:', error);
    return {
      isGood: false,
      message: 'Erro ao processar imagem',
      quality: 'low',
      details: {
        resolution: {
          width: 0,
          height: 0,
          isGood: false
        },
        brightness: {
          value: 0,
          isGood: false
        },
        sharpness: {
          value: 0,
          isGood: false
        },
        faceAngle: {
          value: 0,
          isGood: false
        }
      }
    };
  }
}

// Analisar resolução da imagem
function analyzeResolution(width: number, height: number): {
  width: number;
  height: number;
  isGood: boolean;
} {
  const minResolution = 640 * 480;
  const currentResolution = width * height;
  const isGood = currentResolution >= minResolution;

  return {
    width,
    height,
    isGood
  };
}

// Analisar brilho da imagem
async function analyzeBrightness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<{
  value: number;
  isGood: boolean;
}> {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let brightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    brightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  }

  const averageBrightness = brightness / (data.length / 4);
  const isGood = averageBrightness >= 0.3 && averageBrightness <= 0.9;

  return {
    value: averageBrightness,
    isGood
  };
}

// Analisar nitidez da imagem
async function analyzeSharpness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<{
  value: number;
  isGood: boolean;
}> {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let sharpness = 0;
  for (let y = 1; y < height - 1; y++) {
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

  const averageSharpness = sharpness / (width * height);
  const isGood = averageSharpness >= 0.5;

  return {
    value: averageSharpness,
    isGood
  };
}

// Determinar qualidade geral
function determineQuality(
  resolution: { isGood: boolean },
  brightness: { isGood: boolean },
  sharpness: { isGood: boolean }
): MeasurementQuality {
  const goodCount = [resolution, brightness, sharpness].filter(
    metric => metric.isGood
  ).length;

  if (goodCount >= 2) return 'high';
  if (goodCount === 1) return 'medium';
  return 'low';
}

// Gerar mensagem de qualidade
function generateQualityMessage(
  quality: MeasurementQuality,
  metrics: {
    resolution: { isGood: boolean };
    brightness: { isGood: boolean };
    sharpness: { isGood: boolean };
  }
): string {
  const issues: string[] = [];

  if (!metrics.resolution.isGood) {
    issues.push('resolução baixa');
  }
  if (!metrics.brightness.isGood) {
    issues.push('iluminação inadequada');
  }
  if (!metrics.sharpness.isGood) {
    issues.push('imagem desfocada');
  }

  if (issues.length === 0) {
    return 'A qualidade da imagem está boa.';
  }

  return `A qualidade da imagem precisa melhorar: ${issues.join(', ')}.`;
}

// Redimensionar imagem mantendo proporção
export async function resizeImage(
  imageData: string,
  maxWidth: number,
  maxHeight: number
): Promise<string> {
  const image = await loadImage(imageData);
  const canvas = createCanvas(maxWidth, maxHeight);
  const ctx = canvas.getContext('2d');

  // Calcular novas dimensões mantendo proporção
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  const newWidth = image.width * ratio;
  const newHeight = image.height * ratio;

  // Centralizar imagem
  const x = (maxWidth - newWidth) / 2;
  const y = (maxHeight - newHeight) / 2;

  // Desenhar imagem redimensionada
  ctx.drawImage(image, x, y, newWidth, newHeight);

  return canvas.toDataURL('image/jpeg', 0.9);
}

// Converter imagem para base64
export async function imageToBase64(imageData: string): Promise<string> {
  const image = await loadImage(imageData);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

// Extrair metadados da imagem
export async function extractImageMetadata(imageData: string): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const image = await loadImage(imageData);
  const base64Data = imageData.split(',')[1];
  const size = Math.ceil((base64Data.length * 3) / 4);

  return {
    width: image.width,
    height: image.height,
    format: imageData.split(';')[0].split('/')[1],
    size
  };
} 