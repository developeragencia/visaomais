import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupDomainConfig } from "./domain-config";
import { setupMeasurementsRoutes } from "./api/measurements";
import { setupAppointmentsRoutes } from "./api/appointments";
import { setupFranchiseesRoutes } from "./api/franchisees";
import { setupCustomersRoutes } from "./api/customers";
import { setupInventoryRoutes } from "./api/inventory";
import { setupFacialMeasurementsRoutes } from "./api/facial-measurements";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Não autorizado" });
};

// Middleware to check user role
const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autorizado" });
    }
    
    if (roles.includes(req.user.role)) {
      return next();
    }
    
    res.status(403).json({ message: "Acesso negado" });
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Configuração de domínio e cache
  setupDomainConfig(app);

  // Set up authentication routes
  setupAuth(app);
  
  // Set up API routes
  setupMeasurementsRoutes(app);
  setupAppointmentsRoutes(app);
  setupFranchiseesRoutes(app);
  setupCustomersRoutes(app);
  setupInventoryRoutes(app);
  setupFacialMeasurementsRoutes(app);
  
  // Users API
  app.get("/api/users", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from the response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });
  
  // Profile API
  app.get("/api/profile", isAuthenticated, (req, res) => {
    // At this point, req.user is guaranteed to exist since we're using isAuthenticated middleware
    const { password, ...profile } = req.user;
    res.json(profile);
  });
  
  app.put("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // Update session user data
      req.login(updatedUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Erro ao atualizar sessão do usuário" });
        }
        
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
