import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const businessRoleEnum = pgEnum("business_role", [
  "owner",
  "manager",
  "bookkeeper",
  "staff",
  "viewer",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "COGS",
  "EXPENSE",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "sale",
  "expense",
  "customer_payment",
  "supplier_payment",
  "purchase",
  "owner_draw",
  "owner_capital",
  "other_income",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "posted",
  "voided",
  "pending",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "paid",
  "partial",
  "unpaid",
]);
export const sourceEnum = pgEnum("source", [
  "manual",
  "assistant",
  "import",
  "future_whatsapp",
  "future_bank",
  "web",
  "whatsapp",
  "voice",
  "receipt",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  businessType: varchar("business_type", { length: 100 }),
  category: varchar("category", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Nigeria").notNull(),
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  phone: varchar("phone", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businessUsers = pgTable("business_users", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(),
  role: businessRoleEnum("role").default("owner").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: accountTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  transactionDate: date("transaction_date").notNull(),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(), // in Naira (whole)
  amountPaid: integer("amount_paid").default(0).notNull(),
  customerId: integer("customer_id"),
  supplierId: integer("supplier_id"),
  expenseAccountId: integer("expense_account_id"),
  paymentStatus: paymentStatusEnum("payment_status").default("paid").notNull(),
  source: varchar("source", { length: 30 }).default("manual").notNull(),
  reference: varchar("reference", { length: 100 }),
  status: transactionStatusEnum("status").default("posted").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  transactionId: integer("transaction_id"),
  entryDate: date("entry_date").notNull(),
  description: text("description").notNull(),
  reference: varchar("reference", { length: 100 }),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull(),
  accountId: integer("account_id").notNull(),
  debit: integer("debit").default(0).notNull(),
  credit: integer("credit").default(0).notNull(),
  description: text("description"),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id"),
  userId: integer("user_id").notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  recordType: varchar("record_type", { length: 100 }),
  recordId: integer("record_id"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
