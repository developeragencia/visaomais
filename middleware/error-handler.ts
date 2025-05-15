import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
  }

  // Erros não operacionais (erros de programação)
  console.error("ERRO:", err);
  
  return res.status(500).json({
    status: "error",
    message: "Erro interno do servidor",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
} 