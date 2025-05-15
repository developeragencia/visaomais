import { Express } from "express";
import { storage } from "./storage";
import {
  hashPassword,
  comparePasswords,
  generateToken,
  authenticateToken,
  authorizeRole,
  validateRequest,
  loginSchema,
  registerSchema,
  authLimiter
} from "./security";

declare global {
  namespace Express {
    interface User {
      userId: number;
      role: string;
    }
  }
}

export function setupAuth(app: Express) {
  // Registro
  app.post("/api/register", validateRequest(registerSchema), async (req, res) => {
    try {
      const { username, email, cpf } = req.body;
      
      if (await storage.getUserByUsername(username)) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      if (await storage.getUserByEmail(email)) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }
      if (cpf && await storage.getUserByCpf(cpf)) {
        return res.status(400).json({ message: "CPF já cadastrado" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password)
      });

      const token = generateToken(user.id, user.role);
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Login
  app.post("/api/login", authLimiter, validateRequest(loginSchema), async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const user = await storage.getUserByEmail(identifier) || 
                   await storage.getUserByCpf(identifier) || 
                   await storage.getUserByUsername(identifier);

      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      const token = generateToken(user.id, user.role);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Logout
  app.post("/api/logout", (_, res) => res.sendStatus(200));

  // Dados do usuário
  app.get("/api/user", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  // Rotas protegidas
  app.use("/api/protected", authenticateToken);
  app.get("/api/protected/admin", authorizeRole(["admin"]), (_, res) => 
    res.json({ message: "Acesso permitido para administradores" }));
  app.get("/api/protected/franchisee", authorizeRole(["franchisee", "admin"]), (_, res) => 
    res.json({ message: "Acesso permitido para franqueados e administradores" }));
}
