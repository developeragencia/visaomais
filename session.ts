import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export const sessionStore = new PostgresSessionStore({ 
  pool,
  createTableIfMissing: true 
});

export const sessionConfig: session.SessionOptions = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET || "visaoplus-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    sameSite: "lax"
  }
}; 