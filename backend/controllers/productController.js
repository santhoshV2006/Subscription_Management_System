const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');

/**
 * Product & Variant Controller
 * Role-based Product Management for Module 2
 */

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * Get all products with optional filters, search, and variants count.
 */
function getAllProducts(req, res) {
  try {
    const { search, product_type, is_active, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        p.*, 
        t.name as tax_name, 
        t.rate as tax_rate,
        (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as active_variants_count,
        (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) as total_variants_count
      FROM products p
      LEFT JOIN taxes t ON p.tax_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (p.name LIKE ? OR p.notes LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (product_type && product_type.trim()) {
      query += ` AND p.product_type = ?`;
      params.push(product_type.trim());
    }

    if (is_active !== undefined && is_active !== '') {
      query += ` AND p.is_active = ?`;
      params.push(parseInt(is_active, 10));
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult ? countResult.total : 0;

    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const products = db.prepare(query).all(...params);

    // Fetch variants for each product in listing for quick inspection
    const productsWithVariants = products.map(prod => {
      const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC').all(prod.id);
      return {
        ...prod,
        variants
      };
    });

    res.json({
      success: true,
      data: {
        products: productsWithVariants,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve products.' });
  }
}

/**
 * Get single product by id or uuid, including variants and tax info.
 */
function getProductById(req, res) {
  try {
    const { id } = req.params;
    let product;

    if (!isNaN(Number(id))) {
      product = db.prepare(`
        SELECT p.*, t.name as tax_name, t.rate as tax_rate, t.code as tax_code
        FROM products p
        LEFT JOIN taxes t ON p.tax_id = t.id
        WHERE p.id = ?
      `).get(Number(id));
    } else {
      product = db.prepare(`
        SELECT p.*, t.name as tax_name, t.rate as tax_rate, t.code as tax_code
        FROM products p
        LEFT JOIN taxes t ON p.tax_id = t.id
        WHERE p.uuid = ?
      `).get(id);
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC').all(product.id);
    const plans = db.prepare('SELECT * FROM subscription_plans WHERE product_id = ? ORDER BY id ASC').all(product.id);

    res.json({
      success: true,
      data: {
        ...product,
        variants,
        plans
      }
    });
  } catch (error) {
    console.error('Error in getProductById:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve product.' });
  }
}

/**
 * Create a new product. (Admin only)
 */
function createProduct(req, res) {
  try {
    const {
      name,
      product_type = 'service',
      sales_price = 0,
      cost_price = 0,
      notes = '',
      tax_id = null,
      is_active = 1,
      variants = []
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    const salesPriceNum = parseFloat(sales_price);
    const costPriceNum = parseFloat(cost_price);

    if (isNaN(salesPriceNum) || salesPriceNum < 0) {
      return res.status(400).json({ success: false, message: 'Sales price must be a non-negative number.' });
    }

    if (isNaN(costPriceNum) || costPriceNum < 0) {
      return res.status(400).json({ success: false, message: 'Cost price must be a non-negative number.' });
    }

    const uuid = uuidv4();

    // Verify tax_id if provided
    let verifiedTaxId = null;
    if (tax_id) {
      const tax = db.prepare('SELECT id FROM taxes WHERE id = ?').get(Number(tax_id));
      if (tax) verifiedTaxId = tax.id;
    }

    const insertProduct = db.prepare(`
      INSERT INTO products (uuid, name, product_type, sales_price, cost_price, notes, tax_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertProduct.run(
      uuid,
      name.trim(),
      product_type,
      salesPriceNum,
      costPriceNum,
      notes ? notes.trim() : null,
      verifiedTaxId,
      is_active ? 1 : 0
    );

    const productId = result.lastInsertRowid;

    // Insert variants if provided
    if (Array.isArray(variants) && variants.length > 0) {
      const insertVariant = db.prepare(`
        INSERT INTO product_variants (uuid, product_id, attribute_name, variant_name, sku, additional_price, cost_price_extra, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const v of variants) {
        if (v.variant_name && v.variant_name.trim()) {
          insertVariant.run(
            uuidv4(),
            productId,
            v.attribute_name ? v.attribute_name.trim() : 'Brand',
            v.variant_name.trim(),
            v.sku ? v.sku.trim() : null,
            parseFloat(v.additional_price || 0),
            parseFloat(v.cost_price_extra || 0),
            v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1
          );
        }
      }
    }

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PRODUCT_CREATED', ?)
    `).run(req.user ? req.user.id : null, `Created product "${name}" (ID: ${productId})`);

    // Return created product with variants
    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    newProduct.variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(productId);

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: newProduct
    });
  } catch (error) {
    console.error('Error in createProduct:', error);
    res.status(500).json({ success: false, message: 'Failed to create product.' });
  }
}

/**
 * Update an existing product. (Admin only)
 */
function updateProduct(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM products WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const {
      name,
      product_type,
      sales_price,
      cost_price,
      notes,
      tax_id,
      is_active
    } = req.body;

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedType = product_type !== undefined ? product_type : existing.product_type;
    const updatedSalesPrice = sales_price !== undefined ? parseFloat(sales_price) : existing.sales_price;
    const updatedCostPrice = cost_price !== undefined ? parseFloat(cost_price) : existing.cost_price;
    const updatedNotes = notes !== undefined ? (notes ? notes.trim() : null) : existing.notes;
    const updatedTaxId = tax_id !== undefined ? (tax_id ? Number(tax_id) : null) : existing.tax_id;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    if (!updatedName) {
      return res.status(400).json({ success: false, message: 'Product name cannot be empty.' });
    }

    db.prepare(`
      UPDATE products
      SET name = ?, product_type = ?, sales_price = ?, cost_price = ?, notes = ?, tax_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedName,
      updatedType,
      updatedSalesPrice,
      updatedCostPrice,
      updatedNotes,
      updatedTaxId,
      updatedActive,
      existing.id
    );

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PRODUCT_UPDATED', ?)
    `).run(req.user ? req.user.id : null, `Updated product "${updatedName}" (ID: ${existing.id})`);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
    updated.variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(existing.id);

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
}

/**
 * Delete a product. (Admin only)
 */
function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM products WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Delete product (cascades to product_variants)
    db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PRODUCT_DELETED', ?)
    `).run(req.user ? req.user.id : null, `Deleted product "${existing.name}" (ID: ${existing.id})`);

    res.json({
      success: true,
      message: `Product "${existing.name}" and its variants deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
}

// ─── Product Variants ─────────────────────────────────────────────────────────

/**
 * Add a variant to a product. (Admin only)
 * Example: Selecting Odoo brand adds ₹560 to product price.
 */
function addVariant(req, res) {
  try {
    const { id } = req.params;
    let product;

    if (!isNaN(Number(id))) {
      product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
    } else {
      product = db.prepare('SELECT * FROM products WHERE uuid = ?').get(id);
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const {
      attribute_name = 'Brand',
      variant_name,
      sku = null,
      additional_price = 0,
      cost_price_extra = 0,
      is_active = 1
    } = req.body;

    if (!variant_name || !variant_name.trim()) {
      return res.status(400).json({ success: false, message: 'Variant name (e.g. "Odoo") is required.' });
    }

    const addPriceNum = parseFloat(additional_price);
    const costPriceExtraNum = parseFloat(cost_price_extra);

    if (isNaN(addPriceNum)) {
      return res.status(400).json({ success: false, message: 'Additional price must be a valid number.' });
    }

    const uuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO product_variants (uuid, product_id, attribute_name, variant_name, sku, additional_price, cost_price_extra, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      product.id,
      attribute_name.trim(),
      variant_name.trim(),
      sku ? sku.trim() : null,
      addPriceNum,
      costPriceExtraNum,
      is_active ? 1 : 0
    );

    const newVariant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(result.lastInsertRowid);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'VARIANT_CREATED', ?)
    `).run(req.user ? req.user.id : null, `Added variant "${variant_name}" with +₹${addPriceNum} to product "${product.name}"`);

    res.status(201).json({
      success: true,
      message: `Variant "${variant_name}" added successfully.`,
      data: newVariant
    });
  } catch (error) {
    console.error('Error in addVariant:', error);
    res.status(500).json({ success: false, message: 'Failed to add variant.' });
  }
}

/**
 * Update a variant. (Admin only)
 */
function updateVariant(req, res) {
  try {
    const { variantId } = req.params;
    let variant;

    if (!isNaN(Number(variantId))) {
      variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(Number(variantId));
    } else {
      variant = db.prepare('SELECT * FROM product_variants WHERE uuid = ?').get(variantId);
    }

    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found.' });
    }

    const {
      attribute_name,
      variant_name,
      sku,
      additional_price,
      cost_price_extra,
      is_active
    } = req.body;

    const updatedAttr = attribute_name !== undefined ? attribute_name.trim() : variant.attribute_name;
    const updatedName = variant_name !== undefined ? variant_name.trim() : variant.variant_name;
    const updatedSku = sku !== undefined ? (sku ? sku.trim() : null) : variant.sku;
    const updatedAddPrice = additional_price !== undefined ? parseFloat(additional_price) : variant.additional_price;
    const updatedCostExtra = cost_price_extra !== undefined ? parseFloat(cost_price_extra) : variant.cost_price_extra;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : variant.is_active;

    if (!updatedName) {
      return res.status(400).json({ success: false, message: 'Variant name cannot be empty.' });
    }

    db.prepare(`
      UPDATE product_variants
      SET attribute_name = ?, variant_name = ?, sku = ?, additional_price = ?, cost_price_extra = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedAttr,
      updatedName,
      updatedSku,
      updatedAddPrice,
      updatedCostExtra,
      updatedActive,
      variant.id
    );

    const updated = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variant.id);

    res.json({
      success: true,
      message: 'Variant updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error in updateVariant:', error);
    res.status(500).json({ success: false, message: 'Failed to update variant.' });
  }
}

/**
 * Delete a variant. (Admin only)
 */
function deleteVariant(req, res) {
  try {
    const { variantId } = req.params;
    let variant;

    if (!isNaN(Number(variantId))) {
      variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(Number(variantId));
    } else {
      variant = db.prepare('SELECT * FROM product_variants WHERE uuid = ?').get(variantId);
    }

    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found.' });
    }

    db.prepare('DELETE FROM product_variants WHERE id = ?').run(variant.id);

    res.json({
      success: true,
      message: `Variant "${variant.variant_name}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deleteVariant:', error);
    res.status(500).json({ success: false, message: 'Failed to delete variant.' });
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant
};
