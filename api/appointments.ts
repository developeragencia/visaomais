import { Express, Request, Response } from "express";
import { storage } from "../storage";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Não autorizado" });
};

export function setupAppointmentsRoutes(app: Express) {
  // Get all appointments for the authenticated user
  app.get("/api/appointments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const appointments = await storage.getAppointmentsByUserId(userId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Erro ao buscar consultas" });
    }
  });

  // Get upcoming appointments for the authenticated user
  app.get("/api/appointments/upcoming", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const appointments = await storage.getUpcomingAppointmentsByUserId(userId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching upcoming appointments:", error);
      res.status(500).json({ message: "Erro ao buscar consultas agendadas" });
    }
  });

  // Get appointment history for the authenticated user
  app.get("/api/appointments/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const appointments = await storage.getAppointmentHistoryByUserId(userId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointment history:", error);
      res.status(500).json({ message: "Erro ao buscar histórico de consultas" });
    }
  });

  // Get a specific appointment by ID
  app.get("/api/appointments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const appointment = await storage.getAppointmentById(appointmentId);

      if (!appointment) {
        return res.status(404).json({ message: "Consulta não encontrada" });
      }

      // Check if the appointment belongs to the authenticated user or if user is franchisee/admin
      if (appointment.userId !== req.user.id && 
          appointment.franchiseId !== req.user.franchiseId && 
          req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ message: "Erro ao buscar consulta" });
    }
  });

  // Create a new appointment
  app.post("/api/appointments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { locationId, serviceType, date, timeSlot } = req.body;

      // Input validation
      if (!locationId || !serviceType || !date || !timeSlot) {
        return res.status(400).json({ message: "Dados incompletos para agendamento" });
      }

      // Check if the time slot is available
      const isAvailable = await storage.checkAppointmentAvailability(locationId, date, timeSlot);
      if (!isAvailable) {
        return res.status(409).json({ message: "Horário não disponível" });
      }

      // Create the appointment
      const appointmentData = {
        userId,
        franchiseId: parseInt(locationId),
        date: new Date(date),
        time: timeSlot,
        serviceType,
        status: "scheduled",
        createdAt: new Date(),
      };

      const appointment = await storage.createAppointment(appointmentData);
      
      // Generate a confirmation code
      const confirmationCode = `AP${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Update the appointment with the confirmation code
      const updatedAppointment = await storage.updateAppointment(
        appointment.id,
        { confirmationCode, status: "confirmed" }
      );

      res.status(201).json(updatedAppointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ message: "Erro ao criar consulta" });
    }
  });

  // Update an appointment (reschedule or cancel)
  app.put("/api/appointments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const appointment = await storage.getAppointmentById(appointmentId);

      if (!appointment) {
        return res.status(404).json({ message: "Consulta não encontrada" });
      }

      // Check if the appointment belongs to the authenticated user
      if (appointment.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // If rescheduling, check if the new time slot is available
      if (req.body.date && req.body.time) {
        const isAvailable = await storage.checkAppointmentAvailability(
          appointment.franchiseId,
          new Date(req.body.date),
          req.body.time
        );
        
        if (!isAvailable) {
          return res.status(409).json({ message: "Novo horário não disponível" });
        }
      }

      // Update the appointment
      const updatedAppointment = await storage.updateAppointment(
        appointmentId,
        { ...req.body, updatedAt: new Date() }
      );

      res.json(updatedAppointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ message: "Erro ao atualizar consulta" });
    }
  });

  // Cancel an appointment
  app.delete("/api/appointments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const appointment = await storage.getAppointmentById(appointmentId);

      if (!appointment) {
        return res.status(404).json({ message: "Consulta não encontrada" });
      }

      // Check if the appointment belongs to the authenticated user
      if (appointment.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Instead of actually deleting, update the status to cancelled
      await storage.updateAppointment(appointmentId, { status: "cancelled", updatedAt: new Date() });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      res.status(500).json({ message: "Erro ao cancelar consulta" });
    }
  });

  // Get available franchises/locations
  app.get("/api/franchises", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const franchises = await storage.getAllFranchises();
      res.json(franchises);
    } catch (error) {
      console.error("Error fetching franchises:", error);
      res.status(500).json({ message: "Erro ao buscar unidades" });
    }
  });

  // Get available time slots for a specific franchise on a specific date
  app.get("/api/franchises/:id/availability", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.id);
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      
      const availableSlots = await storage.getAvailableTimeSlots(franchiseId, date);
      res.json(availableSlots);
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ message: "Erro ao buscar horários disponíveis" });
    }
  });
}
