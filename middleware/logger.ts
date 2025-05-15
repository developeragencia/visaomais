import { Request, Response, NextFunction } from "express";

export function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, path, query, body } = req;

  // Capturar a resposta
  const originalJson = res.json;
  let responseBody: any;

  res.json = function(body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Log após a resposta
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Formatar o log
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      path,
      query: Object.keys(query).length ? query : undefined,
      body: method !== "GET" ? body : undefined,
      statusCode,
      duration: `${duration}ms`,
      response: responseBody
    };

    // Log colorido no console
    const statusColor = statusCode >= 500 ? "\x1b[31m" : // vermelho
                       statusCode >= 400 ? "\x1b[33m" : // amarelo
                       statusCode >= 300 ? "\x1b[36m" : // ciano
                       statusCode >= 200 ? "\x1b[32m" : // verde
                       "\x1b[0m"; // reset

    console.log(
      `${statusColor}${method} ${path} ${statusCode} ${duration}ms\x1b[0m`
    );

    // Log detalhado em desenvolvimento
    if (process.env.NODE_ENV === "development") {
      console.log(JSON.stringify(logEntry, null, 2));
    }
  });

  next();
} 