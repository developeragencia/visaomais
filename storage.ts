import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, franchises, appointments, products } from "@shared/schema";
import {
  userQueries,
  franchiseQueries,
  appointmentQueries,
  productQueries,
  createUser,
  createFranchise,
  createAppointment,
  createProduct
} from "./queries";

// Exportando as queries otimizadas
export {
  userQueries,
  franchiseQueries,
  appointmentQueries,
  productQueries,
  createUser,
  createFranchise,
  createAppointment,
  createProduct
};

// Funções de busca por ID
export async function getUser(id: number) {
  const result = await db.select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0];
}

export async function getFranchise(id: number) {
  const result = await db.select()
    .from(franchises)
    .where(eq(franchises.id, id))
    .limit(1);
  return result[0];
}

export async function getAppointment(id: number) {
  const result = await db.select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  return result[0];
}

export async function getProduct(id: number) {
  const result = await db.select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return result[0];
}

// Funções de busca por identificadores únicos
export async function getUserByUsername(username: string) {
  const result = await db.select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const result = await db.select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

export async function getUserByCpf(cpf: string) {
  const result = await db.select()
    .from(users)
    .where(eq(users.cpf, cpf))
    .limit(1);
  return result[0];
}

// Funções de atualização
export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
  return db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
}

export async function updateFranchise(id: number, data: Partial<typeof franchises.$inferInsert>) {
  return db.update(franchises)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(franchises.id, id))
    .returning();
}

export async function updateAppointment(id: number, data: Partial<typeof appointments.$inferInsert>) {
  return db.update(appointments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();
}

export async function updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
  return db.update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
}

// Funções de exclusão (soft delete)
export const deleteUser = userQueries.softDelete;
export const deleteFranchise = franchiseQueries.softDelete;
export const deleteAppointment = appointmentQueries.softDelete;
export const deleteProduct = productQueries.softDelete;

// Funções de restauração
export const restoreUser = userQueries.restore;
export const restoreFranchise = franchiseQueries.restore;

// Funções de busca ativa
export const getActiveUsers = userQueries.getActive;
export const getActiveFranchises = franchiseQueries.getActive;
export const getActiveAppointments = appointmentQueries.getActive;
export const getActiveProducts = productQueries.getActive;

// Funções de busca
export const searchUsers = userQueries.search;
export const searchFranchises = franchiseQueries.search;
export const searchProducts = productQueries.search;
