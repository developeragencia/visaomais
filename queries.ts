import { db } from "./db";
import { eq, and, or, isNull, desc, ilike } from "drizzle-orm";
import { 
  users, 
  franchises, 
  appointments, 
  products,
  type InsertUser,
  type InsertAppointment,
  type InsertFranchise,
  type InsertProduct
} from "@shared/schema";

// Queries otimizadas para usuários
export const userQueries = {
  getActive: () => db.select()
    .from(users)
    .where(eq(users.isDeleted, false))
    .orderBy(desc(users.createdAt)),

  search: (query: string) => db.select()
    .from(users)
    .where(
      and(
        eq(users.isDeleted, false),
        or(
          ilike(users.username, `%${query}%`),
          ilike(users.fullName, `%${query}%`),
          ilike(users.email, `%${query}%`)
        )
      )
    ),

  softDelete: (id: number) => db.update(users)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(users.id, id)),

  restore: (id: number) => db.update(users)
    .set({ isDeleted: false, deletedAt: null })
    .where(eq(users.id, id))
};

// Queries otimizadas para franquias
export const franchiseQueries = {
  getActive: () => db.select()
    .from(franchises)
    .where(eq(franchises.isDeleted, false))
    .orderBy(desc(franchises.createdAt)),

  search: (query: string) => db.select()
    .from(franchises)
    .where(
      and(
        eq(franchises.isDeleted, false),
        or(
          ilike(franchises.name, `%${query}%`),
          ilike(franchises.city, `%${query}%`),
          ilike(franchises.state, `%${query}%`)
        )
      )
    ),

  softDelete: (id: number) => db.update(franchises)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(franchises.id, id)),

  restore: (id: number) => db.update(franchises)
    .set({ isDeleted: false, deletedAt: null })
    .where(eq(franchises.id, id))
};

// Queries otimizadas para agendamentos
export const appointmentQueries = {
  getActive: (franchiseId?: number) => {
    const query = db.select()
      .from(appointments)
      .where(eq(appointments.isDeleted, false));

    if (franchiseId) {
      query.where(eq(appointments.franchiseId, franchiseId));
    }

    return query.orderBy(desc(appointments.date));
  },

  softDelete: (id: number) => db.update(appointments)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(appointments.id, id))
};

// Queries otimizadas para produtos
export const productQueries = {
  getActive: (franchiseId?: number) => {
    const query = db.select()
      .from(products)
      .where(eq(products.isDeleted, false));

    if (franchiseId) {
      query.where(eq(products.franchiseId, franchiseId));
    }

    return query.orderBy(desc(products.createdAt));
  },

  search: (query: string, franchiseId?: number) => {
    const baseQuery = db.select()
      .from(products)
      .where(
        and(
          eq(products.isDeleted, false),
          or(
            ilike(products.name, `%${query}%`),
            ilike(products.category, `%${query}%`)
          )
        )
      );

    if (franchiseId) {
      baseQuery.where(eq(products.franchiseId, franchiseId));
    }

    return baseQuery.orderBy(desc(products.createdAt));
  },

  softDelete: (id: number) => db.update(products)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(products.id, id))
};

// Funções de criação com validação
export async function createUser(data: InsertUser) {
  const existingUser = await db.select()
    .from(users)
    .where(
      or(
        eq(users.username, data.username),
        eq(users.email, data.email),
        data.cpf ? eq(users.cpf, data.cpf) : undefined
      )
    )
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error("Usuário já existe com este username, email ou CPF");
  }

  return db.insert(users).values(data).returning();
}

export async function createFranchise(data: InsertFranchise) {
  const existingFranchise = await db.select()
    .from(franchises)
    .where(
      or(
        eq(franchises.name, data.name),
        eq(franchises.email, data.email)
      )
    )
    .limit(1);

  if (existingFranchise.length > 0) {
    throw new Error("Franquia já existe com este nome ou email");
  }

  return db.insert(franchises).values(data).returning();
}

export async function createAppointment(data: InsertAppointment) {
  // Verificar disponibilidade do horário
  const existingAppointment = await db.select()
    .from(appointments)
    .where(
      and(
        eq(appointments.franchiseId, data.franchiseId),
        eq(appointments.date, data.date),
        eq(appointments.time, data.time),
        eq(appointments.isDeleted, false)
      )
    )
    .limit(1);

  if (existingAppointment.length > 0) {
    throw new Error("Horário já está ocupado");
  }

  return db.insert(appointments).values(data).returning();
}

export async function createProduct(data: InsertProduct) {
  const existingProduct = await db.select()
    .from(products)
    .where(
      and(
        eq(products.name, data.name),
        eq(products.franchiseId, data.franchiseId),
        eq(products.isDeleted, false)
      )
    )
    .limit(1);

  if (existingProduct.length > 0) {
    throw new Error("Produto já existe nesta franquia");
  }

  return db.insert(products).values(data).returning();
} 