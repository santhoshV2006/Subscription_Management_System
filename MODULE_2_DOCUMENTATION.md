# 📦 Brightloop Software — Module 2 Documentation
## Module: Product, Plans, Variants, Taxes and Discounts

---

## 1. Overview & Architecture

Module 2 provides the core commercial foundation of the **Brightloop Subscription Management System**. It manages the product catalog, brand and edition variants with price surcharges, flexible recurring subscription billing frequencies (daily, weekly, monthly, yearly), hierarchical tax rules, condition-based discount vouchers, and a centralized pricing calculation engine.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODULE 2 PRICING ENGINE                         │
│                    (backend/utils/pricingEngine.js)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐          ┌───────────────────┐        ┌──────────────────┐
│   Products   │          │Subscription Plans │        │     Discounts    │
│  & Variants  │          │ (Daily/Wk/Mo/Yr)  │        │ (Fixed / % / Cap)│
└──────┬───────┘          └─────────┬─────────┘        └────────┬─────────┘
       │                            │                           │
       └────────────────────────────┼───────────────────────────┘
                                    ▼
                         ┌───────────────────────┐
                         │       Tax Rules       │
                         │(GST 18%, Concessional)│
                         └──────────┬────────────┘
                                    ▼
                         ┌───────────────────────┐
                         │ Final Invoice / Quote │
                         │ (Consistent Across DB,│
                         │  Billing & Web UI)    │
                         └───────────────────────┘
```

---

## 2. Database Schema

### 2.1 `products`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique numeric ID |
| `uuid` | TEXT | UNIQUE, NOT NULL | Public UUID identifier |
| `name` | TEXT | NOT NULL | Product name (e.g. "Cloud ERP Suite") |
| `product_type` | TEXT | NOT NULL DEFAULT 'service' | Type: `software`, `service`, `goods`, `consumable` |
| `sales_price` | REAL | NOT NULL DEFAULT 0.0 | Base catalog sales price (in ₹) |
| `cost_price` | REAL | NOT NULL DEFAULT 0.0 | Direct fulfillment / COGS cost |
| `notes` | TEXT | NULLABLE | Detailed product description or specs |
| `tax_id` | INTEGER | REFERENCES `taxes(id)` | Default applicable tax rule |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 for active, 0 for inactive |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last updated timestamp |

### 2.2 `product_variants`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique variant ID |
| `uuid` | TEXT | UNIQUE, NOT NULL | Public variant UUID |
| `product_id` | INTEGER | NOT NULL, REFERENCES `products(id)` ON DELETE CASCADE | Parent product |
| `attribute_name` | TEXT | NOT NULL DEFAULT 'Brand' | Attribute category (e.g. "Brand", "Edition", "Region") |
| `variant_name` | TEXT | NOT NULL | Variant name (e.g. "Odoo Edition", "SAP", "Zoho") |
| `sku` | TEXT | NULLABLE | Unique inventory/billing code |
| `additional_price` | REAL | NOT NULL DEFAULT 0.0 | **Surcharge added to base product price** (e.g. **+₹560.00**) |
| `cost_price_extra` | REAL | NOT NULL DEFAULT 0.0 | Additional cost incurred by this variant |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Active status flag |

### 2.3 `subscription_plans`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Plan primary key |
| `uuid` | TEXT | UNIQUE, NOT NULL | Public plan UUID |
| `product_id` | INTEGER | REFERENCES `products(id)` ON DELETE SET NULL | Linked product or universal catalog |
| `name` | TEXT | NOT NULL | Plan name (e.g. "Cloud ERP Monthly Business") |
| `code` | TEXT | UNIQUE, NOT NULL COLLATE NOCASE | Unique plan code (e.g. "PLAN-ERP-MONTHLY") |
| `description` | TEXT | NULLABLE | Customer-facing plan summary |
| `billing_frequency` | TEXT | CHECK IN (`daily`, `weekly`, `monthly`, `yearly`) | Recurring billing frequency |
| `price` | REAL | NOT NULL DEFAULT 0.0 | Recurring plan rate |
| `min_quantity` | INTEGER | NOT NULL DEFAULT 1 | Minimum purchase quantity (e.g. 3 for Team plans) |
| `start_date` | DATE | NULLABLE | Availability start date |
| `end_date` | DATE | NULLABLE | Availability end date |
| `is_auto_close_on_expiry`| INTEGER | NOT NULL DEFAULT 1 | Automatic closure when expiration date passes |
| `allow_early_closure` | INTEGER | NOT NULL DEFAULT 1 | Policy flag for early cancellation |
| `allow_pause` | INTEGER | NOT NULL DEFAULT 1 | Policy flag for pausing subscriptions |
| `allow_renewal` | INTEGER | NOT NULL DEFAULT 1 | Policy flag for subscription renewal |
| `trial_days` | INTEGER | DEFAULT 0 | Free trial duration in days |
| `status` | TEXT | CHECK IN (`active`, `inactive`, `expired`, `archived`) | Operational status |

### 2.4 `taxes`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Tax rule ID |
| `uuid` | TEXT | UNIQUE, NOT NULL | Public tax UUID |
| `name` | TEXT | NOT NULL | Display name (e.g. "GST 18%", "VAT 5%") |
| `code` | TEXT | UNIQUE, NOT NULL COLLATE NOCASE | Unique code (e.g. "GST18") |
| `rate` | REAL | NOT NULL DEFAULT 0.0 | Tax rate (percentage e.g. 18.0, or fixed ₹) |
| `tax_type` | TEXT | CHECK IN (`percentage`, `fixed`) | Calculation method |
| `description` | TEXT | NULLABLE | Statutory breakdown (e.g. 9% CGST + 9% SGST) |
| `is_compound` | INTEGER | NOT NULL DEFAULT 0 | Compound tax indicator |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Rule active indicator |

### 2.5 `discounts`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Discount ID |
| `uuid` | TEXT | UNIQUE, NOT NULL | Public discount UUID |
| `name` | TEXT | NOT NULL | Campaign name (e.g. "Launch 20% Off") |
| `code` | TEXT | UNIQUE, NOT NULL COLLATE NOCASE | Coupon code (e.g. "BRIGHT20", "FLAT500") |
| `discount_type` | TEXT | CHECK IN (`percentage`, `fixed`) | Type of discount deduction |
| `value` | REAL | NOT NULL | Discount value (e.g. 20.0 for 20%, 500.0 for ₹500) |
| `min_purchase_amount` | REAL | NOT NULL DEFAULT 0.0 | Minimum subtotal required before discount applies |
| `min_quantity` | INTEGER | NOT NULL DEFAULT 1 | Minimum unit count required |
| `start_date` | DATE | NULLABLE | Promo active start date |
| `end_date` | DATE | NULLABLE | Promo expiration date |
| `max_usage_limit` | INTEGER | NULLABLE | Maximum lifetime redemptions (NULL = unlimited) |
| `used_count` | INTEGER | NOT NULL DEFAULT 0 | Current number of redemptions |
| `applies_to` | TEXT | CHECK IN (`all`, `product`, `plan`) | Discount applicability scope |
| `target_product_id` | INTEGER | REFERENCES `products(id)` | Target product (if scope is `product`) |
| `target_plan_id` | INTEGER | REFERENCES `subscription_plans(id)` | Target plan (if scope is `plan`) |
| `is_auto_apply` | INTEGER | NOT NULL DEFAULT 0 | Automatically apply to next eligible invoice |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Active discount flag |

---

## 3. Pricing Calculation Engine Logic

Pricing is calculated through the unified `backend/utils/pricingEngine.js` module:

```
1. Effective Unit Price = Base Sales Price + Variant Additional Price
   Example: Base (₹2,400.00) + Odoo Variant (+₹560.00) = ₹2,960.00

2. Gross Subtotal = Effective Unit Price * Quantity
   Example: ₹2,960.00 * 2 units = ₹5,920.00

3. Discount Eligibility Verification:
   - Discount must be active (is_active = 1)
   - Current date must be within [start_date, end_date]
   - Usage limit not exceeded (used_count < max_usage_limit)
   - Gross Subtotal >= min_purchase_amount
   - Quantity >= min_quantity
   - Scope matches target product/plan or 'all'

4. Discount Deduction:
   - Percentage: (Gross Subtotal * value) / 100
     Example: (₹5,920.00 * 20%) = ₹1,184.00
   - Fixed: min(value, Gross Subtotal)
     Example: min(₹500.00, ₹5,920.00) = ₹500.00

5. Taxable Net Amount = max(0, Gross Subtotal - Discount Deduction)
   Example: ₹5,920.00 - ₹1,184.00 = ₹4,736.00

6. Tax Calculation:
   - Percentage: (Taxable Net Amount * tax_rate) / 100
     Example: (₹4,736.00 * 18%) = ₹852.48
   - Fixed: tax_rate

7. Total Payable = Taxable Net Amount + Tax Amount
   Example: ₹4,736.00 + ₹852.48 = ₹5,588.48
```

---

## 4. REST API Reference

All requests require JWT authentication header `Authorization: Bearer <access_token>`.

### 4.1 Product & Variant Endpoints
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/products` | All | List products with pagination, search, type filters, and variant summaries |
| `GET` | `/api/products/:id` | All | Retrieve single product with full variant array and tax rules |
| `POST` | `/api/products` | Admin | Create product (name, type, sales_price, cost_price, notes, tax_id, variants) |
| `PUT` | `/api/products/:id` | Admin | Update existing product details |
| `DELETE` | `/api/products/:id` | Admin | Delete product and cascading variants |
| `POST` | `/api/products/:id/variants` | Admin | Add variant to product (brand, additional_price, cost_price_extra, sku) |
| `PUT` | `/api/products/:id/variants/:variantId` | Admin | Update variant name, additional price surcharge, or SKU |
| `DELETE` | `/api/products/:id/variants/:variantId` | Admin | Delete specific variant |

### 4.2 Subscription Plan Endpoints
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/plans` | All | List plans (auto-checks expiry; filter by frequency, status, product) |
| `GET` | `/api/plans/:id` | All | Retrieve single plan with product variants |
| `POST` | `/api/plans` | Admin | Create plan with daily/weekly/monthly/yearly frequency, min_quantity, dates |
| `PUT` | `/api/plans/:id` | Admin | Update plan pricing, frequency, policy settings, or dates |
| `DELETE` | `/api/plans/:id` | Admin | Delete subscription plan |
| `POST` | `/api/plans/:id/pause` | Admin | Pause subscription plan (honors `allow_pause` rule) |
| `POST` | `/api/plans/:id/resume` | Admin | Resume paused subscription plan |
| `POST` | `/api/plans/:id/close` | Admin | Early closure and archive of plan (honors `allow_early_closure`) |

### 4.3 Tax Rule Endpoints
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/taxes` | All | List all configured tax rules |
| `GET` | `/api/taxes/:id` | Admin/Staff | Retrieve single tax rule with linked products |
| `POST` | `/api/taxes` | Admin | Create tax rule (name, code, rate, tax_type, description) |
| `PUT` | `/api/taxes/:id` | Admin | Update tax rule |
| `DELETE` | `/api/taxes/:id` | Admin | Delete tax rule |

### 4.4 Discount Endpoints
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/discounts` | Admin | List all discounts with usage stats, conditions, and status |
| `GET` | `/api/discounts/:id` | Admin | Retrieve single discount with customer redemption history |
| `POST` | `/api/discounts` | Admin | Create fixed/percentage discount with min purchase, min qty, usage limit |
| `PUT` | `/api/discounts/:id` | Admin | Update discount parameters |
| `DELETE` | `/api/discounts/:id` | Admin | Delete discount rule |
| `POST` | `/api/discounts/validate` | All | Validate coupon code against cart/line item subtotal and quantity |
| `POST` | `/api/discounts/record-usage` | Admin/Staff | Record discount usage upon invoice generation / checkout |

### 4.5 Centralized Pricing Engine Endpoint (For Subscription & Billing Integration)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/pricing/calculate` | All | Unified pricing calculation API |

#### Sample Request Body:
```json
{
  "product_id": 1,
  "variant_id": 1,
  "plan_id": 3,
  "quantity": 2,
  "discount_code": "BRIGHT20",
  "tax_id": 1
}
```

#### Sample Response:
```json
{
  "success": true,
  "currency": "INR",
  "currency_symbol": "₹",
  "calculation": {
    "product": {
      "id": 1,
      "name": "Cloud ERP Suite",
      "type": "software",
      "base_sales_price": 2400.0,
      "cost_price": 800.0
    },
    "variant": {
      "id": 1,
      "attribute_name": "Brand",
      "variant_name": "Odoo Edition",
      "additional_price": 560.0,
      "sku": "ERP-ODOO-560"
    },
    "plan": {
      "id": 3,
      "name": "Cloud ERP Monthly Business",
      "billing_frequency": "monthly",
      "min_quantity": 1,
      "allow_early_closure": true,
      "allow_pause": true,
      "allow_renewal": true
    },
    "quantity": 2,
    "pricing_breakdown": {
      "base_unit_price": 2400.0,
      "variant_additional_price": 560.0,
      "effective_unit_price": 2960.0,
      "gross_subtotal": 5920.0,
      "discount_amount": 1184.0,
      "discount_applied": true,
      "discount_details": {
        "id": 1,
        "name": "Brightloop Launch 20% Off",
        "code": "BRIGHT20",
        "discount_type": "percentage",
        "value": 20.0
      },
      "taxable_amount": 4736.0,
      "tax_details": {
        "id": 1,
        "name": "GST 18%",
        "code": "GST18",
        "rate": 18.0
      },
      "tax_amount": 852.48,
      "final_total": 5588.48
    },
    "financial_metrics": {
      "unit_cost": 950.0,
      "total_cost": 1900.0,
      "estimated_profit": 2836.0,
      "margin_percentage": 59.88
    }
  }
}
```

---

## 5. Automated Test Verification

Module 2 includes comprehensive unit, integration, and API tests:
- **`node test_module2.js`**: Runs 34 assertions verifying:
  * Variant additional pricing (+₹560 for Odoo).
  * Multi-quantity and GST 18% tax accuracy.
  * Discount conditions: minimum purchase, minimum quantity, expired dates, and maximum usage limits.
  * Plan frequencies (Daily, Weekly, Monthly, Yearly), minimum quantity checks, and automatic closure.
- **`node test_api_endpoints.js`**: Runs 12 live authenticated HTTP operations verifying:
  * Admin login and JWT token validation.
  * Product, variant, plan, tax, and discount CRUD operations.
  * Plan pausing and resuming.
  * Coupon validation and live calculation endpoint.

Both test suites execute with **100% pass rate**.
