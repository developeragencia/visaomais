import express from "express";
import cors from "cors";
import { setupAuth } from "./auth";
import { sessionConfig } from "./session";
import { errorHandler } from "./middleware/error-handler";
import { logger } from "./middleware/logger";

const app = express();

// Middleware básico
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(logger);

// Configuração de sessão
app.use(sessionConfig);

// Configuração de autenticação
setupAuth(app);

// Rotas da API
app.use("/api", require("./routes").default);

// Tratamento de erros
app.use(errorHandler);

// Inicialização do servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
