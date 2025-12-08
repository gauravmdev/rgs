DO $$ BEGIN
 CREATE TYPE "order_source" AS ENUM('ONLINE', 'WALK_IN', 'CALL_WHATSAPP');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "order_status" AS ENUM('CREATED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'PARTIAL_RETURNED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_method" AS ENUM('CASH', 'CARD', 'UPI', 'CUSTOMER_CREDIT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_status" AS ENUM('PENDING', 'PAID', 'REFUNDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "return_type" AS ENUM('FULL', 'PARTIAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY', 'CUSTOMER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"storeId" integer,
	"totalDues" numeric(10, 2) DEFAULT '0',
	"totalOrders" integer DEFAULT 0,
	"totalSales" numeric(10, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer,
	"deliveryPartnerId" integer,
	"assignedAt" timestamp DEFAULT now(),
	"outForDeliveryAt" timestamp,
	"deliveredAt" timestamp,
	"deliveryTimeMinutes" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "due_clearances" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" integer,
	"amount" numeric(10, 2) NOT NULL,
	"paymentMethod" "payment_method",
	"clearedDate" timestamp NOT NULL,
	"notes" text,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderNumber" varchar(50) NOT NULL,
	"customerId" integer,
	"storeId" integer,
	"source" "order_source",
	"status" "order_status" DEFAULT 'CREATED',
	"invoiceNumber" varchar(100),
	"invoiceAmount" numeric(10, 2) NOT NULL,
	"totalItems" integer NOT NULL,
	"paymentMethod" "payment_method",
	"paymentStatus" "payment_status" DEFAULT 'PENDING',
	"deliveryPartnerId" integer,
	"assignedAt" timestamp,
	"outForDeliveryAt" timestamp,
	"deliveredAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "orders_orderNumber_unique" UNIQUE("orderNumber")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer,
	"returnType" "return_type",
	"refundAmount" numeric(10, 2) NOT NULL,
	"refundMethod" "payment_method",
	"reason" text,
	"processedBy" integer,
	"processedAt" timestamp DEFAULT now(),
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role",
	"phone" varchar(20) NOT NULL,
	"storeId" integer,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_deliveryPartnerId_users_id_fk" FOREIGN KEY ("deliveryPartnerId") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "due_clearances" ADD CONSTRAINT "due_clearances_customerId_customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "due_clearances" ADD CONSTRAINT "due_clearances_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveryPartnerId_users_id_fk" FOREIGN KEY ("deliveryPartnerId") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_processedBy_users_id_fk" FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
