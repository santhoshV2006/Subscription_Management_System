/**
 * Brightloop — Module 2: Products, Plans, Variants, Taxes & Discounts
 * Comprehensive Admin & Staff Management Interface & Live Pricing Simulator
 */

const Module2 = {
  // ─── Formatters & Helpers ───────────────────────────────────────────────────

  formatCurrency(amount) {
    const val = parseFloat(amount) || 0;
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  frequencyBadge(freq) {
    const colors = {
      daily: 'badge-daily',
      weekly: 'badge-weekly',
      monthly: 'badge-monthly',
      yearly: 'badge-yearly'
    };
    const f = (freq || 'monthly').toLowerCase();
    return `<span class="badge ${colors[f] || 'badge-monthly'}">${f.toUpperCase()}</span>`;
  },

  statusBadge(status) {
    const map = {
      active: { cls: 'badge-success', label: 'Active', icon: 'check_circle' },
      inactive: { cls: 'badge-neutral', label: 'Inactive', icon: 'pause_circle' },
      expired: { cls: 'badge-danger', label: 'Expired', icon: 'cancel' },
      archived: { cls: 'badge-warning', label: 'Archived', icon: 'archive' },
      limit_reached: { cls: 'badge-danger', label: 'Limit Reached', icon: 'block' },
      upcoming: { cls: 'badge-info', label: 'Upcoming', icon: 'schedule' }
    };
    const s = map[status] || { cls: 'badge-neutral', label: status, icon: 'info' };
    return `<span class="badge ${s.cls}"><span class="material-icons-round" style="font-size: 13px; margin-right: 3px;">${s.icon}</span>${s.label}</span>`;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PRODUCTS & VARIANTS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async productsPage(queryParams = {}) {
    const params = new URLSearchParams({
      page: queryParams.page || 1,
      limit: 20,
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.product_type && { product_type: queryParams.product_type }),
      ...(queryParams.is_active !== undefined && queryParams.is_active !== '' && { is_active: queryParams.is_active })
    });

    const [prodRes, taxRes] = await Promise.all([
      API.get(`/products?${params}`),
      API.get('/taxes?is_active=1')
    ]);

    const products = prodRes.success ? prodRes.data.products : [];
    const pagination = prodRes.success ? prodRes.data.pagination : { total: 0, page: 1, totalPages: 1 };
    const taxes = taxRes.success ? taxRes.data : [];

    // Cache taxes in window for modal usage
    window._blTaxes = taxes;

    // Aggregate counts
    const softwareCount = products.filter(p => p.product_type === 'software').length;
    const serviceCount = products.filter(p => p.product_type === 'service').length;
    const goodsCount = products.filter(p => p.product_type === 'goods').length;

    const content = `
      <div class="welcome-banner">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2>Product & Variant Management</h2>
            <p>Configure software, services, physical goods, and brand variants with custom surcharge pricing.</p>
          </div>
          <button class="btn btn-primary" onclick="Module2.openProductModal()">
            <span class="material-icons-round">add</span>
            Add Product
          </button>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon"><span class="material-icons-round">inventory_2</span></div>
          <div class="stat-value">${pagination.total}</div>
          <div class="stat-label">Total Products</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon"><span class="material-icons-round">computer</span></div>
          <div class="stat-value">${softwareCount}</div>
          <div class="stat-label">Software Products</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon"><span class="material-icons-round">design_services</span></div>
          <div class="stat-value">${serviceCount}</div>
          <div class="stat-label">Services & Subscriptions</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-icon"><span class="material-icons-round">category</span></div>
          <div class="stat-value">${goodsCount}</div>
          <div class="stat-label">Goods & Hardware</div>
        </div>
      </div>

      <!-- Main Products Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All Products (${pagination.total})</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/dashboard/admin/pricing-calculator')">
              <span class="material-icons-round">calculate</span>
              Test in Calculator
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--gray-100);">
          <div class="filter-bar">
            <div class="search-bar" style="flex: 1;">
              <span class="material-icons-round">search</span>
              <input type="text" placeholder="Search products by name or notes..." id="prod-search-input"
                     value="${queryParams.search || ''}"
                     onkeyup="if(event.key==='Enter') Module2.filterProducts()">
            </div>
            <select class="filter-select" id="filter-prod-type" onchange="Module2.filterProducts()">
              <option value="">All Types</option>
              <option value="software" ${queryParams.product_type === 'software' ? 'selected' : ''}>Software</option>
              <option value="service" ${queryParams.product_type === 'service' ? 'selected' : ''}>Service</option>
              <option value="goods" ${queryParams.product_type === 'goods' ? 'selected' : ''}>Goods</option>
              <option value="consumable" ${queryParams.product_type === 'consumable' ? 'selected' : ''}>Consumable</option>
            </select>
            <select class="filter-select" id="filter-prod-status" onchange="Module2.filterProducts()">
              <option value="">All Status</option>
              <option value="1" ${queryParams.is_active === '1' ? 'selected' : ''}>Active</option>
              <option value="0" ${queryParams.is_active === '0' ? 'selected' : ''}>Inactive</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="Module2.filterProducts()">Apply</button>
          </div>
        </div>

        <!-- Products Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product Name & Type</th>
                <th>Sales Price</th>
                <th>Cost Price</th>
                <th>Tax Rule</th>
                <th>Variants & Brands</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${products.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">No products found matching filters.</td></tr>
              ` : products.map(p => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14.5px;">${p.name}</div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                      <span class="badge badge-neutral" style="text-transform: capitalize;">${p.product_type}</span>
                      ${p.notes ? `<span style="font-size: 12px; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.notes}</span>` : ''}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--primary-700); font-size: 15px;">
                      ${Module2.formatCurrency(p.sales_price)}
                    </div>
                    <span style="font-size: 11px; color: var(--text-muted);">Base unit</span>
                  </td>
                  <td>
                    <div style="font-weight: 500; color: var(--text-secondary);">
                      ${Module2.formatCurrency(p.cost_price)}
                    </div>
                    <span style="font-size: 11px; color: var(--success-600); font-weight: 600;">
                      ${p.sales_price > 0 ? (((p.sales_price - p.cost_price) / p.sales_price) * 100).toFixed(0) + '% margin' : ''}
                    </span>
                  </td>
                  <td>
                    ${p.tax_name ? `
                      <span class="badge badge-info" title="${p.tax_rate}%">
                        ${p.tax_name}
                      </span>
                    ` : '<span style="color: var(--text-muted); font-size: 13px;">No Tax</span>'}
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 280px;">
                        ${p.variants && p.variants.length > 0 ? p.variants.slice(0, 3).map(v => `
                          <span class="badge badge-variant" title="${v.attribute_name}: ${v.variant_name}">
                            ${v.variant_name}
                            ${v.additional_price > 0 ? `<strong>+${Module2.formatCurrency(v.additional_price)}</strong>` : ''}
                          </span>
                        `).join('') : '<span style="font-size: 12px; color: var(--text-muted);">No variants</span>'}
                        ${p.variants && p.variants.length > 3 ? `<span class="badge badge-neutral">+${p.variants.length - 3} more</span>` : ''}
                      </div>
                      <button class="btn btn-ghost btn-xs" style="align-self: flex-start; padding: 2px 6px; font-size: 11px; color: var(--primary-600);"
                              onclick="Module2.openVariantManager(${p.id})">
                        <span class="material-icons-round" style="font-size: 13px;">tune</span>
                        Manage (${p.variants ? p.variants.length : 0})
                      </button>
                    </div>
                  </td>
                  <td>
                    ${p.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-ghost btn-icon btn-sm" title="Manage Variants & Surcharges"
                              onclick="Module2.openVariantManager(${p.id})">
                        <span class="material-icons-round" style="color: var(--primary-600);">alt_route</span>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" title="Edit Product"
                              onclick="Module2.openProductModal(${p.id})">
                        <span class="material-icons-round">edit</span>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" title="Delete Product"
                              onclick="Module2.confirmDeleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                        <span class="material-icons-round" style="color: var(--danger-600);">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return Dashboards.layout('products', content);
  },

  filterProducts() {
    const search = document.getElementById('prod-search-input')?.value || '';
    const product_type = document.getElementById('filter-prod-type')?.value || '';
    const is_active = document.getElementById('filter-prod-status')?.value || '';

    Router.navigate('/dashboard/admin/products', { search, product_type, is_active });
  },

  async openProductModal(productId = null) {
    let product = null;
    let title = 'Add New Product';

    if (productId) {
      Loading.show();
      const res = await API.get(`/products/${productId}`);
      Loading.hide();
      if (!res.success) {
        Toast.error('Error', 'Failed to load product details.');
        return;
      }
      product = res.data;
      title = `Edit Product: ${product.name}`;
    }

    const taxes = window._blTaxes || [];

    const body = `
      <form id="product-form" onsubmit="event.preventDefault(); Module2.saveProduct(${productId || 'null'});">
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="prod-name">Product Name *</label>
          <input type="text" id="prod-name" class="form-input" required
                 placeholder="e.g. Cloud ERP Suite, BrightCRM Pro"
                 value="${product ? product.name : ''}">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="prod-type">Product Type *</label>
            <select id="prod-type" class="form-input">
              <option value="service" ${product && product.product_type === 'service' ? 'selected' : ''}>Service</option>
              <option value="software" ${product && product.product_type === 'software' ? 'selected' : ''}>Software</option>
              <option value="goods" ${product && product.product_type === 'goods' ? 'selected' : ''}>Goods (Physical)</option>
              <option value="consumable" ${product && product.product_type === 'consumable' ? 'selected' : ''}>Consumable</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="prod-tax">Default Tax Rule</label>
            <select id="prod-tax" class="form-input">
              <option value="">No Tax (0%)</option>
              ${taxes.map(t => `
                <option value="${t.id}" ${product && product.tax_id === t.id ? 'selected' : ''}>
                  ${t.name} (${t.rate}%)
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="prod-sales-price">Base Sales Price (₹) *</label>
            <input type="number" step="0.01" min="0" id="prod-sales-price" class="form-input" required
                   placeholder="2400.00"
                   value="${product ? product.sales_price : '0.00'}">
            <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">Base price before variant additions</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="prod-cost-price">Cost Price (₹) *</label>
            <input type="number" step="0.01" min="0" id="prod-cost-price" class="form-input" required
                   placeholder="800.00"
                   value="${product ? product.cost_price : '0.00'}">
            <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">Unit fulfillment / COGS cost</span>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="prod-notes">Notes / Description</label>
          <textarea id="prod-notes" class="form-input" rows="3"
                    placeholder="Enter internal product specifications or terms...">${product ? product.notes || '' : ''}</textarea>
        </div>

        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="prod-active" style="width: 18px; height: 18px; cursor: pointer;"
                 ${!product || product.is_active ? 'checked' : ''}>
          <label for="prod-active" style="font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-primary);">
            Active & Available for Subscriptions
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="Module2.saveProduct(${productId || 'null'})">
        ${productId ? 'Update Product' : 'Create Product'}
      </button>
    `;

    Modal.open(title, body, footer);
  },

  async saveProduct(productId) {
    const name = document.getElementById('prod-name')?.value.trim();
    const product_type = document.getElementById('prod-type')?.value;
    const tax_id = document.getElementById('prod-tax')?.value || null;
    const sales_price = parseFloat(document.getElementById('prod-sales-price')?.value);
    const cost_price = parseFloat(document.getElementById('prod-cost-price')?.value);
    const notes = document.getElementById('prod-notes')?.value.trim();
    const is_active = document.getElementById('prod-active')?.checked ? 1 : 0;

    if (!name) {
      Toast.error('Validation Error', 'Product name is required.');
      return;
    }
    if (isNaN(sales_price) || sales_price < 0) {
      Toast.error('Validation Error', 'Sales price must be non-negative.');
      return;
    }
    if (isNaN(cost_price) || cost_price < 0) {
      Toast.error('Validation Error', 'Cost price must be non-negative.');
      return;
    }

    const payload = {
      name,
      product_type,
      tax_id: tax_id ? Number(tax_id) : null,
      sales_price,
      cost_price,
      notes,
      is_active
    };

    Loading.show();
    let res;
    if (productId) {
      res = await API.put(`/products/${productId}`, payload);
    } else {
      res = await API.post('/products', payload);
    }
    Loading.hide();

    if (res.success) {
      Toast.success('Success', res.message || 'Product saved successfully.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Failed', res.message || 'Could not save product.');
    }
  },

  confirmDeleteProduct(productId, name) {
    Confirm.show(
      'Delete Product',
      `Are you sure you want to permanently delete product "<strong>${name}</strong>"? All linked variants will also be removed.`,
      async () => {
        Loading.show();
        const res = await API.delete(`/products/${productId}`);
        Loading.hide();
        if (res.success) {
          Toast.success('Deleted', res.message);
          Router.resolve();
        } else {
          Toast.error('Error', res.message || 'Failed to delete product.');
        }
      },
      'Delete Product',
      true
    );
  },

  // ─── Product Variant Sub-Management ──────────────────────────────────────────

  async openVariantManager(productId) {
    Loading.show();
    const res = await API.get(`/products/${productId}`);
    Loading.hide();

    if (!res.success) {
      Toast.error('Error', 'Failed to load product details.');
      return;
    }

    const product = res.data;
    const variants = product.variants || [];

    const body = `
      <div style="margin-bottom: 20px; padding: 14px; background: var(--primary-50); border-radius: var(--radius-md); border: 1px solid var(--primary-200);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 15px; font-weight: 700; color: var(--primary-900);">${product.name}</div>
            <div style="font-size: 12px; color: var(--primary-700);">Base Sales Price: <strong>${Module2.formatCurrency(product.sales_price)}</strong> | Base Cost: ${Module2.formatCurrency(product.cost_price)}</div>
          </div>
          <span class="badge badge-primary" style="font-size: 12px;">${variants.length} Variants</span>
        </div>
      </div>

      <!-- Add New Variant Card Form -->
      <div class="card" style="margin-bottom: 24px; border: 1px solid var(--gray-200); box-shadow: none;">
        <div class="card-header" style="padding: 12px 18px;">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <span class="material-icons-round" style="font-size: 18px; color: var(--primary-600);">add_circle</span>
            Add Product Variant / Brand
          </h4>
        </div>
        <div style="padding: 18px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px;">Attribute Type *</label>
              <input type="text" id="var-attr-name" class="form-input" style="padding: 8px 12px; font-size: 13px;"
                     placeholder="e.g. Brand, Edition, Region, Tier" value="Brand">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 12px;">Variant / Brand Name *</label>
              <input type="text" id="var-name" class="form-input" style="padding: 8px 12px; font-size: 13px;"
                     placeholder="e.g. Odoo, Salesforce, Enterprise" onkeyup="Module2.updateVariantLivePreview(${product.sales_price})">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px;">Additional Price (₹) *</label>
              <input type="number" step="0.01" min="0" id="var-add-price" class="form-input" style="padding: 8px 12px; font-size: 13px;"
                     placeholder="e.g. 560.00" value="0.00" oninput="Module2.updateVariantLivePreview(${product.sales_price})">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 12px;">Cost Extra (₹)</label>
              <input type="number" step="0.01" min="0" id="var-cost-extra" class="form-input" style="padding: 8px 12px; font-size: 13px;"
                     placeholder="0.00" value="0.00">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 12px;">SKU / Code</label>
              <input type="text" id="var-sku" class="form-input" style="padding: 8px 12px; font-size: 13px;"
                     placeholder="e.g. ERP-ODOO-560">
            </div>
          </div>

          <!-- Live Preview Box -->
          <div id="var-live-preview" style="background: var(--gray-50); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 14px; border: 1px dashed var(--gray-300);">
            💡 Live Price Calculation: Base (${Module2.formatCurrency(product.sales_price)}) + Surcharge (<span id="pv-surcharge">₹0.00</span>) = <strong id="pv-total" style="color: var(--primary-700);">${Module2.formatCurrency(product.sales_price)}</strong>
          </div>

          <button class="btn btn-primary btn-sm" onclick="Module2.createVariant(${product.id})">
            <span class="material-icons-round" style="font-size: 16px;">add</span>
            Add Variant
          </button>
        </div>
      </div>

      <!-- Current Variants Table -->
      <h4 style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0;">Existing Variants</h4>
      <div class="table-container" style="border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
        <table class="data-table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Variant / Brand</th>
              <th>Attribute</th>
              <th>Additional Surcharge</th>
              <th>Total Calculated Price</th>
              <th>SKU</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${variants.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No variants configured for this product yet.</td></tr>
            ` : variants.map(v => `
              <tr>
                <td>
                  <strong style="color: var(--text-primary);">${v.variant_name}</strong>
                </td>
                <td><span class="badge badge-neutral">${v.attribute_name}</span></td>
                <td>
                  <span style="color: var(--primary-700); font-weight: 700;">
                    +${Module2.formatCurrency(v.additional_price)}
                  </span>
                </td>
                <td>
                  <strong style="color: var(--success-700); font-size: 14px;">
                    ${Module2.formatCurrency(product.sales_price + v.additional_price)}
                  </strong>
                </td>
                <td style="font-family: monospace; font-size: 12px; color: var(--text-muted);">${v.sku || '—'}</td>
                <td>
                  <button class="btn btn-ghost btn-icon btn-xs" title="Delete Variant"
                          onclick="Module2.deleteVariant(${product.id}, ${v.id}, '${v.variant_name}')">
                    <span class="material-icons-round" style="color: var(--danger-600); font-size: 18px;">delete</span>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close(); Router.resolve();">Done</button>
    `;

    Modal.open(`Variants for ${product.name}`, body, footer);
  },

  updateVariantLivePreview(basePrice) {
    const surcharge = parseFloat(document.getElementById('var-add-price')?.value) || 0;
    const name = document.getElementById('var-name')?.value.trim() || 'Variant';
    const total = basePrice + surcharge;

    const surchEl = document.getElementById('pv-surcharge');
    const totEl = document.getElementById('pv-total');
    if (surchEl) surchEl.textContent = Module2.formatCurrency(surcharge);
    if (totEl) totEl.textContent = Module2.formatCurrency(total);
  },

  async createVariant(productId) {
    const attribute_name = document.getElementById('var-attr-name')?.value.trim() || 'Brand';
    const variant_name = document.getElementById('var-name')?.value.trim();
    const additional_price = parseFloat(document.getElementById('var-add-price')?.value) || 0;
    const cost_price_extra = parseFloat(document.getElementById('var-cost-extra')?.value) || 0;
    const sku = document.getElementById('var-sku')?.value.trim() || null;

    if (!variant_name) {
      Toast.error('Validation Error', 'Variant name is required.');
      return;
    }

    Loading.show();
    const res = await API.post(`/products/${productId}/variants`, {
      attribute_name,
      variant_name,
      additional_price,
      cost_price_extra,
      sku
    });
    Loading.hide();

    if (res.success) {
      Toast.success('Success', res.message);
      // Re-open variant manager with updated list
      Module2.openVariantManager(productId);
    } else {
      Toast.error('Error', res.message || 'Failed to add variant.');
    }
  },

  async deleteVariant(productId, variantId, name) {
    Confirm.show(
      'Delete Variant',
      `Delete variant "<strong>${name}</strong>"?`,
      async () => {
        Loading.show();
        const res = await API.delete(`/products/${productId}/variants/${variantId}`);
        Loading.hide();
        if (res.success) {
          Toast.success('Deleted', res.message);
          Module2.openVariantManager(productId);
        } else {
          Toast.error('Error', res.message || 'Failed to delete variant.');
        }
      },
      'Delete',
      true
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SUBSCRIPTION PLAN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async plansPage(queryParams = {}) {
    const params = new URLSearchParams({
      page: queryParams.page || 1,
      limit: 20,
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.billing_frequency && { billing_frequency: queryParams.billing_frequency }),
      ...(queryParams.status && { status: queryParams.status })
    });

    const [plansRes, prodRes] = await Promise.all([
      API.get(`/plans?${params}`),
      API.get('/products?limit=100')
    ]);

    const plans = plansRes.success ? plansRes.data.plans : [];
    const pagination = plansRes.success ? plansRes.data.pagination : { total: 0, page: 1, totalPages: 1 };
    const products = prodRes.success ? prodRes.data.products : [];

    window._blProducts = products;

    // Aggregate counts
    const dailyCount = plans.filter(p => p.billing_frequency === 'daily').length;
    const weeklyCount = plans.filter(p => p.billing_frequency === 'weekly').length;
    const monthlyCount = plans.filter(p => p.billing_frequency === 'monthly').length;
    const yearlyCount = plans.filter(p => p.billing_frequency === 'yearly').length;

    const content = `
      <div class="welcome-banner">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2>Subscription Plan Management</h2>
            <p>Configure recurring plans across daily, weekly, monthly, and yearly cycles with automatic expiry closure and policy controls.</p>
          </div>
          <button class="btn btn-primary" onclick="Module2.openPlanModal()">
            <span class="material-icons-round">add</span>
            Create Plan
          </button>
        </div>
      </div>

      <!-- Frequency Metrics -->
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon"><span class="material-icons-round">today</span></div>
          <div class="stat-value">${dailyCount}</div>
          <div class="stat-label">Daily Billing Plans</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon"><span class="material-icons-round">date_range</span></div>
          <div class="stat-value">${weeklyCount}</div>
          <div class="stat-label">Weekly Billing Plans</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon"><span class="material-icons-round">calendar_month</span></div>
          <div class="stat-value">${monthlyCount}</div>
          <div class="stat-label">Monthly Billing Plans</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-icon"><span class="material-icons-round">event_repeat</span></div>
          <div class="stat-value">${yearlyCount}</div>
          <div class="stat-label">Yearly Billing Plans</div>
        </div>
      </div>

      <!-- Plans Data Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All Subscription Plans (${pagination.total})</h3>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/dashboard/admin/pricing-calculator')">
            <span class="material-icons-round">calculate</span>
            Pricing Engine
          </button>
        </div>

        <!-- Filter Bar -->
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--gray-100);">
          <div class="filter-bar">
            <div class="search-bar" style="flex: 1;">
              <span class="material-icons-round">search</span>
              <input type="text" placeholder="Search plans by name, code or description..." id="plan-search-input"
                     value="${queryParams.search || ''}"
                     onkeyup="if(event.key==='Enter') Module2.filterPlans()">
            </div>
            <select class="filter-select" id="filter-plan-freq" onchange="Module2.filterPlans()">
              <option value="">All Frequencies</option>
              <option value="daily" ${queryParams.billing_frequency === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${queryParams.billing_frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="monthly" ${queryParams.billing_frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="yearly" ${queryParams.billing_frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
            </select>
            <select class="filter-select" id="filter-plan-status" onchange="Module2.filterPlans()">
              <option value="">All Status</option>
              <option value="active" ${queryParams.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${queryParams.status === 'inactive' ? 'selected' : ''}>Inactive / Paused</option>
              <option value="expired" ${queryParams.status === 'expired' ? 'selected' : ''}>Expired</option>
              <option value="archived" ${queryParams.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="Module2.filterPlans()">Filter</button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Plan Name & Code</th>
                <th>Product</th>
                <th>Frequency & Price</th>
                <th>Min Qty</th>
                <th>Validity Dates</th>
                <th>Policy Settings</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${plans.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">No subscription plans found.</td></tr>
              ` : plans.map(p => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14.5px;">${p.name}</div>
                    <div style="font-family: monospace; font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${p.code}</div>
                    ${p.description ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.description}</div>` : ''}
                  </td>
                  <td>
                    ${p.product_name ? `
                      <span style="font-weight: 500; color: var(--text-primary);">${p.product_name}</span>
                    ` : '<span style="color: var(--text-muted); font-size: 13px;">Universal</span>'}
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                      ${Module2.frequencyBadge(p.billing_frequency)}
                    </div>
                    <div style="font-weight: 700; color: var(--primary-700); font-size: 14.5px;">
                      ${Module2.formatCurrency(p.price)}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${p.min_quantity > 1 ? 'badge-warning' : 'badge-neutral'}" title="Minimum units required">
                      Min ${p.min_quantity}
                    </span>
                  </td>
                  <td>
                    <div style="font-size: 12px; color: var(--text-primary);">
                      <div>From: ${Module2.formatDate(p.start_date)}</div>
                      <div>To: ${Module2.formatDate(p.end_date)}</div>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
                      ${p.is_auto_close_on_expiry ? '<span style="color: var(--success-700); display: flex; align-items: center; gap: 3px;"><span class="material-icons-round" style="font-size: 13px;">alarm_on</span>Auto-close on expiry</span>' : '<span style="color: var(--text-muted);">Manual close</span>'}
                      ${p.allow_early_closure ? '<span style="color: var(--primary-700);">✓ Early close allowed</span>' : '<span style="color: var(--text-muted);">✗ Early close blocked</span>'}
                      ${p.allow_pause ? '<span style="color: var(--primary-700);">✓ Pause allowed</span>' : '<span style="color: var(--text-muted);">✗ Pause blocked</span>'}
                      ${p.allow_renewal ? '<span style="color: var(--primary-700);">✓ Renewal allowed</span>' : '<span style="color: var(--text-muted);">✗ Renewal blocked</span>'}
                    </div>
                  </td>
                  <td>
                    ${Module2.statusBadge(p.status)}
                  </td>
                  <td>
                    <div class="action-buttons">
                      ${p.status === 'active' && p.allow_pause ? `
                        <button class="btn btn-ghost btn-icon btn-sm" title="Pause Plan"
                                onclick="Module2.pausePlanAction(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                          <span class="material-icons-round" style="color: var(--warning-600);">pause_circle</span>
                        </button>
                      ` : ''}
                      ${p.status === 'inactive' ? `
                        <button class="btn btn-ghost btn-icon btn-sm" title="Resume Plan"
                                onclick="Module2.resumePlanAction(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                          <span class="material-icons-round" style="color: var(--success-600);">play_circle</span>
                        </button>
                      ` : ''}
                      ${p.status === 'active' && p.allow_early_closure ? `
                        <button class="btn btn-ghost btn-icon btn-sm" title="Early Close & Archive"
                                onclick="Module2.earlyCloseAction(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                          <span class="material-icons-round" style="color: var(--danger-600);">stop_circle</span>
                        </button>
                      ` : ''}
                      <button class="btn btn-ghost btn-icon btn-sm" title="Edit Plan"
                              onclick="Module2.openPlanModal(${p.id})">
                        <span class="material-icons-round">edit</span>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" title="Delete Plan"
                              onclick="Module2.confirmDeletePlan(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                        <span class="material-icons-round" style="color: var(--danger-600);">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return Dashboards.layout('plans', content);
  },

  filterPlans() {
    const search = document.getElementById('plan-search-input')?.value || '';
    const billing_frequency = document.getElementById('filter-plan-freq')?.value || '';
    const status = document.getElementById('filter-plan-status')?.value || '';

    Router.navigate('/dashboard/admin/plans', { search, billing_frequency, status });
  },

  async openPlanModal(planId = null) {
    let plan = null;
    let title = 'Create Subscription Plan';

    if (planId) {
      Loading.show();
      const res = await API.get(`/plans/${planId}`);
      Loading.hide();
      if (!res.success) {
        Toast.error('Error', 'Failed to load plan details.');
        return;
      }
      plan = res.data;
      title = `Edit Plan: ${plan.name}`;
    }

    const products = window._blProducts || [];

    const body = `
      <form id="plan-form" onsubmit="event.preventDefault(); Module2.savePlan(${planId || 'null'});">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="plan-name">Plan Name *</label>
            <input type="text" id="plan-name" class="form-input" required
                   placeholder="e.g. Monthly Enterprise, Weekly Agile Pass"
                   value="${plan ? plan.name : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="plan-code">Plan Code *</label>
            <input type="text" id="plan-code" class="form-input" style="text-transform: uppercase;"
                   placeholder="e.g. PLAN-ERP-MON"
                   value="${plan ? plan.code : ''}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="plan-product">Associated Product</label>
            <select id="plan-product" class="form-input">
              <option value="">None / Standalone Catalog Plan</option>
              ${products.map(p => `
                <option value="${p.id}" ${plan && plan.product_id === p.id ? 'selected' : ''}>
                  ${p.name} (${Module2.formatCurrency(p.sales_price)})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="plan-frequency">Billing Frequency *</label>
            <select id="plan-frequency" class="form-input" required>
              <option value="daily" ${plan && plan.billing_frequency === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${plan && plan.billing_frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="monthly" ${!plan || plan.billing_frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="yearly" ${plan && plan.billing_frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="plan-price">Recurring Price (₹) *</label>
            <input type="number" step="0.01" min="0" id="plan-price" class="form-input" required
                   placeholder="2400.00" value="${plan ? plan.price : '0.00'}">
          </div>
          <div class="form-group">
            <label class="form-label" for="plan-min-qty">Min Quantity *</label>
            <input type="number" min="1" id="plan-min-qty" class="form-input" required
                   value="${plan ? plan.min_quantity : 1}">
          </div>
          <div class="form-group">
            <label class="form-label" for="plan-trial">Trial Days</label>
            <input type="number" min="0" id="plan-trial" class="form-input"
                   value="${plan ? plan.trial_days : 0}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="plan-start">Availability Start Date</label>
            <input type="date" id="plan-start" class="form-input"
                   value="${plan && plan.start_date ? plan.start_date : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="plan-end">Availability End Date</label>
            <input type="date" id="plan-end" class="form-input"
                   value="${plan && plan.end_date ? plan.end_date : ''}">
          </div>
        </div>

        <!-- Policy Settings Group -->
        <div style="background: var(--gray-50); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px; border: 1px solid var(--gray-200);">
          <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 10px;">
            Plan Policy Rules & Lifecycle Controls
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="plan-auto-close" style="width: 16px; height: 16px;"
                     ${!plan || plan.is_auto_close_on_expiry ? 'checked' : ''}>
              <span>Auto-close when plan expires</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="plan-early-close" style="width: 16px; height: 16px;"
                     ${!plan || plan.allow_early_closure ? 'checked' : ''}>
              <span>Allow early cancellation</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="plan-pause" style="width: 16px; height: 16px;"
                     ${!plan || plan.allow_pause ? 'checked' : ''}>
              <span>Allow subscription pause</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="plan-renewal" style="width: 16px; height: 16px;"
                     ${!plan || plan.allow_renewal ? 'checked' : ''}>
              <span>Allow automatic renewal</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="plan-desc">Plan Description</label>
          <textarea id="plan-desc" class="form-input" rows="2"
                    placeholder="Enter customer-facing plan benefits...">${plan ? plan.description || '' : ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="Module2.savePlan(${planId || 'null'})">
        ${planId ? 'Update Plan' : 'Create Plan'}
      </button>
    `;

    Modal.open(title, body, footer);
  },

  async savePlan(planId) {
    const name = document.getElementById('plan-name')?.value.trim();
    const code = document.getElementById('plan-code')?.value.trim().toUpperCase();
    const product_id = document.getElementById('plan-product')?.value || null;
    const billing_frequency = document.getElementById('plan-frequency')?.value;
    const price = parseFloat(document.getElementById('plan-price')?.value);
    const min_quantity = parseInt(document.getElementById('plan-min-qty')?.value, 10);
    const trial_days = parseInt(document.getElementById('plan-trial')?.value, 10) || 0;
    const start_date = document.getElementById('plan-start')?.value || null;
    const end_date = document.getElementById('plan-end')?.value || null;
    const is_auto_close_on_expiry = document.getElementById('plan-auto-close')?.checked ? 1 : 0;
    const allow_early_closure = document.getElementById('plan-early-close')?.checked ? 1 : 0;
    const allow_pause = document.getElementById('plan-pause')?.checked ? 1 : 0;
    const allow_renewal = document.getElementById('plan-renewal')?.checked ? 1 : 0;
    const description = document.getElementById('plan-desc')?.value.trim();

    if (!name) {
      Toast.error('Validation Error', 'Plan name is required.');
      return;
    }
    if (isNaN(price) || price < 0) {
      Toast.error('Validation Error', 'Plan price must be non-negative.');
      return;
    }
    if (isNaN(min_quantity) || min_quantity < 1) {
      Toast.error('Validation Error', 'Minimum quantity must be at least 1.');
      return;
    }

    const payload = {
      name,
      code,
      product_id: product_id ? Number(product_id) : null,
      billing_frequency,
      price,
      min_quantity,
      trial_days,
      start_date,
      end_date,
      is_auto_close_on_expiry,
      allow_early_closure,
      allow_pause,
      allow_renewal,
      description
    };

    Loading.show();
    let res;
    if (planId) {
      res = await API.put(`/plans/${planId}`, payload);
    } else {
      res = await API.post('/plans', payload);
    }
    Loading.hide();

    if (res.success) {
      Toast.success('Success', res.message || 'Plan saved successfully.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Failed', res.message || 'Could not save plan.');
    }
  },

  async pausePlanAction(planId, name) {
    Confirm.show(
      'Pause Plan',
      `Are you sure you want to pause plan "<strong>${name}</strong>"? New customer signups will be suspended.`,
      async () => {
        Loading.show();
        const res = await API.post(`/plans/${planId}/pause`);
        Loading.hide();
        if (res.success) {
          Toast.success('Paused', res.message);
          Router.resolve();
        } else {
          Toast.error('Error', res.message);
        }
      },
      'Pause Plan'
    );
  },

  async resumePlanAction(planId, name) {
    Loading.show();
    const res = await API.post(`/plans/${planId}/resume`);
    Loading.hide();
    if (res.success) {
      Toast.success('Resumed', res.message);
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  async earlyCloseAction(planId, name) {
    Confirm.show(
      'Early Close & Archive Plan',
      `Perform early closure for plan "<strong>${name}</strong>"? The plan will be archived based on plan early closure settings.`,
      async () => {
        Loading.show();
        const res = await API.post(`/plans/${planId}/close`);
        Loading.hide();
        if (res.success) {
          Toast.success('Closed', res.message);
          Router.resolve();
        } else {
          Toast.error('Error', res.message);
        }
      },
      'Close Plan Early',
      true
    );
  },

  confirmDeletePlan(planId, name) {
    Confirm.show(
      'Delete Subscription Plan',
      `Are you sure you want to delete plan "<strong>${name}</strong>"?`,
      async () => {
        Loading.show();
        const res = await API.delete(`/plans/${planId}`);
        Loading.hide();
        if (res.success) {
          Toast.success('Deleted', res.message);
          Router.resolve();
        } else {
          Toast.error('Error', res.message);
        }
      },
      'Delete Plan',
      true
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TAX MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async taxesPage() {
    Loading.show();
    const res = await API.get('/taxes');
    Loading.hide();

    const taxes = res.success ? res.data : [];

    const content = `
      <div class="welcome-banner">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2>Tax Rule Management</h2>
            <p>Administer tax rates (percentage & fixed), automated assignment to products, and accurate invoice calculations.</p>
          </div>
          <button class="btn btn-primary" onclick="Module2.openTaxModal()">
            <span class="material-icons-round">add</span>
            Add Tax Rule
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Configured Tax Rules (${taxes.length})</h3>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tax Name</th>
                <th>Tax Code</th>
                <th>Rate / Value</th>
                <th>Tax Type</th>
                <th>Applied Products</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${taxes.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">No tax rules created yet.</td></tr>
              ` : taxes.map(t => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14.5px;">${t.name}</div>
                    ${t.description ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${t.description}</div>` : ''}
                  </td>
                  <td>
                    <span style="font-family: monospace; font-size: 12px; font-weight: 600; color: var(--text-primary);">${t.code}</span>
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--primary-700); font-size: 15px;">
                      ${t.tax_type === 'percentage' ? `${t.rate}%` : Module2.formatCurrency(t.rate)}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${t.tax_type === 'percentage' ? 'badge-primary' : 'badge-warning'}">
                      ${t.tax_type.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-neutral" style="font-size: 12px;">
                      ${t.applied_products_count || 0} product(s)
                    </span>
                  </td>
                  <td>
                    ${t.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-ghost btn-icon btn-sm" title="Edit Tax"
                              onclick="Module2.openTaxModal(${t.id})">
                        <span class="material-icons-round">edit</span>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" title="Delete Tax"
                              onclick="Module2.confirmDeleteTax(${t.id}, '${t.name.replace(/'/g, "\\'")}')">
                        <span class="material-icons-round" style="color: var(--danger-600);">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return Dashboards.layout('taxes', content);
  },

  async openTaxModal(taxId = null) {
    let tax = null;
    let title = 'Add Tax Rule';

    if (taxId) {
      Loading.show();
      const res = await API.get(`/taxes/${taxId}`);
      Loading.hide();
      if (!res.success) {
        Toast.error('Error', 'Failed to load tax details.');
        return;
      }
      tax = res.data;
      title = `Edit Tax Rule: ${tax.name}`;
    }

    const body = `
      <form id="tax-form" onsubmit="event.preventDefault(); Module2.saveTax(${taxId || 'null'});">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="tax-name">Tax Rule Name *</label>
            <input type="text" id="tax-name" class="form-input" required
                   placeholder="e.g. GST 18%, VAT 5%"
                   value="${tax ? tax.name : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="tax-code">Tax Code *</label>
            <input type="text" id="tax-code" class="form-input" style="text-transform: uppercase;"
                   placeholder="e.g. GST18, VAT5"
                   value="${tax ? tax.code : ''}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="tax-rate">Rate / Amount *</label>
            <input type="number" step="0.01" min="0" id="tax-rate" class="form-input" required
                   placeholder="18.00" value="${tax ? tax.rate : '18.00'}">
          </div>
          <div class="form-group">
            <label class="form-label" for="tax-type">Calculation Type *</label>
            <select id="tax-type" class="form-input" required>
              <option value="percentage" ${!tax || tax.tax_type === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
              <option value="fixed" ${tax && tax.tax_type === 'fixed' ? 'selected' : ''}>Fixed Amount (₹)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="tax-desc">Description</label>
          <textarea id="tax-desc" class="form-input" rows="2"
                    placeholder="e.g. CGST (9%) + SGST (9%) on Indian taxable goods...">${tax ? tax.description || '' : ''}</textarea>
        </div>

        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="tax-active" style="width: 18px; height: 18px; cursor: pointer;"
                 ${!tax || tax.is_active ? 'checked' : ''}>
          <label for="tax-active" style="font-size: 14px; font-weight: 500; cursor: pointer;">
            Active Tax Rule
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="Module2.saveTax(${taxId || 'null'})">
        ${taxId ? 'Update Tax Rule' : 'Save Tax Rule'}
      </button>
    `;

    Modal.open(title, body, footer);
  },

  async saveTax(taxId) {
    const name = document.getElementById('tax-name')?.value.trim();
    const code = document.getElementById('tax-code')?.value.trim().toUpperCase();
    const rate = parseFloat(document.getElementById('tax-rate')?.value);
    const tax_type = document.getElementById('tax-type')?.value;
    const description = document.getElementById('tax-desc')?.value.trim();
    const is_active = document.getElementById('tax-active')?.checked ? 1 : 0;

    if (!name) {
      Toast.error('Validation Error', 'Tax name is required.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      Toast.error('Validation Error', 'Tax rate must be non-negative.');
      return;
    }

    const payload = { name, code, rate, tax_type, description, is_active };

    Loading.show();
    let res;
    if (taxId) {
      res = await API.put(`/taxes/${taxId}`, payload);
    } else {
      res = await API.post('/taxes', payload);
    }
    Loading.hide();

    if (res.success) {
      Toast.success('Success', res.message || 'Tax rule saved.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Failed', res.message || 'Could not save tax rule.');
    }
  },

  confirmDeleteTax(taxId, name) {
    Confirm.show(
      'Delete Tax Rule',
      `Delete tax rule "<strong>${name}</strong>"? Any linked products will have tax set to none.`,
      async () => {
        Loading.show();
        const res = await API.delete(`/taxes/${taxId}`);
        Loading.hide();
        if (res.success) {
          Toast.success('Deleted', res.message);
          Router.resolve();
        } else {
          Toast.error('Error', res.message);
        }
      },
      'Delete Tax',
      true
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. DISCOUNT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async discountsPage(queryParams = {}) {
    const params = new URLSearchParams({
      page: queryParams.page || 1,
      limit: 20,
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.status && { status: queryParams.status }),
      ...(queryParams.applies_to && { applies_to: queryParams.applies_to })
    });

    const [discRes, prodRes, planRes] = await Promise.all([
      API.get(`/discounts?${params}`),
      API.get('/products?limit=100'),
      API.get('/plans?limit=100')
    ]);

    const discounts = discRes.success ? discRes.data.discounts : [];
    const pagination = discRes.success ? discRes.data.pagination : { total: 0, page: 1, totalPages: 1 };
    window._blProducts = prodRes.success ? prodRes.data.products : [];
    window._blPlans = planRes.success ? planRes.data.plans : [];

    const activeCount = discounts.filter(d => d.computed_status === 'active').length;
    const autoApplyCount = discounts.filter(d => d.is_auto_apply).length;

    const content = `
      <div class="welcome-banner">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2>Discount & Voucher Management</h2>
            <p>Administer percentage and fixed coupons, conditions (min purchase, min quantity), validity dates, auto-apply, and usage limits.</p>
          </div>
          <button class="btn btn-primary" onclick="Module2.openDiscountModal()">
            <span class="material-icons-round">add</span>
            Create Discount
          </button>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon"><span class="material-icons-round">local_offer</span></div>
          <div class="stat-value">${pagination.total}</div>
          <div class="stat-label">Total Discounts</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon"><span class="material-icons-round">verified</span></div>
          <div class="stat-value">${activeCount}</div>
          <div class="stat-label">Usable & Active</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon"><span class="material-icons-round">bolt</span></div>
          <div class="stat-value">${autoApplyCount}</div>
          <div class="stat-label">Auto-applied Discounts</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-icon"><span class="material-icons-round">rule</span></div>
          <div class="stat-value">${discounts.filter(d => d.computed_status === 'expired' || d.computed_status === 'limit_reached').length}</div>
          <div class="stat-label">Stopped / Expired</div>
        </div>
      </div>

      <!-- Main Discounts Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All Discounts (${pagination.total})</h3>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/dashboard/admin/pricing-calculator')">
            <span class="material-icons-round">calculate</span>
            Test Coupon Engine
          </button>
        </div>

        <!-- Filter Bar -->
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--gray-100);">
          <div class="filter-bar">
            <div class="search-bar" style="flex: 1;">
              <span class="material-icons-round">search</span>
              <input type="text" placeholder="Search discount name or code..." id="disc-search-input"
                     value="${queryParams.search || ''}"
                     onkeyup="if(event.key==='Enter') Module2.filterDiscounts()">
            </div>
            <select class="filter-select" id="filter-disc-status" onchange="Module2.filterDiscounts()">
              <option value="">All Statuses</option>
              <option value="active" ${queryParams.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="expired" ${queryParams.status === 'expired' ? 'selected' : ''}>Expired / Limit Reached</option>
              <option value="inactive" ${queryParams.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
            <select class="filter-select" id="filter-disc-scope" onchange="Module2.filterDiscounts()">
              <option value="">All Scopes</option>
              <option value="all" ${queryParams.applies_to === 'all' ? 'selected' : ''}>Universal (All)</option>
              <option value="product" ${queryParams.applies_to === 'product' ? 'selected' : ''}>Specific Product</option>
              <option value="plan" ${queryParams.applies_to === 'plan' ? 'selected' : ''}>Specific Plan</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="Module2.filterDiscounts()">Filter</button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Discount & Code</th>
                <th>Value & Type</th>
                <th>Target Scope</th>
                <th>Conditions</th>
                <th>Validity Period</th>
                <th>Usage Limit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${discounts.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">No discounts found matching filters.</td></tr>
              ` : discounts.map(d => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14.5px;">${d.name}</div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                      <span class="badge badge-primary" style="cursor: pointer; font-family: monospace;"
                            title="Click to copy code"
                            onclick="navigator.clipboard.writeText('${d.code}'); Toast.info('Copied', 'Code ${d.code} copied to clipboard!');">
                        <span class="material-icons-round" style="font-size: 12px; margin-right: 3px;">content_copy</span>
                        ${d.code}
                      </span>
                      ${d.is_auto_apply ? '<span class="badge badge-success" title="Automatically applied to eligible invoices">⚡ Auto-Apply</span>' : ''}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--primary-700); font-size: 16px;">
                      ${d.discount_type === 'percentage' ? `${d.value}% OFF` : `-${Module2.formatCurrency(d.value)}`}
                    </div>
                    <span style="font-size: 11px; color: var(--text-muted); text-transform: capitalize;">${d.discount_type} discount</span>
                  </td>
                  <td>
                    ${d.applies_to === 'all' ? '<span class="badge badge-neutral">Universal (Entire Sub)</span>' : ''}
                    ${d.applies_to === 'product' ? `<span class="badge badge-info" title="Target Product">Product: ${d.target_product_name || 'Specific'}</span>` : ''}
                    ${d.applies_to === 'plan' ? `<span class="badge badge-warning" title="Target Plan">Plan: ${d.target_plan_name || 'Specific'}</span>` : ''}
                  </td>
                  <td>
                    <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 2px;">
                      ${d.min_purchase_amount > 0 ? `<span>Min Purchase: <strong>${Module2.formatCurrency(d.min_purchase_amount)}</strong></span>` : '<span>Min Purchase: None</span>'}
                      ${d.min_quantity > 1 ? `<span>Min Quantity: <strong>${d.min_quantity} items</strong></span>` : '<span>Min Quantity: 1</span>'}
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 12px; color: var(--text-primary);">
                      <div>From: ${Module2.formatDate(d.start_date)}</div>
                      <div>To: ${Module2.formatDate(d.end_date)}</div>
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary);">
                      ${d.used_count} / ${d.max_usage_limit !== null ? d.max_usage_limit : '∞'} used
                    </div>
                    ${d.max_usage_limit ? `
                      <div style="background: var(--gray-200); height: 6px; border-radius: 3px; width: 80px; margin-top: 4px; overflow: hidden;">
                        <div style="background: ${d.used_count >= d.max_usage_limit ? 'var(--danger-500)' : 'var(--primary-600)'}; height: 100%; width: ${Math.min(100, (d.used_count / d.max_usage_limit) * 100)}%;"></div>
                      </div>
                    ` : ''}
                  </td>
                  <td>
                    ${Module2.statusBadge(d.computed_status)}
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-ghost btn-icon btn-sm" title="View Usage Log"
                              onclick="Module2.openDiscountUsageModal(${d.id})">
                        <span class="material-icons-round" style="color: var(--primary-600);">history</span>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" title="Edit Discount"
                              onclick="Module2.openDiscountModal(${d.id})">
                        <span class="material-icons-round">edit</span>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" title="Delete Discount"
                              onclick="Module2.confirmDeleteDiscount(${d.id}, '${d.code}')">
                        <span class="material-icons-round" style="color: var(--danger-600);">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return Dashboards.layout('discounts', content);
  },

  filterDiscounts() {
    const search = document.getElementById('disc-search-input')?.value || '';
    const status = document.getElementById('filter-disc-status')?.value || '';
    const applies_to = document.getElementById('filter-disc-scope')?.value || '';

    Router.navigate('/dashboard/admin/discounts', { search, status, applies_to });
  },

  async openDiscountModal(discountId = null) {
    let discount = null;
    let title = 'Create Discount Rule';

    if (discountId) {
      Loading.show();
      const res = await API.get(`/discounts/${discountId}`);
      Loading.hide();
      if (!res.success) {
        Toast.error('Error', 'Failed to load discount details.');
        return;
      }
      discount = res.data;
      title = `Edit Discount: ${discount.code}`;
    }

    const products = window._blProducts || [];
    const plans = window._blPlans || [];

    const body = `
      <form id="discount-form" onsubmit="event.preventDefault(); Module2.saveDiscount(${discountId || 'null'});">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="disc-name">Discount Name *</label>
            <input type="text" id="disc-name" class="form-input" required
                   placeholder="e.g. Brightloop Launch 20% Off"
                   value="${discount ? discount.name : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="disc-code">Coupon Code *</label>
            <input type="text" id="disc-code" class="form-input" style="text-transform: uppercase;" required
                   placeholder="e.g. BRIGHT20, FLAT500"
                   value="${discount ? discount.code : ''}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="disc-type">Discount Type *</label>
            <select id="disc-type" class="form-input" required>
              <option value="percentage" ${!discount || discount.discount_type === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
              <option value="fixed" ${discount && discount.discount_type === 'fixed' ? 'selected' : ''}>Fixed Amount (₹)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="disc-value">Discount Value *</label>
            <input type="number" step="0.01" min="0.01" id="disc-value" class="form-input" required
                   placeholder="20.00" value="${discount ? discount.value : '10.00'}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="disc-min-purchase">Min Purchase Amount (₹)</label>
            <input type="number" step="0.01" min="0" id="disc-min-purchase" class="form-input"
                   placeholder="0.00" value="${discount ? discount.min_purchase_amount : '0.00'}">
          </div>
          <div class="form-group">
            <label class="form-label" for="disc-min-qty">Min Quantity Required</label>
            <input type="number" min="1" id="disc-min-qty" class="form-input"
                   value="${discount ? discount.min_quantity : 1}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="disc-start">Start Date</label>
            <input type="date" id="disc-start" class="form-input"
                   value="${discount && discount.start_date ? discount.start_date : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="disc-end">End Date</label>
            <input type="date" id="disc-end" class="form-input"
                   value="${discount && discount.end_date ? discount.end_date : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="disc-max-usage">Max Usage Limit</label>
            <input type="number" min="1" id="disc-max-usage" class="form-input"
                   placeholder="Unlimited" value="${discount && discount.max_usage_limit !== null ? discount.max_usage_limit : ''}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="disc-applies-to">Applies To *</label>
            <select id="disc-applies-to" class="form-input" onchange="Module2.toggleDiscountTargets()">
              <option value="all" ${!discount || discount.applies_to === 'all' ? 'selected' : ''}>Entire Subscription (All)</option>
              <option value="product" ${discount && discount.applies_to === 'product' ? 'selected' : ''}>Specific Product</option>
              <option value="plan" ${discount && discount.applies_to === 'plan' ? 'selected' : ''}>Specific Plan</option>
            </select>
          </div>

          <div class="form-group" id="target-product-group" style="${discount && discount.applies_to === 'product' ? '' : 'display: none;'}">
            <label class="form-label" for="disc-target-product">Select Target Product</label>
            <select id="disc-target-product" class="form-input">
              <option value="">Select Product</option>
              ${products.map(p => `
                <option value="${p.id}" ${discount && discount.target_product_id === p.id ? 'selected' : ''}>${p.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" id="target-plan-group" style="${discount && discount.applies_to === 'plan' ? '' : 'display: none;'}">
            <label class="form-label" for="disc-target-plan">Select Target Plan</label>
            <select id="disc-target-plan" class="form-input">
              <option value="">Select Plan</option>
              ${plans.map(p => `
                <option value="${p.id}" ${discount && discount.target_plan_id === p.id ? 'selected' : ''}>${p.name} (${p.billing_frequency})</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 24px; margin-top: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
            <input type="checkbox" id="disc-auto-apply" style="width: 16px; height: 16px;"
                   ${discount && discount.is_auto_apply ? 'checked' : ''}>
            <span>⚡ Automatically apply to eligible invoices</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
            <input type="checkbox" id="disc-active" style="width: 16px; height: 16px;"
                   ${!discount || discount.is_active ? 'checked' : ''}>
            <span>Active Discount Rule</span>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="Module2.saveDiscount(${discountId || 'null'})">
        ${discountId ? 'Update Discount' : 'Create Discount'}
      </button>
    `;

    Modal.open(title, body, footer);
  },

  toggleDiscountTargets() {
    const scope = document.getElementById('disc-applies-to')?.value;
    const prodGroup = document.getElementById('target-product-group');
    const planGroup = document.getElementById('target-plan-group');

    if (prodGroup) prodGroup.style.display = scope === 'product' ? 'block' : 'none';
    if (planGroup) planGroup.style.display = scope === 'plan' ? 'block' : 'none';
  },

  async saveDiscount(discountId) {
    const name = document.getElementById('disc-name')?.value.trim();
    const code = document.getElementById('disc-code')?.value.trim().toUpperCase();
    const discount_type = document.getElementById('disc-type')?.value;
    const value = parseFloat(document.getElementById('disc-value')?.value);
    const min_purchase_amount = parseFloat(document.getElementById('disc-min-purchase')?.value) || 0;
    const min_quantity = parseInt(document.getElementById('disc-min-qty')?.value, 10) || 1;
    const start_date = document.getElementById('disc-start')?.value || null;
    const end_date = document.getElementById('disc-end')?.value || null;
    const max_usage_limit_raw = document.getElementById('disc-max-usage')?.value;
    const max_usage_limit = max_usage_limit_raw ? parseInt(max_usage_limit_raw, 10) : null;
    const applies_to = document.getElementById('disc-applies-to')?.value;
    const target_product_id = document.getElementById('disc-target-product')?.value || null;
    const target_plan_id = document.getElementById('disc-target-plan')?.value || null;
    const is_auto_apply = document.getElementById('disc-auto-apply')?.checked ? 1 : 0;
    const is_active = document.getElementById('disc-active')?.checked ? 1 : 0;

    if (!name) {
      Toast.error('Validation Error', 'Discount name is required.');
      return;
    }
    if (!code) {
      Toast.error('Validation Error', 'Coupon code is required.');
      return;
    }
    if (isNaN(value) || value <= 0) {
      Toast.error('Validation Error', 'Discount value must be greater than zero.');
      return;
    }
    if (discount_type === 'percentage' && value > 100) {
      Toast.error('Validation Error', 'Percentage discount cannot exceed 100%.');
      return;
    }

    const payload = {
      name,
      code,
      discount_type,
      value,
      min_purchase_amount,
      min_quantity,
      start_date,
      end_date,
      max_usage_limit,
      applies_to,
      target_product_id: applies_to === 'product' && target_product_id ? Number(target_product_id) : null,
      target_plan_id: applies_to === 'plan' && target_plan_id ? Number(target_plan_id) : null,
      is_auto_apply,
      is_active
    };

    Loading.show();
    let res;
    if (discountId) {
      res = await API.put(`/discounts/${discountId}`, payload);
    } else {
      res = await API.post('/discounts', payload);
    }
    Loading.hide();

    if (res.success) {
      Toast.success('Success', res.message || 'Discount saved.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Failed', res.message || 'Could not save discount.');
    }
  },

  async openDiscountUsageModal(discountId) {
    Loading.show();
    const res = await API.get(`/discounts/${discountId}`);
    Loading.hide();

    if (!res.success) {
      Toast.error('Error', 'Failed to load discount usage.');
      return;
    }

    const discount = res.data;
    const usages = discount.usages || [];

    const body = `
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 700; font-size: 16px; color: var(--text-primary);">${discount.name} (${discount.code})</div>
        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
          Used <strong>${discount.used_count}</strong> times of limit <strong>${discount.max_usage_limit !== null ? discount.max_usage_limit : 'Unlimited'}</strong>
        </div>
      </div>

      <div class="table-container" style="max-height: 320px; overflow-y: auto;">
        <table class="data-table" style="font-size: 12.5px;">
          <thead>
            <tr>
              <th>Applied At</th>
              <th>Customer</th>
              <th>Invoice Ref</th>
              <th>Discount Saved</th>
            </tr>
          </thead>
          <tbody>
            ${usages.length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 32px;">No recorded usages yet.</td></tr>
            ` : usages.map(u => `
              <tr>
                <td>${new Date(u.applied_at).toLocaleString()}</td>
                <td>
                  <div style="font-weight: 600;">${u.user_name || 'Customer'}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${u.user_email || '—'}</div>
                </td>
                <td style="font-family: monospace;">${u.invoice_ref || 'INV-' + u.id}</td>
                <td style="color: var(--success-700); font-weight: 700;">-${Module2.formatCurrency(u.discount_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    Modal.open(`Usage History: ${discount.code}`, body, '<button class="btn btn-secondary" onclick="Modal.close()">Close</button>');
  },

  confirmDeleteDiscount(discountId, code) {
    Confirm.show(
      'Delete Discount Rule',
      `Delete discount code "<strong>${code}</strong>"? Existing orders using it will retain historical records.`,
      async () => {
        Loading.show();
        const res = await API.delete(`/discounts/${discountId}`);
        Loading.hide();
        if (res.success) {
          Toast.success('Deleted', res.message);
          Router.resolve();
        } else {
          Toast.error('Error', res.message);
        }
      },
      'Delete Discount',
      true
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. LIVE PRICING & QUOTATION SIMULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  async pricingCalculatorPage() {
    Loading.show();
    const [prodRes, taxRes, discRes] = await Promise.all([
      API.get('/products?limit=100&is_active=1'),
      API.get('/taxes?is_active=1'),
      API.get('/discounts?status=active&limit=50')
    ]);
    Loading.hide();

    const products = prodRes.success ? prodRes.data.products : [];
    const taxes = taxRes.success ? taxRes.data : [];
    const discounts = discRes.success ? discRes.data.discounts : [];

    window._simProducts = products;
    window._simTaxes = taxes;
    window._simDiscounts = discounts;

    const content = `
      <div class="welcome-banner">
        <h2>Live Pricing & Quotation Simulator</h2>
        <p>Interactive calculation engine for Products, Brand Variants (with additional price surcharge), Recurring Plans, Tax Rules, and Discounts.</p>
      </div>

      <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 24px; align-items: start;">
        <!-- Configurator Column -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Order & Subscription Configurator</h3>
            <span class="badge badge-primary">Module 2 Pricing Engine</span>
          </div>
          <div style="padding: 24px;">
            <!-- Step 1: Select Product -->
            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="sim-product" style="font-weight: 700; display: flex; justify-content: space-between;">
                <span>1. Select Product *</span>
                <span id="sim-product-price-badge" style="color: var(--primary-600); font-size: 13px;"></span>
              </label>
              <select id="sim-product" class="form-input" onchange="Module2.onSimProductChange()">
                <option value="">-- Choose a Product --</option>
                ${products.map(p => `
                  <option value="${p.id}" data-price="${p.sales_price}" data-tax="${p.tax_id || ''}">
                    ${p.name} (Base: ${Module2.formatCurrency(p.sales_price)}) — [${p.product_type}]
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Step 2: Select Variant / Brand -->
            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="sim-variant" style="font-weight: 700; display: flex; justify-content: space-between;">
                <span>2. Select Variant / Brand Surcharge</span>
                <span id="sim-variant-badge" style="color: var(--primary-700); font-weight: 600;"></span>
              </label>
              <select id="sim-variant" class="form-input" onchange="Module2.runLiveCalculation()" disabled>
                <option value="">-- Select Product First --</option>
              </select>
              <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">
                Example: Selecting Odoo brand adds +₹560 to base sales price.
              </span>
            </div>

            <!-- Step 3: Select Subscription Plan -->
            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="sim-plan" style="font-weight: 700; display: flex; justify-content: space-between;">
                <span>3. Subscription Plan (Billing Cycle)</span>
                <span id="sim-plan-badge" style="color: var(--primary-700); font-weight: 600;"></span>
              </label>
              <select id="sim-plan" class="form-input" onchange="Module2.onSimPlanChange()" disabled>
                <option value="">-- No recurring plan (One-time item) --</option>
              </select>
              <div id="sim-plan-policy-info" style="display: none; margin-top: 6px; font-size: 11.5px; color: var(--text-secondary); background: var(--gray-100); padding: 8px 12px; border-radius: var(--radius-sm);"></div>
            </div>

            <!-- Step 4: Quantity -->
            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="sim-quantity" style="font-weight: 700;">4. Purchase Quantity</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Module2.adjustSimQty(-1)">-</button>
                <input type="number" min="1" id="sim-quantity" class="form-input" value="1" style="max-width: 100px; text-align: center; font-weight: 700;"
                       oninput="Module2.runLiveCalculation()">
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Module2.adjustSimQty(1)">+</button>
                <span id="sim-min-qty-warn" style="font-size: 12px; color: var(--warning-600); font-weight: 600; display: none;">
                  ⚠️ Minimum quantity required for this plan!
                </span>
              </div>
            </div>

            <!-- Step 5: Discount Coupon -->
            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="sim-discount-code" style="font-weight: 700;">5. Apply Discount / Coupon Code</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="sim-discount-code" class="form-input" style="text-transform: uppercase;"
                       placeholder="e.g. BRIGHT20, FLAT500">
                <button type="button" class="btn btn-secondary" onclick="Module2.runLiveCalculation()">Apply</button>
              </div>
              <!-- Quick Coupon Chips -->
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                <span style="font-size: 11px; color: var(--text-muted); align-self: center;">Available:</span>
                ${discounts.slice(0, 4).map(d => `
                  <button type="button" class="badge badge-primary" style="border: none; cursor: pointer;"
                          onclick="document.getElementById('sim-discount-code').value='${d.code}'; Module2.runLiveCalculation();">
                    ${d.code} (${d.discount_type === 'percentage' ? `${d.value}%` : `₹${d.value}`})
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Step 6: Tax Rule -->
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" for="sim-tax" style="font-weight: 700;">6. Applicable Tax Rule</label>
              <select id="sim-tax" class="form-input" onchange="Module2.runLiveCalculation()">
                <option value="">No Tax (0%)</option>
                ${taxes.map(t => `
                  <option value="${t.id}">${t.name} (${t.rate}%)</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Live Quotation Card Column -->
        <div id="sim-result-container">
          <div class="card" style="position: sticky; top: 88px; background: linear-gradient(180deg, #ffffff 0%, #fbfbfe 100%); border: 2px solid var(--primary-100);">
            <div class="card-header" style="background: var(--gradient-primary); color: #fff; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
              <div>
                <h3 class="card-title" style="color: #fff; display: flex; align-items: center; gap: 6px;">
                  <span class="material-icons-round">receipt</span>
                  Invoice Quotation
                </h3>
                <span style="font-size: 11.5px; color: rgba(255,255,255,0.85);">Real-time pricing breakdown</span>
              </div>
              <span class="badge" style="background: rgba(255,255,255,0.25); color: #fff;" id="inv-freq-badge">ONE-TIME</span>
            </div>

            <div style="padding: 24px;" id="sim-live-content">
              <div style="text-align: center; color: var(--text-muted); padding: 48px 16px;">
                <span class="material-icons-round" style="font-size: 48px; color: var(--primary-200); margin-bottom: 8px;">calculate</span>
                <p>Select a product on the left to see the instant live quotation breakdown.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return Dashboards.layout('pricing-calculator', content);
  },

  async onSimProductChange() {
    const prodSelect = document.getElementById('sim-product');
    const varSelect = document.getElementById('sim-variant');
    const planSelect = document.getElementById('sim-plan');
    const taxSelect = document.getElementById('sim-tax');

    const productId = prodSelect.value;
    if (!productId) {
      varSelect.innerHTML = '<option value="">-- Select Product First --</option>';
      varSelect.disabled = true;
      planSelect.innerHTML = '<option value="">-- No recurring plan --</option>';
      planSelect.disabled = true;
      document.getElementById('sim-live-content').innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 48px 16px;">
          <span class="material-icons-round" style="font-size: 48px; color: var(--primary-200); margin-bottom: 8px;">calculate</span>
          <p>Select a product on the left to see the instant live quotation breakdown.</p>
        </div>
      `;
      return;
    }

    Loading.show();
    const [prodDetail, planRes] = await Promise.all([
      API.get(`/products/${productId}`),
      API.get(`/plans?product_id=${productId}&status=active`)
    ]);
    Loading.hide();

    if (!prodDetail.success) {
      Toast.error('Error', 'Failed to load product details.');
      return;
    }

    const prod = prodDetail.data;
    const variants = prod.variants || [];
    const plans = planRes.success ? planRes.data.plans : [];

    // Set Default Tax
    if (prod.tax_id) {
      taxSelect.value = prod.tax_id;
    }

    // Populate Variants
    varSelect.innerHTML = `
      <option value="">Base Product Only (No Variant)</option>
      ${variants.map(v => `
        <option value="${v.id}" data-surcharge="${v.additional_price}">
          ${v.attribute_name}: ${v.variant_name} (+${Module2.formatCurrency(v.additional_price)})
        </option>
      `).join('')}
    `;
    varSelect.disabled = false;

    // Populate Plans
    planSelect.innerHTML = `
      <option value="">-- Standard Product Base Pricing --</option>
      ${plans.map(p => `
        <option value="${p.id}" data-min="${p.min_quantity}" data-freq="${p.billing_frequency}"
                data-early="${p.allow_early_closure}" data-pause="${p.allow_pause}" data-renewal="${p.allow_renewal}">
          ${p.name} (${p.billing_frequency.toUpperCase()}) — Min Qty: ${p.min_quantity}
        </option>
      `).join('')}
    `;
    planSelect.disabled = false;

    // Auto-select first variant if it's Odoo to immediately demonstrate requirement!
    const odooVar = variants.find(v => v.variant_name.toLowerCase().includes('odoo'));
    if (odooVar) {
      varSelect.value = odooVar.id;
    }

    // Auto-select first plan if available
    if (plans.length > 0) {
      planSelect.value = plans[0].id;
    }

    this.onSimPlanChange();
  },

  onSimPlanChange() {
    const planSelect = document.getElementById('sim-plan');
    const selectedOpt = planSelect.selectedOptions[0];
    const infoBox = document.getElementById('sim-plan-policy-info');
    const minQtyWarn = document.getElementById('sim-min-qty-warn');
    const qtyInput = document.getElementById('sim-quantity');

    if (selectedOpt && selectedOpt.value) {
      const minQty = parseInt(selectedOpt.dataset.min, 10) || 1;
      const freq = selectedOpt.dataset.freq;
      const early = selectedOpt.dataset.early === '1';
      const pause = selectedOpt.dataset.pause === '1';

      if (parseInt(qtyInput.value, 10) < minQty) {
        qtyInput.value = minQty;
      }

      infoBox.style.display = 'block';
      infoBox.innerHTML = `
        <strong>Plan Policy:</strong> Min Purchase ${minQty} unit(s) • ${early ? 'Early closure permitted' : 'Early closure restricted'} • ${pause ? 'Pause permitted' : 'Pause restricted'}
      `;
    } else {
      infoBox.style.display = 'none';
    }

    this.runLiveCalculation();
  },

  adjustSimQty(delta) {
    const input = document.getElementById('sim-quantity');
    const current = parseInt(input.value, 10) || 1;
    const next = Math.max(1, current + delta);
    input.value = next;
    this.runLiveCalculation();
  },

  async runLiveCalculation() {
    const prodId = document.getElementById('sim-product')?.value;
    if (!prodId) return;

    const variantId = document.getElementById('sim-variant')?.value || null;
    const planId = document.getElementById('sim-plan')?.value || null;
    const quantity = parseInt(document.getElementById('sim-quantity')?.value, 10) || 1;
    const discountCode = document.getElementById('sim-discount-code')?.value.trim() || null;
    const taxId = document.getElementById('sim-tax')?.value || null;

    try {
      const res = await API.post('/pricing/calculate', {
        product_id: Number(prodId),
        variant_id: variantId ? Number(variantId) : null,
        plan_id: planId ? Number(planId) : null,
        quantity,
        discount_code: discountCode,
        tax_id: taxId ? Number(taxId) : null
      });

      if (!res.success) {
        document.getElementById('sim-live-content').innerHTML = `
          <div style="background: var(--danger-50); border: 1px solid var(--danger-100); border-radius: var(--radius-md); padding: 16px; color: var(--danger-700);">
            <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span class="material-icons-round">error</span> Calculation Rule Rejected
            </div>
            <div style="font-size: 13px;">${res.message}</div>
          </div>
        `;
        return;
      }

      const calc = res.calculation;
      const b = calc.pricing_breakdown;
      const m = calc.financial_metrics;

      // Update badge
      const freqBadge = document.getElementById('inv-freq-badge');
      if (freqBadge) {
        freqBadge.textContent = calc.plan ? calc.plan.billing_frequency.toUpperCase() : 'ONE-TIME';
      }

      document.getElementById('sim-live-content').innerHTML = `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
            ${calc.product.name}
          </div>
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            ${calc.variant ? `
              <span class="badge badge-variant" style="font-size: 12px;">
                ${calc.variant.attribute_name}: ${calc.variant.variant_name} (+${Module2.formatCurrency(calc.variant.additional_price)})
              </span>
            ` : '<span class="badge badge-neutral">Standard Brand / Edition</span>'}
            ${calc.plan ? Module2.frequencyBadge(calc.plan.billing_frequency) : ''}
          </div>
        </div>

        <!-- Detailed Line Item Table -->
        <div style="background: var(--gray-50); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 18px; border: 1px solid var(--gray-200);">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">
            <span>Product Base Sales Price:</span>
            <span>${Module2.formatCurrency(b.base_unit_price)}</span>
          </div>
          ${b.variant_additional_price > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--primary-700); font-weight: 600; margin-bottom: 6px;">
              <span>+ Brand Variant Surcharge:</span>
              <span>+${Module2.formatCurrency(b.variant_additional_price)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 700; color: var(--text-primary); border-top: 1px solid var(--gray-200); padding-top: 6px; margin-bottom: 6px;">
            <span>Effective Unit Price:</span>
            <span>${Module2.formatCurrency(b.effective_unit_price)} / unit</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary);">
            <span>Quantity:</span>
            <span>× ${calc.quantity}</span>
          </div>
        </div>

        <!-- Invoice Breakdown List -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; color: var(--text-primary);">
            <span>Gross Subtotal:</span>
            <span style="font-weight: 600;">${Module2.formatCurrency(b.gross_subtotal)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; color: ${b.discount_applied ? 'var(--success-700)' : 'var(--text-muted)'};">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span class="material-icons-round" style="font-size: 16px;">local_offer</span>
              Discount:
              ${b.discount_details ? `<strong>[${b.discount_details.code}]</strong>` : ''}
            </span>
            <span style="font-weight: 700;">
              ${b.discount_applied ? `-${Module2.formatCurrency(b.discount_amount)}` : '₹0.00'}
            </span>
          </div>
          ${b.discount_message ? `
            <div style="font-size: 11.5px; color: ${b.discount_applied ? 'var(--success-700)' : 'var(--warning-600)'}; margin-top: -6px;">
              ${b.discount_message}
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; color: var(--text-secondary); border-top: 1px dashed var(--gray-200); padding-top: 8px;">
            <span>Taxable Net Amount:</span>
            <span>${Module2.formatCurrency(b.taxable_amount)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; color: var(--text-primary);">
            <span>Tax (${b.tax_details ? `${b.tax_details.name} - ${b.tax_details.rate}%` : 'No Tax'}):</span>
            <span style="font-weight: 600;">+${Module2.formatCurrency(b.tax_amount)}</span>
          </div>

          <!-- Total Due -->
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid var(--primary-600); padding-top: 12px; margin-top: 4px;">
            <span style="font-size: 16px; font-weight: 800; color: var(--text-primary);">Total Payable:</span>
            <span style="font-size: 24px; font-weight: 900; color: var(--primary-700);">
              ${Module2.formatCurrency(b.final_total)}
            </span>
          </div>
        </div>

        <!-- Profit & Margin Analytics (Internal) -->
        <div style="background: var(--surface-bg); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 18px; border: 1px solid var(--gray-200);">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
            Business Profitability & Margin
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div>Unit Cost: <strong>${Module2.formatCurrency(m.unit_cost)}</strong></div>
            <div>Total Cost: <strong>${Module2.formatCurrency(m.total_cost)}</strong></div>
            <div>Est. Profit: <strong style="color: var(--success-700);">${Module2.formatCurrency(m.estimated_profit)}</strong></div>
            <div>Gross Margin: <strong style="color: var(--success-700);">${m.margin_percentage}%</strong></div>
          </div>
        </div>

        <button class="btn btn-primary" style="width: 100%; justify-content: center;"
                onclick="Module2.copyQuotation(${JSON.stringify(calc).replace(/"/g, '&quot;')})">
          <span class="material-icons-round">content_copy</span>
          Copy Quotation Summary
        </button>
      `;
    } catch (err) {
      console.error(err);
    }
  },

  copyQuotation(calc) {
    const text = `
=== BRIGHTLOOP SOFTWARE QUOTATION ===
Product: ${calc.product.name}
Variant: ${calc.variant ? `${calc.variant.attribute_name} - ${calc.variant.variant_name} (+₹${calc.variant.additional_price})` : 'Standard'}
Plan: ${calc.plan ? `${calc.plan.name} (${calc.plan.billing_frequency.toUpperCase()})` : 'One-time'}
Quantity: ${calc.quantity}
Base Unit Price: ₹${calc.pricing_breakdown.base_unit_price}
Effective Unit Price: ₹${calc.pricing_breakdown.effective_unit_price}
Gross Subtotal: ₹${calc.pricing_breakdown.gross_subtotal}
Discount Applied: -₹${calc.pricing_breakdown.discount_amount} (${calc.pricing_breakdown.discount_details ? calc.pricing_breakdown.discount_details.code : 'None'})
Taxable Amount: ₹${calc.pricing_breakdown.taxable_amount}
Tax (${calc.pricing_breakdown.tax_details ? calc.pricing_breakdown.tax_details.name : '0%'}): +₹${calc.pricing_breakdown.tax_amount}
TOTAL PAYABLE: ₹${calc.pricing_breakdown.final_total}
Generated at: ${new Date().toLocaleString()}
=====================================
    `.trim();

    navigator.clipboard.writeText(text);
    Toast.success('Quotation Copied', 'Quotation summary copied to clipboard.');
  }
};
