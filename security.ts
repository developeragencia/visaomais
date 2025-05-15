import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Configurações
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'visaoplus-jwt-secret';
const JWT_EXPIRES_IN = '7d';

// Rate limiter para endpoints de autenticação
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: 'Muitas tentativas de login. Por favor, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Schemas de validação
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Identificador é obrigatório'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z.object({
  username: z.string().min(3, 'Username deve ter no mínimo 3 caracteres'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  email: z.string().email('Email inválido'),
  fullName: z.string().min(1, 'Nome completo é obrigatório'),
  cpf: z.string().optional(),
  role: z.enum(['client', 'franchisee', 'admin']).default('client'),
});

// Funções de hash e verificação de senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  return bcrypt.compare(supplied, stored);
}

// Funções JWT
export function generateToken(userId: number, role: string): string {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): { userId: number; role: string } {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
}

// Middleware de autenticação
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido ou expirado' });
  }
}

// Middleware de autorização por role
export function authorizeRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Não autorizado' });
    }

    next();
  };
}

// Validação de entrada
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: error.errors,
        });
      }
      next(error);
    }
  };
} 