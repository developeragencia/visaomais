import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { User } from "@shared/schema";

// Estendendo a interface Request para incluir o usuário autenticado
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      role: "client" | "franchisee" | "admin";
      franchiseId?: number | null;
    }
  }
}

// Middleware para verificar se o usuário está autenticado
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Não autorizado" });
};

// Middleware para verificar se o usuário é um franqueado
const isFranchisee = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user && req.user.role === "franchisee") {
    return next();
  }
  res.status(403).json({ message: "Acesso negado" });
};

// Esquema de validação para criação de cliente
const createCustomerSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
});

export function setupCustomersRoutes(app: Express) {
  // Obter todos os clientes de uma franquia
  app.get("/api/franchisee/:franchiseId/customers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      
      // Verificar se o usuário tem permissão para acessar os clientes desta franquia
      if (req.user && req.user.role === "franchisee" && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const customers = await storage.getCustomersByFranchiseId(franchiseId);
      
      // Adicionar contagem de medições e consultas para cada cliente
      const customersWithStats = await Promise.all(
        customers.map(async (customer) => {
          const measurements = await storage.getMeasurementsByUserId(customer.id);
          const appointments = await storage.getAppointmentsByUserId(customer.id);
          
          return {
            ...customer,
            measurementCount: measurements.length,
            appointmentCount: appointments.length,
          };
        })
      );
      
      res.json(customersWithStats);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  });

  // Obter um cliente específico
  app.get("/api/franchisee/:franchiseId/customers/:customerId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const customerId = parseInt(req.params.customerId);
      
      // Verificar se o usuário tem permissão para acessar os clientes desta franquia
      if (req.user && req.user.role === "franchisee" && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const customer = await storage.getUser(customerId);
      
      if (!customer) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verificar se o cliente pertence à franquia
      const customerAppointments = await storage.getAppointmentsByUserId(customerId);
      const belongsToFranchise = customerAppointments.some(
        appointment => appointment.franchiseId === franchiseId
      );
      
      if (!belongsToFranchise && req.user && req.user.role !== "admin") {
        return res.status(403).json({ message: "Este cliente não pertence à sua franquia" });
      }
      
      // Obter estatísticas do cliente
      const measurements = await storage.getMeasurementsByUserId(customerId);
      const appointments = await storage.getAppointmentsByUserId(customerId);
      
      // Obter a data da última consulta
      const lastAppointment = appointments.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      // Remover a senha do objeto do cliente
      const { password, ...customerData } = customer;
      
      res.json({
        ...customerData,
        measurementCount: measurements.length,
        appointmentCount: appointments.length,
        lastVisit: lastAppointment ? lastAppointment.date : null,
      });
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      res.status(500).json({ message: "Erro ao buscar cliente" });
    }
  });

  // Adicionar novo cliente
  app.post("/api/franchisee/:franchiseId/customers", isAuthenticated, isFranchisee, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      
      // Verificar se o usuário é franqueado desta franquia
      if (req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Validar os dados do cliente
      const validationResult = createCustomerSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }
      
      const { fullName, email, phone, address, dateOfBirth, gender } = validationResult.data;
      
      // Verificar se já existe um usuário com este email
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Já existe um usuário com este email" });
      }
      
      // Criar novo usuário com papel de cliente
      const newUser = await storage.createUser({
        username: email, // Usar o email como nome de usuário
        password: Math.random().toString(36).slice(-8), // Senha aleatória (será alterada pelo cliente)
        email,
        fullName,
        role: "client",
      });
      
      // Criar perfil de cliente
      await storage.createClientProfile({
        userId: newUser.id,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
      });
      
      // Remover a senha do objeto de resposta
      const { password, ...userData } = newUser;
      
      res.status(201).json({
        ...userData,
        phone,
        address,
        dateOfBirth,
        gender,
        measurementCount: 0,
        appointmentCount: 0,
      });
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      res.status(500).json({ message: "Erro ao criar cliente" });
    }
  });

  // Atualizar cliente
  app.put("/api/franchisee/:franchiseId/customers/:customerId", isAuthenticated, isFranchisee, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const customerId = parseInt(req.params.customerId);
      
      // Verificar se o usuário é franqueado desta franquia
      if (req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar o cliente
      const customer = await storage.getUser(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verificar se o cliente pertence à franquia
      const customerAppointments = await storage.getAppointmentsByUserId(customerId);
      const belongsToFranchise = customerAppointments.some(
        appointment => appointment.franchiseId === franchiseId
      );
      
      if (!belongsToFranchise) {
        return res.status(403).json({ message: "Este cliente não pertence à sua franquia" });
      }
      
      // Validar dados de atualização
      const validationResult = createCustomerSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }
      
      const { fullName, email, phone, address, dateOfBirth, gender } = validationResult.data;
      
      // Atualizar usuário
      const updatedUserData: Partial<typeof customer> = {};
      if (fullName) updatedUserData.fullName = fullName;
      if (email) updatedUserData.email = email;
      
      const updatedUser = await storage.updateUser(customerId, updatedUserData);
      
      // Atualizar perfil de cliente
      const clientProfile = await storage.getClientProfileByUserId(customerId);
      const updatedProfileData: any = {};
      
      if (phone) updatedProfileData.phone = phone;
      if (address) updatedProfileData.address = address;
      if (dateOfBirth) updatedProfileData.dateOfBirth = new Date(dateOfBirth);
      if (gender) updatedProfileData.gender = gender;
      
      await storage.updateClientProfile(clientProfile.id, updatedProfileData);
      
      // Obter estatísticas do cliente
      const measurements = await storage.getMeasurementsByUserId(customerId);
      const appointments = await storage.getAppointmentsByUserId(customerId);
      
      // Obter a data da última consulta
      const lastAppointment = appointments.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      // Remover a senha do objeto do cliente
      const { password, ...customerData } = updatedUser;
      
      res.json({
        ...customerData,
        phone: updatedProfileData.phone || clientProfile.phone,
        address: updatedProfileData.address || clientProfile.address,
        dateOfBirth: updatedProfileData.dateOfBirth || clientProfile.dateOfBirth,
        gender: updatedProfileData.gender || clientProfile.gender,
        measurementCount: measurements.length,
        appointmentCount: appointments.length,
        lastVisit: lastAppointment ? lastAppointment.date : null,
      });
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      res.status(500).json({ message: "Erro ao atualizar cliente" });
    }
  });

  // Excluir cliente (na verdade, apenas desativa)
  app.delete("/api/franchisee/:franchiseId/customers/:customerId", isAuthenticated, isFranchisee, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const customerId = parseInt(req.params.customerId);
      
      // Verificar se o usuário é franqueado desta franquia
      if (req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar o cliente
      const customer = await storage.getUser(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verificar se o cliente pertence à franquia
      const customerAppointments = await storage.getAppointmentsByUserId(customerId);
      const belongsToFranchise = customerAppointments.some(
        appointment => appointment.franchiseId === franchiseId
      );
      
      if (!belongsToFranchise) {
        return res.status(403).json({ message: "Este cliente não pertence à sua franquia" });
      }
      
      // Marcar o usuário como inativo (através de um campo em clientProfile)
      const clientProfile = await storage.getClientProfileByUserId(customerId);
      if (clientProfile) {
        await storage.updateClientProfile(clientProfile.id, { status: "inactive" });
      }
      
      res.status(200).json({ message: "Cliente desativado com sucesso" });
    } catch (error) {
      console.error("Erro ao desativar cliente:", error);
      res.status(500).json({ message: "Erro ao desativar cliente" });
    }
  });
}