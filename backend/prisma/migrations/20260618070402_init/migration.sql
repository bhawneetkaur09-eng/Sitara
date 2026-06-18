-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "google_place_id" TEXT,
    "gating_enabled" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "whatsapp_number" TEXT,
    "voice_setting" TEXT NOT NULL DEFAULT 'friendly',
    "recovery_offer" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurant_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "consent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurant_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sentiment" TEXT,
    "posted_at" DATETIME NOT NULL,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "reply_text" TEXT,
    "replied_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "rating" INTEGER,
    "feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "surveys_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "surveys_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurant_id" TEXT NOT NULL,
    "survey_id" TEXT,
    "rating" INTEGER NOT NULL,
    "reason" TEXT,
    "table_or_source" TEXT,
    "customer_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolve_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    CONSTRAINT "alerts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerts_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_restaurant_id_phone_key" ON "customers"("restaurant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_source_external_id_key" ON "reviews"("source", "external_id");
