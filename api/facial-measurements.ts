import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { analyzeFacialMeasurements, analyzeFacialPosition } from "../lib/openai";
import { insertMeasurementSchema } from "@shared/schema";

// Middleware para verificar autenticação
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(401).json({ message: "Não autorizado" });
  }
};

export function setupFacialMeasurementsRoutes(app: Express) {
  // Analisar posicionamento facial 
  app.post("/api/facial-measurements/analyze-position", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({ message: "Imagem não fornecida" });
      }
      
      // Remove o prefixo data:image/jpeg;base64, se existir
      const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
      
      const positionAnalysis = await analyzeFacialPosition(base64Image);
      
      res.json(positionAnalysis);
    } catch (error) {
      console.error("Erro ao analisar posição facial:", error);
      res.status(500).json({ 
        message: "Erro ao analisar posição facial", 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });

  // Realizar medição facial e salvar resultados
  app.post("/api/facial-measurements/measure", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({ message: "Imagem não fornecida" });
      }
      
      // Remove o prefixo data:image/jpeg;base64, se existir
      const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
      
      // Análise da posição facial primeiro
      const positionAnalysis = await analyzeFacialPosition(base64Image);
      
      if (!positionAnalysis.isCorrect) {
        return res.status(400).json({ 
          message: "Imagem não adequada para medição", 
          feedback: positionAnalysis.feedback,
          suggestions: positionAnalysis.suggestions
        });
      }
      
      // Obter medições faciais
      const measurements = await analyzeFacialMeasurements(base64Image);
      
      // Criar registro de medição no banco de dados
      const measurementData = {
        userId: req.user!.id,
        dp: measurements.dp,
        dpnLeft: measurements.dpnLeft,
        dpnRight: measurements.dpnRight,
        apLeft: measurements.apLeft,
        apRight: measurements.apRight,
        imageUrl: `data:image/jpeg;base64,${base64Image}`,
        type: "digital" as const,
        confidence: measurements.confidence,
        notes: "Medição digital via IA"
      };
      
      const validatedData = insertMeasurementSchema.parse(measurementData);
      const savedMeasurement = await storage.createMeasurement(validatedData);
      
      res.json({
        message: "Medição realizada com sucesso",
        measurements: savedMeasurement
      });
    } catch (error) {
      console.error("Erro ao realizar medição facial:", error);
      res.status(500).json({ 
        message: "Erro ao realizar medição facial", 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });
}