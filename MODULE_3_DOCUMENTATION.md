# Brightloop Software — Subscription Management System
## Module 3: Subscription & Quotation Management Specification

---

## 1. Overview
Module 3 provides enterprise-grade **Subscription Lifecycle Management**, **Quotation Generation**, **Reusable Quotation Templates**, **Automated Multi-Line Pricing Calculation**, and **Module 4 Invoicing Integration**.

It sits between:
- **Module 1 (Authentication & RBAC):** Role scoping (Admin, Staff, Customer), user permissions, and identity guarantees.
- **Module 2 (Products, Plans, Taxes & Discounts):** Real-time catalog pricing, variant surcharges (e.g., Odoo brand +₹560), multi-frequency plans, tax calculation, and discount coupon validation.
- **Module 4 (Automated Invoicing & Billing):** Clean, structured JSON invoice payload delivery.

---

## 2. Database Schema

### `quotation_templates`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique numeric ID |
| `uuid` | TEXT | UNIQUE, NOT NULL | Public UUID identifier |
| `name` | TEXT | NOT NULL | Template title (e.g., "Enterprise Starter Pack") |
| `description` | TEXT | NULLABLE | Detailed summary of bundled items |
| `plan_id` | INTEGER | FOREIGN KEY -> `subscription_plans(id)` | Default recurring billing plan |
| `default_validity_days` | INTEGER | NOT NULL DEFAULT 30 | Validity duration in calendar days |
| `payment_terms` | TEXT | NOT NULL DEFAULT 'Net 30' | Predefined payment terms |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Active status flag |
| `created_by` | INTEGER | FOREIGN KEY -> `users(id)` | Author user ID |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

### `quotation_template_lines`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Line ID |
| `template_id` | INTEGER FK -> `quotation_templates` | Parent template |
| `product_id` | INTEGER FK -> `products` | Bundled product |
| `variant_id` | INTEGER FK -> `product_variants` | Optional product variant |
| `quantity` | INTEGER NOT NULL DEFAULT 1 | Preconfigured quantity |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Display sequence order |

### `quotations`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Quotation ID |
| `uuid` | TEXT | UNIQUE | Public identifier |
| `quotation_number` | TEXT | UNIQUE COLLATE NOCASE | Sequential code (e.g., `QT-2026-00001`) |
| `template_id` | INTEGER | FK -> `quotation_templates` | Source template if generated from one |
| `customer_id` | INTEGER | FK -> `users` | Target client user ID |
| `plan_id` | INTEGER | FK -> `subscription_plans` | Associated subscription plan |
| `status` | TEXT | CHECK IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted') | State |
| `validity_days` | INTEGER | DEFAULT 30 | Active period |
| `issue_date` | DATE | NOT NULL | Quotation issuance date |
| `valid_until` | DATE | NOT NULL | Expiry date of the quotation offer |
| `payment_terms` | TEXT | DEFAULT 'Net 30' | Agreed payment terms |
| `subtotal` | REAL | DEFAULT 0.0 | Gross line subtotal |
| `discount_id` | INTEGER | FK -> `discounts` | Applied discount rule |
| `discount_code` | TEXT | NULLABLE | Applied promo code |
| `discount_amount` | REAL | DEFAULT 0.0 | Calculated discount amount |
| `tax_amount` | REAL | DEFAULT 0.0 | Computed tax total |
| `total_amount` | REAL | DEFAULT 0.0 | Net payable quotation total |
| `converted_subscription_id` | INTEGER | FK -> `subscriptions` | Generated subscription upon acceptance |

### `subscriptions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Subscription ID |
| `uuid` | TEXT | UNIQUE | Public UUID |
| `subscription_number` | TEXT | UNIQUE COLLATE NOCASE | Sequential code (e.g., `SUB-2026-00001`) |
| `customer_id` | INTEGER | FK -> `users` | Customer account |
| `plan_id` | INTEGER | FK -> `subscription_plans` | Selected billing plan |
| `status` | TEXT | CHECK IN ('Draft', 'Quotation', 'Confirmed', 'Active', 'Paused', 'Closed') | State |
| `start_date` | DATE | NOT NULL | Subscription start date |
| `expiry_date` | DATE | NOT NULL | Current billing period end date |
| `payment_terms` | TEXT | DEFAULT 'Net 30' | Payment terms (Immediate, Net 15, Net 30, Net 60) |
| `subtotal` | REAL | DEFAULT 0.0 | Gross sum of all subscription lines |
| `discount_amount` | REAL | DEFAULT 0.0 | Applied discount deduction |
| `tax_amount` | REAL | DEFAULT 0.0 | Applied tax amount |
| `total_amount` | REAL | DEFAULT 0.0 | Net billing total per frequency |
| `quotation_id` | INTEGER | FK -> `quotations` | Origin quotation (if converted) |
| `closed_at` | DATETIME | NULLABLE | Timestamp of early or scheduled closure |
| `closure_reason` | TEXT | NULLABLE | Stated reason for termination |
| `paused_at` | DATETIME | NULLABLE | Timestamp when paused |

### `subscription_lines`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Line ID |
| `subscription_id` | INTEGER FK -> `subscriptions` | Parent subscription |
| `product_id` | INTEGER FK -> `products` | Subscribed product |
| `variant_id` | INTEGER FK -> `product_variants` | Selected variant (e.g., Odoo brand) |
| `product_name` | TEXT | Snapshot product name |
| `variant_name` | TEXT | Snapshot variant name |
| `quantity` | INTEGER NOT NULL DEFAULT 1 | Units subscribed |
| `base_unit_price` | REAL | Snapshot base sales price |
| `variant_additional_price` | REAL | Snapshot variant extra surcharge |
| `unit_price` | REAL | Effective unit price (`base + variant`) |
| `gross_amount` | REAL | `unit_price * quantity` |
| `tax_id` | INTEGER FK -> `taxes` | Applicable tax rule |
| `tax_rate` | REAL | Applicable tax percentage |
| `tax_amount` | REAL | Tax amount calculated on gross amount |
| `line_total` | REAL | Total (`gross_amount + tax_amount`) |

### `subscription_history`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Event ID |
| `subscription_id` | INTEGER FK -> `subscriptions` | Referenced subscription |
| `action` | TEXT NOT NULL | Action (e.g., `CREATE`, `CONFIRM`, `PAUSE`, `RESUME`, `RENEW`, `CLOSE`, `AUTO_EXPIRE`) |
| `from_status` | TEXT | Previous state |
| `to_status` | TEXT | New state |
| `changed_by` | INTEGER FK -> `users` | User who triggered the action |
| `notes` | TEXT | Remarks or operational explanation |
| `created_at` | DATETIME | Timestamp of transition |

---

## 3. Subscription Lifecycle State Machine

```
              ┌───────────────┐
              │     Draft     │
              └───────┬───────┘
                      │ (Confirm)
                      ▼
   ┌───────────┐ (Convert) ┌───────────────┐
   │ Quotation │ ────────> │   Confirmed   │
   └───────────┘           └───────┬───────┘
                                   │ (Activate)
                                   ▼
        ┌──────────────────> ┌───────────┐
        │        (Resume)    │  Active   │ ──(Auto Expire / Term End)──┐
        │                    └─────┬─────┘                             │
        │                          │                                   │
        │                (Pause)   │   (Renew / Extend Term)           │
        │                    ▼     ▼                                   ▼
        │             ┌───────────────┐                       ┌────────────────┐
        └──────────── │    Paused     │ ───(Early Close)────> │     Closed     │
                      └───────────────┘                       └────────────────┘
```

### Lifecycle Rules Enforced
1. **Pause Action:** Validates `plan.allow_pause === 1`. Throws descriptive error if plan does not allow pausing.
2. **Resume Action:** Resumes only from `Paused` status back to `Active`. Clears `paused_at`.
3. **Renew Action:** Validates `plan.allow_renewal === 1`. Extends `expiry_date` by plan billing frequency (Daily +1d, Weekly +7d, Monthly +1m, Yearly +1y).
4. **Early Closure:** Checks `plan.allow_early_closure === 1` if current date is before `expiry_date`. Mandates recording `closure_reason` and `closed_at`.
5. **Automatic Expiry:** Runs periodic check; any subscription with `status = 'Active'` where `date(expiry_date) < date('now')` transitions to `Closed` with reason `'Term ended on YYYY-MM-DD (Automatic Expiry)'`.

---

## 4. REST API Reference

### Quotation Templates
- `GET /api/quotations/templates` — List all templates with bundled product lines.
- `GET /api/quotations/templates/:id` — Get template details by ID.
- `POST /api/quotations/templates` — Create a reusable template (*Admin, Staff*).
- `PUT /api/quotations/templates/:id` — Update an existing template (*Admin, Staff*).
- `DELETE /api/quotations/templates/:id` — Delete a template (*Admin*).

### Quotations
- `GET /api/quotations` — List quotations (Customer filtered to own; Admin/Staff sees all).
- `GET /api/quotations/:id` — Retrieve quotation breakdown and lines.
- `POST /api/quotations` — Generate quotation with line calculations.
- `PUT /api/quotations/:id` — Edit quotation before acceptance.
- `PATCH /api/quotations/:id/status` — Update status (`Sent`, `Accepted`, `Rejected`, `Expired`).
- `POST /api/quotations/:id/convert` — Convert accepted quotation into an active subscription.
- `DELETE /api/quotations/:id` — Delete quotation (*Draft or Rejected only*).

### Subscriptions
- `GET /api/subscriptions` — List subscriptions (Supports `?status=`, `?search=`, pagination).
- `GET /api/subscriptions/stats` — High-level KPI metrics (*Admin, Staff*).
- `GET /api/subscriptions/:id` — Detailed subscription view with customer, plan, lines, and audit history.
- `POST /api/subscriptions` — Create subscription directly.
- `POST /api/subscriptions/:id/pause` — Pause active subscription with reason.
- `POST /api/subscriptions/:id/resume` — Resume paused subscription.
- `POST /api/subscriptions/:id/renew` — Renew subscription for another cycle.
- `POST /api/subscriptions/:id/close` — Close subscription with operational reason.
- `GET /api/subscriptions/:id/history` — Audit log of all state transitions.
- `GET /api/subscriptions/:id/invoice-payload` — Module 4 automated billing export payload.

---

## 5. Module 4 Invoicing Integration Payload Example

`GET /api/subscriptions/:id/invoice-payload` produces:

```json
{
  "source_module": "Module 3: Subscription & Quotation Management",
  "target_module": "Module 4: Automated Invoicing & Billing",
  "subscription_id": 1,
  "subscription_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "subscription_number": "SUB-2026-00001",
  "customer": {
    "id": 8,
    "uuid": "c39a28b1-4131-4172-bc32-bf72d11e4f90",
    "name": "Demo Customer",
    "email": "customer@brightloop.com"
  },
  "plan": {
    "id": 3,
    "name": "Monthly Professional SaaS",
    "code": "MONTHLY-PRO",
    "billing_frequency": "monthly"
  },
  "dates": {
    "start_date": "2026-10-01",
    "expiry_date": "2026-11-01",
    "invoice_date": "2026-10-31",
    "due_date": "2026-11-30"
  },
  "payment_terms": "Net 30",
  "currency": "INR",
  "items": [
    {
      "line_id": 1,
      "product_id": 1,
      "product_name": "Cloud ERP Suite",
      "product_type": "service",
      "variant_id": 2,
      "variant_name": "Odoo Edition",
      "quantity": 1,
      "base_unit_price": 2400.0,
      "variant_additional_price": 560.0,
      "unit_price": 2960.0,
      "gross_amount": 2960.0,
      "tax_code": "GST18",
      "tax_rate": 18.0,
      "tax_amount": 442.8,
      "line_total": 3402.8
    }
  ],
  "discount": {
    "id": 2,
    "code": "FLAT500",
    "amount": 500.0
  },
  "summary": {
    "subtotal": 2960.0,
    "discount_amount": 500.0,
    "taxable_amount": 2460.0,
    "tax_amount": 442.8,
    "total_amount": 2902.8
  }
}
```

---

## 6. Testing & Verification

### Running the Parallel Test Runner
```bash
cd backend
npm test
# or
npm run test:parallel
```

### Running Individual Module Suites
```bash
npm run test:m1   # Module 1 (Auth & RBAC - 17 tests)
npm run test:m2   # Module 2 (Catalog, Pricing & Tax - 34 tests)
npm run test:m3   # Module 3 (Subscriptions & Quotations - 41 tests)
```

### Running Live HTTP E2E API Verification
```bash
node backend/test_module3_api.js
```
All 92 automated tests pass with 100% success rate.
