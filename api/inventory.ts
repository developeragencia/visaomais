import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { Product, InsertProduct } from "@shared/schema";

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

// Esquema de validação para produtos
const productSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  price: z.number().positive("Preço deve ser positivo"),
  category: z.string().min(1, "Categoria é obrigatória"),
  stock: z.number().int().nonnegative("Estoque deve ser um número inteiro não negativo"),
  minimumStock: z.number().int().nonnegative("Estoque mínimo deve ser um número inteiro não negativo"),
  imageUrl: z.string().nullable().optional(),
});

export function setupInventoryRoutes(app: Express) {
  // Obter todos os produtos de uma franquia
  app.get("/api/franchisee/:franchiseId/inventory", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      
      // Verificar se o usuário tem permissão para acessar o inventário desta franquia
      if (req.user && req.user.role === "franchisee" && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const products = await storage.getProductsByFranchiseId(franchiseId);
      res.json(products);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  // Obter um produto específico
  app.get("/api/franchisee/:franchiseId/inventory/:productId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const productId = parseInt(req.params.productId);
      
      // Verificar se o usuário tem permissão para acessar o inventário desta franquia
      if (req.user && req.user.role === "franchisee" && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const product = await storage.getProductById(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      
      // Verificar se o produto pertence à franquia
      if (product.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Este produto não pertence à sua franquia" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
      res.status(500).json({ message: "Erro ao buscar produto" });
    }
  });

  // Adicionar novo produto
  app.post("/api/franchisee/:franchiseId/inventory", isAuthenticated, isFranchisee, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      
      // Verificar se o usuário é franqueado desta franquia
      if (req.user && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Validar os dados do produto
      const validationResult = productSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }
      
      const productData = {
        ...validationResult.data,
        franchiseId,
      };
      
      const newProduct = await storage.createProduct(productData);
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  // Atualizar produto
  app.put("/api/franchisee/:franchiseId/inventory/:productId", isAuthenticated, isFranchisee, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const productId = parseInt(req.params.productId);
      
      // Verificar se o usuário é franqueado desta franquia
      if (req.user && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar o produto
      const product = await storage.getProductById(productId);
      if (!product) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      
      // Verificar se o produto pertence à franquia
      if (product.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Este produto não pertence à sua franquia" });
      }
      
      // Validar dados de atualização
      const validationResult = productSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }
      
      const updatedProduct = await storage.updateProduct(productId, validationResult.data);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  // Excluir produto
  app.delete("/api/franchisee/:franchiseId/inventory/:productId", isAuthenticated, isFranchisee, async (req: Request, res: Response) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const productId = parseInt(req.params.productId);
      
      // Verificar se o usuário é franqueado desta franquia
      if (req.user && req.user.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar o produto
      const product = await storage.getProductById(productId);
      if (!product) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      
      // Verificar se o produto pertence à franquia
      if (product.franchiseId !== franchiseId) {
        return res.status(403).json({ message: "Este produto não pertence à sua franquia" });
      }
      
      await storage.deleteProduct(productId);
      res.status(200).json({ message: "Produto excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });
}