import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";

// Middleware para verificar autenticação
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Não autorizado" });
};

// Middleware para verificar se o usuário é um administrador
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Acesso negado: permissão de administrador necessária" });
};

// Schema para validação de solicitação de franquia
const franchiseeApplicationSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(10),
  document: z.string().min(11),
  companyName: z.string().min(3),
  companyDocument: z.string().min(14),
  city: z.string().min(2),
  state: z.string().min(2),
  address: z.string().min(6),
  experience: z.string().optional(),
  investment: z.string(),
  username: z.string().min(3),
  password: z.string().min(6),
});

// Function para configurar as rotas de franquias
export function setupFranchiseesRoutes(app: Express) {
  // Rota para enviar uma solicitação de franquia
  app.post("/api/franchisee-applications", async (req: Request, res: Response) => {
    try {
      // Validar os dados recebidos
      const validatedData = franchiseeApplicationSchema.parse(req.body);
      
      // Verificar se o nome de usuário já existe
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      // Salvar a solicitação
      const application = await storage.createFranchiseeApplication({
        ...validatedData,
        status: "pending", // Status inicial é pendente
        createdAt: new Date(),
      });
      
      res.status(201).json({
        id: application.id,
        status: application.status,
        message: "Solicitação enviada com sucesso e está em análise",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Erro ao processar solicitação de franquia:", error);
      res.status(500).json({ message: "Erro ao processar solicitação" });
    }
  });
  
  // Listar todas as solicitações de franquia (administradores)
  app.get("/api/franchisee-applications", isAdmin, async (req: Request, res: Response) => {
    try {
      const applications = await storage.getAllFranchiseeApplications();
      res.json(applications);
    } catch (error) {
      console.error("Erro ao buscar solicitações de franquia:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações" });
    }
  });
  
  // Detalhes de uma solicitação específica
  app.get("/api/franchisee-applications/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const application = await storage.getFranchiseeApplicationById(id);
      
      if (!application) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      
      res.json(application);
    } catch (error) {
      console.error("Erro ao buscar detalhes da solicitação:", error);
      res.status(500).json({ message: "Erro ao buscar detalhes" });
    }
  });
  
  // Aprovar uma solicitação de franquia
  app.post("/api/franchisee-applications/:id/approve", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const application = await storage.getFranchiseeApplicationById(id);
      
      if (!application) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Não é possível aprovar uma solicitação com status '${application.status}'` });
      }
      
      // Atualizar status da solicitação
      const updatedApplication = await storage.updateFranchiseeApplication(id, {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user.id,
      });
      
      // Criar usuário com papel de franqueado
      const user = await storage.createUser({
        username: application.username,
        password: application.password, // Senha já está hashada no storage
        fullName: application.fullName,
        email: application.email,
        role: "franchisee",
      });
      
      // Criar perfil de franqueado
      const franchiseeProfile = await storage.createFranchiseeProfile({
        userId: user.id,
        document: application.document,
        phone: application.phone,
        companyName: application.companyName,
        companyDocument: application.companyDocument,
        city: application.city,
        state: application.state,
        address: application.address,
        applicationId: application.id,
      });
      
      res.json({
        application: updatedApplication,
        message: "Solicitação de franquia aprovada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao aprovar solicitação de franquia:", error);
      res.status(500).json({ message: "Erro ao aprovar solicitação" });
    }
  });
  
  // Rejeitar uma solicitação de franquia
  app.post("/api/franchisee-applications/:id/reject", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Motivo da rejeição é obrigatório" });
      }
      
      const application = await storage.getFranchiseeApplicationById(id);
      
      if (!application) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Não é possível rejeitar uma solicitação com status '${application.status}'` });
      }
      
      // Atualizar status da solicitação
      const updatedApplication = await storage.updateFranchiseeApplication(id, {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: req.user.id,
        rejectionReason: reason,
      });
      
      res.json({
        application: updatedApplication,
        message: "Solicitação de franquia rejeitada",
      });
    } catch (error) {
      console.error("Erro ao rejeitar solicitação de franquia:", error);
      res.status(500).json({ message: "Erro ao rejeitar solicitação" });
    }
  });

  // Solicitar mais informações
  app.post("/api/franchisee-applications/:id/request-info", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { requestDetails } = req.body;
      
      if (!requestDetails) {
        return res.status(400).json({ message: "Detalhes da solicitação são obrigatórios" });
      }
      
      const application = await storage.getFranchiseeApplicationById(id);
      
      if (!application) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Não é possível solicitar informações de uma solicitação com status '${application.status}'` });
      }
      
      // Atualizar status da solicitação
      const updatedApplication = await storage.updateFranchiseeApplication(id, {
        status: "info_requested",
        infoRequestedAt: new Date(),
        infoRequestedBy: req.user.id,
        infoRequestDetails: requestDetails,
      });
      
      res.json({
        application: updatedApplication,
        message: "Solicitação de informações adicionais enviada",
      });
    } catch (error) {
      console.error("Erro ao solicitar informações adicionais:", error);
      res.status(500).json({ message: "Erro ao solicitar informações" });
    }
  });
  
  // Obter dashboard stats para admin
  app.get("/api/franchisee-applications/stats", isAdmin, async (req: Request, res: Response) => {
    try {
      const applications = await storage.getAllFranchiseeApplications();
      
      const stats = {
        total: applications.length,
        pending: applications.filter(app => app.status === "pending").length,
        approved: applications.filter(app => app.status === "approved").length,
        rejected: applications.filter(app => app.status === "rejected").length,
        infoRequested: applications.filter(app => app.status === "info_requested").length,
        recentApplications: applications
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5),
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });
}