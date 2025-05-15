import { Express, Request, Response } from "express";
import { storage } from "../storage";
import { analyzeImage } from "./openai";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Não autorizado" });
};

export function setupMeasurementsRoutes(app: Express) {
  // Get all measurements for the authenticated user
  app.get("/api/measurements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const measurements = await storage.getMeasurementsByUserId(userId);
      res.json(measurements);
    } catch (error) {
      console.error("Error fetching measurements:", error);
      res.status(500).json({ message: "Erro ao buscar medições" });
    }
  });

  // Get a specific measurement by ID
  app.get("/api/measurements/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const measurementId = parseInt(req.params.id);
      const measurement = await storage.getMeasurementById(measurementId);

      if (!measurement) {
        return res.status(404).json({ message: "Medição não encontrada" });
      }

      // Check if the measurement belongs to the authenticated user
      if (measurement.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(measurement);
    } catch (error) {
      console.error("Error fetching measurement:", error);
      res.status(500).json({ message: "Erro ao buscar medição" });
    }
  });

  // Create a new measurement
  app.post("/api/measurements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const measurementData = {
        ...req.body,
        userId,
        createdAt: new Date(),
      };

      const measurement = await storage.createMeasurement(measurementData);
      res.status(201).json(measurement);
    } catch (error) {
      console.error("Error creating measurement:", error);
      res.status(500).json({ message: "Erro ao criar medição" });
    }
  });

  // Analyze image with OpenAI and return measurements
  app.post("/api/measurements/analyze", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ message: "Imagem não fornecida" });
      }

      // Analyze the image using OpenAI
      const results = await analyzeImage(image);

      res.json(results);
    } catch (error) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ 
        message: error.message || "Erro ao analisar imagem" 
      });
    }
  });

  // Delete a measurement
  app.delete("/api/measurements/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const measurementId = parseInt(req.params.id);
      const measurement = await storage.getMeasurementById(measurementId);

      if (!measurement) {
        return res.status(404).json({ message: "Medição não encontrada" });
      }

      // Check if the measurement belongs to the authenticated user
      if (measurement.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.deleteMeasurement(measurementId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting measurement:", error);
      res.status(500).json({ message: "Erro ao excluir medição" });
    }
  });
}
