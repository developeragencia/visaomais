import * as faceapi from 'face-api.js';
import { Canvas, createCanvas, loadImage } from 'canvas';
import { join } from 'path';

// Configurar canvas para Node.js
const canvas = {
  createCanvas: (width: number, height: number) => createCanvas(width, height),
  loadImage: async (src: string) => {
    if (src.startsWith('data:')) {
      return loadImage(src);
    }
    return loadImage(join(process.cwd(), src));
  }
};

// Configurar opções de detecção facial
const faceDetectionOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5
});

// Configurar rede de detecção facial
const faceDetectionNet = faceapi.nets.tinyFaceDetector;

// Exportar configurações
export {
  canvas,
  faceDetectionOptions,
  faceDetectionNet
}; 