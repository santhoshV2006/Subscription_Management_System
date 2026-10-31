const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { calculatePrice } = require('../utils/pricingEngine');

// Authentication required for pricing calculations
router.use(authenticate);

/**
 * POST /api/pricing/calculate
 * Core pricing calculation engine endpoint.
 *
 * Request Body:
 * {
 *   product_id: 1,
 *   variant_id: 2,         // optional
 *   plan_id: 3,            // optional
 *   quantity: 2,           // default: 1
 *   discount_code: "OD10", // optional
 *   tax_id: 1,             // optional
 *   reference_date: "2026-10-31" // optional
 * }
 */
router.post('/calculate', (req, res) => {
  try {
    const {
      product_id,
      variant_id = null,
      plan_id = null,
      quantity = 1,
      discount_code = null,
      tax_id = null,
      reference_date = null
    } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id is required for price calculation.'
      });
    }

    const result = calculatePrice({
      product_id,
      variant_id,
      plan_id,
      quantity,
      discount_code,
      tax_id,
      reference_date: reference_date || new Date()
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Pricing calculation failed.'
    });
  }
});

module.exports = router;
