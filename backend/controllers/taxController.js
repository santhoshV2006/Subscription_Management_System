const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');

/**
 * Tax Management Controller
 * Handles tax rules (percentage, fixed), auto-application, and calculation accuracy.
 */

/**
 * Get all taxes with optional active filter.
 */
function getAllTaxes(req, res) {
  try {
    const { is_active } = req.query;
    let query = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM products p WHERE p.tax_id = t.id) as applied_products_count
      FROM taxes t
      WHERE 1=1
    `;
    const params = [];

    if (is_active !== undefined && is_active !== '') {
      query += ` AND t.is_active = ?`;
      params.push(parseInt(is_active, 10));
    }

    query += ` ORDER BY t.created_at DESC`;
    const taxes = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: taxes
    });
  } catch (error) {
    console.error('Error in getAllTaxes:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tax rules.' });
  }
}

/**
 * Get tax by ID or UUID.
 */
function getTaxById(req, res) {
  try {
    const { id } = req.params;
    let tax;

    if (!isNaN(Number(id))) {
      tax = db.prepare('SELECT * FROM taxes WHERE id = ?').get(Number(id));
    } else {
      tax = db.prepare('SELECT * FROM taxes WHERE uuid = ?').get(id);
    }

    if (!tax) {
      return res.status(404).json({ success: false, message: 'Tax rule not found.' });
    }

    const linkedProducts = db.prepare('SELECT id, uuid, name, sales_price FROM products WHERE tax_id = ?').all(tax.id);

    res.json({
      success: true,
      data: {
        ...tax,
        linked_products: linkedProducts
      }
    });
  } catch (error) {
    console.error('Error in getTaxById:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tax rule.' });
  }
}

/**
 * Create a new tax rule. (Admin only)
 */
function createTax(req, res) {
  try {
    const {
      name,
      code,
      rate = 0,
      tax_type = 'percentage',
      description = '',
      is_compound = 0,
      is_active = 1
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tax name is required.' });
    }

    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 0) {
      return res.status(400).json({ success: false, message: 'Tax rate must be a non-negative number.' });
    }

    const taxTypeVal = tax_type.trim().toLowerCase();
    if (!['percentage', 'fixed'].includes(taxTypeVal)) {
      return res.status(400).json({ success: false, message: 'Tax type must be either percentage or fixed.' });
    }

    const taxCode = code && code.trim() ? code.trim().toUpperCase() : `TAX-${rateNum}-${Date.now().toString(36).toUpperCase()}`;

    // Check duplicate code
    const existing = db.prepare('SELECT id FROM taxes WHERE code = ?').get(taxCode);
    if (existing) {
      return res.status(400).json({ success: false, message: `Tax code "${taxCode}" is already in use.` });
    }

    const uuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO taxes (uuid, name, code, rate, tax_type, description, is_compound, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      name.trim(),
      taxCode,
      rateNum,
      taxTypeVal,
      description ? description.trim() : null,
      is_compound ? 1 : 0,
      is_active ? 1 : 0
    );

    const newTax = db.prepare('SELECT * FROM taxes WHERE id = ?').get(result.lastInsertRowid);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'TAX_CREATED', ?)
    `).run(req.user ? req.user.id : null, `Created tax rule "${name}" (${rateNum}%)`);

    res.status(201).json({
      success: true,
      message: 'Tax rule created successfully.',
      data: newTax
    });
  } catch (error) {
    console.error('Error in createTax:', error);
    res.status(500).json({ success: false, message: 'Failed to create tax rule.' });
  }
}

/**
 * Update a tax rule. (Admin only)
 */
function updateTax(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM taxes WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM taxes WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tax rule not found.' });
    }

    const {
      name,
      code,
      rate,
      tax_type,
      description,
      is_compound,
      is_active
    } = req.body;

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedCode = code !== undefined ? code.trim().toUpperCase() : existing.code;
    const updatedRate = rate !== undefined ? parseFloat(rate) : existing.rate;
    const updatedType = tax_type !== undefined ? tax_type.trim().toLowerCase() : existing.tax_type;
    const updatedDesc = description !== undefined ? (description ? description.trim() : null) : existing.description;
    const updatedCompound = is_compound !== undefined ? (is_compound ? 1 : 0) : existing.is_compound;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    if (!updatedName) {
      return res.status(400).json({ success: false, message: 'Tax name cannot be empty.' });
    }

    if (updatedCode !== existing.code) {
      const codeTaken = db.prepare('SELECT id FROM taxes WHERE code = ? AND id != ?').get(updatedCode, existing.id);
      if (codeTaken) {
        return res.status(400).json({ success: false, message: `Tax code "${updatedCode}" is already in use.` });
      }
    }

    db.prepare(`
      UPDATE taxes
      SET name = ?, code = ?, rate = ?, tax_type = ?, description = ?, is_compound = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedName,
      updatedCode,
      updatedRate,
      updatedType,
      updatedDesc,
      updatedCompound,
      updatedActive,
      existing.id
    );

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'TAX_UPDATED', ?)
    `).run(req.user ? req.user.id : null, `Updated tax rule "${updatedName}" (ID: ${existing.id})`);

    const updated = db.prepare('SELECT * FROM taxes WHERE id = ?').get(existing.id);

    res.json({
      success: true,
      message: 'Tax rule updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error in updateTax:', error);
    res.status(500).json({ success: false, message: 'Failed to update tax rule.' });
  }
}

/**
 * Delete a tax rule. (Admin only)
 */
function deleteTax(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM taxes WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM taxes WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tax rule not found.' });
    }

    // Set tax_id to null on products linked to this tax
    db.prepare('UPDATE products SET tax_id = NULL WHERE tax_id = ?').run(existing.id);

    db.prepare('DELETE FROM taxes WHERE id = ?').run(existing.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'TAX_DELETED', ?)
    `).run(req.user ? req.user.id : null, `Deleted tax rule "${existing.name}" (ID: ${existing.id})`);

    res.json({
      success: true,
      message: `Tax rule "${existing.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deleteTax:', error);
    res.status(500).json({ success: false, message: 'Failed to delete tax rule.' });
  }
}

module.exports = {
  getAllTaxes,
  getTaxById,
  createTax,
  updateTax,
  deleteTax
};
