# 🔄 Brightloop — Subscription Management System

A modern, full-stack enterprise Subscription Management System built for recurring billing, catalog configuration, multi-variant pricing, quotation generation, and subscription lifecycle management.

---

## 🚀 System Modules

### 🔐 Module 1: Authentication and User Management
- **Multi-Role Authentication & RBAC**: Admin, Staff, and Customer roles with strict backend and frontend route guards.
- **Registration & Credentials**: Email uniqueness enforcement (`COLLATE NOCASE`), password complexity validation (>8 chars, uppercase, lowercase, special char).
- **Password Hashing**: Bcrypt salted hashing with salt factor 12.
- **Forgot & Reset Password**: Secure token-based reset link delivery via nodemailer and Ethereal email simulator.
- **Staff Onboarding**: Admin-only staff account creation with activity audit logging.
- **Role Dashboards**: Tailored interactive dashboards for Admin, Staff, and Customer.

### 📦 Module 2: Products, Plans, Variants, Taxes and Discounts
- **Product Management**: CRUD for digital products and services with sales and cost price metrics.
- **Product Variants & Additional Pricing**: Variant branding surcharges (e.g., Selecting the **Odoo brand adds ₹560** to the base price).
- **Subscription Plans**: Daily, Weekly, Monthly, and Yearly billing frequencies; minimum purchase quantity enforcement; plan availability start/end dates; auto-closure upon expiry; configurable early closure, pause, and renewal permissions.
- **Tax Management**: Tax rules with automated percentage and fixed calculations.
- **Discount Management**: Percentage and flat discount coupons; minimum purchase amount and quantity conditions; start/end date restrictions; maximum usage limits; automated expiration and stop conditions.
- **Unified Pricing Engine**: Consistent calculation engine across all system modules.

### 🔄 Module 3: Subscription & Quotation Management
- **Subscription Management**: Unique auto-generated subscription numbers (`SUB-YYYY-XXXXX`), customer binding, selected plan, start and expiry dates, payment terms (`Net 15`, `Net 30`, `Net 60`, `Immediate`), multi-line products with variant attributes.
- **Quotation Templates**: Reusable templates with predefined plans, product lines, quantities, and validity days.
- **Quotation Workflow**: Generation, editing, status management (`Draft`, `Sent`, `Accepted`, `Rejected`, `Expired`), and one-click conversion into active subscriptions.
- **Subscription Lifecycle State Machine**:
  - `Draft` &rarr; `Quotation` &rarr; `Confirmed` &rarr; `Active` &rarr; `Paused` &rarr; `Closed`.
  - Pause & Resume actions (checks `plan.allow_pause`).
  - Renew actions (checks `plan.allow_renewal`, extends expiry date).
  - Early closure (checks `plan.allow_early_closure`, records reason and timestamp).
  - Background automatic expiry handling for expired contracts.
  - Granular audit trail in `subscription_history`.
- **Module 4 Invoicing Integration**: `/api/subscriptions/:id/invoice-payload` delivering standardized billing payloads for automated recurring invoice generation.

---

## 🛠️ Environment Setup & Running

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Seed Mock Data
Seed realistic mock data covering all modules (Admin, Staff, Customers, Catalog, Discounts, Templates, Quotes, Subscriptions, and Audit History):
```bash
npm run seed:mock
```

### 4. Start the Application Server
```bash
npm start
```
The server serves both the REST API and the Frontend SPA:
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **REST API Base**: [http://localhost:3000/api](http://localhost:3000/api)

---

## 🔑 Demo Login Accounts

| Role | Email | Plaintext Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@brightloop.com` | `Admin@123!` | Full system access, users, staff creation, catalog, subscriptions |
| **Staff** | `staff@brightloop.com` | `Staff@123!` | Operations, subscriptions, quotations, customer management |
| **Customer** | `customer@brightloop.com` | `Customer@123!` | Self-service view of own subscriptions, quotations, and price calculator |
| **Customer** | `acme.corp@example.com` | `Customer@123!` | Acme Industrial Corp account |

---

## 🧪 Automated Testing & Verification

Run all test suites concurrently in parallel using worker processes:
```bash
cd backend
npm test
# or
npm run test:parallel
```

### Modular Test Suites
```bash
npm run test:m1          # Module 1: Auth, RBAC, Validation (17 tests)
npm run test:m2          # Module 2: Products, Variants, Pricing (34 tests)
npm run test:m3          # Module 3: Subscriptions, Quotations, Lifecycle (41 tests)
node test_module3_api.js # Live HTTP E2E REST API tests (15 endpoints)
```

---

## 📚 Technical Documentation
- [Module 2 Documentation](MODULE_2_DOCUMENTATION.md)
- [Module 3 Documentation](MODULE_3_DOCUMENTATION.md)
