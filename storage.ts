import { db } from "./db";
import { eq, and, gte, lte, inArray, or, sql } from "drizzle-orm";
import { users, franchises, appointments, products } from "@shared/schema";
import {
  userQueries,
  franchiseQueries,
  appointmentQueries,
  productQueries,
  createUser,
  createFranchise,
  createProduct,
  getActiveFranchises
} from "./queries";
import { Pool } from 'pg';
import { Appointment, InsertAppointment, UpdateAppointment, AppointmentFilters, TimeSlot } from './types/appointments';

// Exportando as queries otimizadas
export {
  userQueries,
  franchiseQueries,
  appointmentQueries,
  productQueries,
  createUser,
  createFranchise,
  createProduct,
  getActiveFranchises
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
export const getActiveAppointments = appointmentQueries.getActive;
export const getActiveProducts = productQueries.getActive;

// Funções de busca
export const searchUsers = userQueries.search;
export const searchFranchises = franchiseQueries.search;
export const searchProducts = productQueries.search;

export async function getAppointmentsByUserId(userId: number): Promise<Appointment[]> {
  return db.select()
    .from(appointments)
    .where(eq(appointments.userId, userId))
    .orderBy(appointments.date, appointments.time);
}

export async function getUpcomingAppointmentsByUserId(userId: number): Promise<Appointment[]> {
  const today = new Date();
  return db.select()
    .from(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        gte(appointments.date, today),
        inArray(appointments.status, ['scheduled', 'confirmed'])
      )
    )
    .orderBy(appointments.date, appointments.time);
}

export async function getAppointmentHistoryByUserId(userId: number): Promise<Appointment[]> {
  const today = new Date();
  return db.select()
    .from(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        or(
          lte(appointments.date, today),
          inArray(appointments.status, ['completed', 'cancelled', 'no-show'])
        )
      )
    )
    .orderBy(appointments.date, appointments.time);
}

export async function createAppointment(appointment: InsertAppointment): Promise<Appointment[]> {
  return db.insert(appointments)
    .values({
      ...appointment,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
}

export async function updateAppointment(
  appointmentId: number, 
  updates: UpdateAppointment
): Promise<Appointment[]> {
  return db.update(appointments)
    .set({
      ...updates,
      updatedAt: new Date()
    })
    .where(eq(appointments.id, appointmentId))
    .returning();
}

export async function checkAppointmentAvailability(
  franchiseId: number,
  date: Date,
  timeSlot: string
): Promise<boolean> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(appointments)
    .where(
      and(
        eq(appointments.franchiseId, franchiseId),
        eq(appointments.date, date),
        eq(appointments.time, timeSlot),
        inArray(appointments.status, ['scheduled', 'confirmed'])
      )
    );
  return result[0].count === 0;
}

export async function getAvailableTimeSlots(
  franchiseId: number,
  date: Date
): Promise<TimeSlot[]> {
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  const bookedSlots = await db.select({ time: appointments.time })
    .from(appointments)
    .where(
      and(
        eq(appointments.franchiseId, franchiseId),
        eq(appointments.date, date),
        inArray(appointments.status, ['scheduled', 'confirmed'])
      )
    );

  const bookedTimes = new Set(bookedSlots.map(slot => slot.time));

  return timeSlots.map(time => ({
    time,
    isAvailable: !bookedTimes.has(time)
  }));
}

export async function getAppointmentStats(filters: AppointmentFilters = {}): Promise<any> {
  let query = db.select({
    total: sql<number>`count(*)`,
    status: appointments.status,
    serviceType: appointments.serviceType,
    appointmentDate: sql<Date>`DATE_TRUNC('day', ${appointments.date})`
  })
  .from(appointments)
  .where(and(
    filters.startDate ? gte(appointments.date, filters.startDate) : undefined,
    filters.endDate ? lte(appointments.date, filters.endDate) : undefined,
    filters.status ? eq(appointments.status, filters.status) : undefined,
    filters.serviceType ? eq(appointments.serviceType, filters.serviceType) : undefined,
    filters.franchiseId ? eq(appointments.franchiseId, filters.franchiseId) : undefined
  ))
  .groupBy(appointments.status, appointments.serviceType, sql<Date>`DATE_TRUNC('day', ${appointments.date})`)
  .orderBy(sql<Date>`DATE_TRUNC('day', ${appointments.date})`);

  return query;
}
