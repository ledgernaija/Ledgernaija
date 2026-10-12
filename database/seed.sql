-- ============================================================
-- SME FINANCE V0.5 — seed.sql (demo reference)
-- The live app seeds demo data via the "Load example data"
-- checkbox (see src/app/api/business/route.ts -> seedDemoData),
-- which posts through the real accounting engine so journals balance.
-- This file documents the equivalent demo dataset as SQL for
-- MySQL/shared-hosting ports. Amounts in whole Naira (₦).
-- Business: Blessing Fashion Hub
-- ============================================================

-- Example (run after creating user id 1 + business id 1,
-- and inserting the 20 default accounts for business 1):

-- Customers
-- INSERT INTO customers (business_id, name, phone) VALUES
--   (1, 'Emeka', '0803 000 0001'),
--   (1, 'Ada', '0803 000 0002'),
--   (1, 'Chinedu', '0803 000 0003');

-- Suppliers
-- INSERT INTO suppliers (business_id, name, phone) VALUES
--   (1, 'ABC Fashion Supplies', '0803 100 0001'),
--   (1, 'Lagos Garments Ltd', '0803 100 0002');

-- Transactions (post via accounting functions, not raw inserts,
-- so journal entries balance):
-- 1. Sale ₦150,000 to Emeka, paid ₦100,000 (partial)
--    DR 1100 AR 150,000 / CR 4000 Sales 150,000
--    DR 1000 Cash 100,000 / CR 1100 AR 100,000
-- 2. Sale ₦250,000 to Ada, fully paid
-- 3. Sale ₦80,000 to Chinedu, unpaid
-- 4. Customer payment ₦30,000 from Emeka
-- 5. Expense Transport ₦15,000
-- 6. Expense Rent ₦100,000
-- 7. Purchase ₦200,000 from ABC Fashion Supplies, paid ₦50,000

SELECT 'Seed via app: tick Load example data on business setup.' AS note;
