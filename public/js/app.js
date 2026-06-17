// APP LOGIC STATE - ORBEM SOLUTIONS CARGO SYSTEMS
const state = {
  activeTab: 'dashboard',
  activeRole: 'Admin', // Default simulated role
  airports: [],
  quotations: [],
  bookings: [],
  warehouseInventory: [],
  pickups: [],
  invoices: [],
  claims: [],
  notifications: [],
  charts: {}
};

const BASE_URL = '/api';

// Dom Elements
const dom = {
  roleSelect: document.getElementById('role-select'),
  userRoleLabel: document.querySelector('.user-role-label'),
  userName: document.querySelector('.user-name'),
  menuItems: document.querySelectorAll('.menu-item'),
  tabViews: document.querySelectorAll('.tab-view'),
  sectionTitle: document.getElementById('section-title'),
  sectionSubtitle: document.getElementById('section-subtitle'),
  quickQuoteBtn: document.getElementById('quick-quote-btn'),
  
  // Modals
  quoteModal: document.getElementById('quote-modal'),
  quoteDetailsModal: document.getElementById('quote-details-modal'),
  bookingModal: document.getElementById('booking-modal'),
  invoiceModal: document.getElementById('invoice-modal'),
  
  // Close Buttons
  closeQuoteModal: document.getElementById('close-quote-modal'),
  cancelQuoteModalBtn: document.getElementById('cancel-quote-modal-btn'),
  closeDetailsModal: document.getElementById('close-details-modal'),
  closeBookingModal: document.getElementById('close-booking-modal'),
  cancelBookingModalBtn: document.getElementById('cancel-booking-modal-btn'),
  closeInvoiceModal: document.getElementById('close-invoice-modal'),
  closeInvModalBtn: document.getElementById('close-inv-modal-btn'),
  
  // Quotation Request Form & Calculator
  newQuoteForm: document.getElementById('new-quote-form'),
  quoteOrigin: document.getElementById('quote-origin'),
  quoteDest: document.getElementById('quote-dest'),
  quoteLength: document.getElementById('quote-length'),
  quoteWidth: document.getElementById('quote-width'),
  quoteHeight: document.getElementById('quote-height'),
  quoteCount: document.getElementById('quote-count'),
  quoteWeight: document.getElementById('quote-weight'),
  quoteUrgency: document.getElementById('quote-urgency'),
  quoteCargoType: document.getElementById('quote-cargo-type'),
  quoteDescInput: document.getElementById('quote-desc-input'),
  quoteDescAnalyzeBtn: document.getElementById('quote-desc-analyze-btn'),
  modalVolumetricWt: document.getElementById('modal-volumetric-wt'),
  modalChargeableWt: document.getElementById('modal-chargeable-wt'),
  modalAiBanner: document.getElementById('modal-ai-banner'),
  modalAiBannerText: document.getElementById('modal-ai-banner-text'),
  
  // Live estimator labels
  estBaseRate: document.getElementById('est-base-rate'),
  estBaseCost: document.getElementById('est-base-cost'),
  estUrgencyCost: document.getElementById('est-urgency-cost'),
  estHandlingCost: document.getElementById('est-handling-cost'),
  estTotalCost: document.getElementById('est-total-cost')
};

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupEventListeners();
  await fetchAirports();
  populateAirportSelects();
  setRole(dom.roleSelect.value);
  navigateTo('dashboard');
  
  // Auto-refresh stats/data every 10 seconds
  setInterval(() => {
    refreshData(state.activeTab, false);
  }, 10000);
}

// ----------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------
function setupEventListeners() {
  // Role Selector
  dom.roleSelect.addEventListener('change', (e) => {
    setRole(e.target.value);
  });

  // Tab switcher
  dom.menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      navigateTo(tab);
    });
  });

  // Quick action views switchers
  document.querySelectorAll('.view-all-quotes-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo('quotations'));
  });

  // Modals Open/Close triggers
  dom.quickQuoteBtn.addEventListener('click', () => openQuoteModal());
  document.getElementById('create-quote-trigger-btn').addEventListener('click', () => openQuoteModal());
  
  dom.closeQuoteModal.addEventListener('click', () => closeQuoteModal());
  dom.cancelQuoteModalBtn.addEventListener('click', () => closeQuoteModal());
  
  dom.closeDetailsModal.addEventListener('click', () => {
    dom.quoteDetailsModal.classList.remove('active');
  });

  dom.closeBookingModal.addEventListener('click', () => {
    dom.bookingModal.classList.remove('active');
  });
  dom.cancelBookingModalBtn.addEventListener('click', () => {
    dom.bookingModal.classList.remove('active');
  });

  dom.closeInvoiceModal.addEventListener('click', () => {
    dom.invoiceModal.classList.remove('active');
  });
  dom.closeInvModalBtn.addEventListener('click', () => {
    dom.invoiceModal.classList.remove('active');
  });

  // Quotation physical inputs calculations listener
  [dom.quoteLength, dom.quoteWidth, dom.quoteHeight, dom.quoteCount, dom.quoteWeight, dom.quoteUrgency, dom.quoteCargoType, dom.quoteOrigin, dom.quoteDest].forEach(input => {
    input.addEventListener('input', runLiveCalculatorEstimation);
  });

  // Cargo Description AI trigger
  dom.quoteDescAnalyzeBtn.addEventListener('click', analyzeDescriptionCargoCategory);

  // New Quote submit
  dom.newQuoteForm.addEventListener('submit', handleNewQuoteSubmit);

  // Save Booking milestone transition
  document.getElementById('update-milestone-form').addEventListener('submit', handleMilestoneUpdate);

  // Invoice wire payment transaction recorder
  document.getElementById('record-payment-form').addEventListener('submit', handlePaymentRecord);

  // Schedule pickup transaction creator
  document.getElementById('pickup-schedule-form').addEventListener('submit', handlePickupScheduleSubmit);

  // Insurance Claim transaction creator
  document.getElementById('claim-submission-form').addEventListener('submit', handleClaimSubmit);

  // Print invoice simulator
  document.getElementById('print-invoice-btn').addEventListener('click', () => {
    window.print();
  });

  // AI Suite triggers
  document.getElementById('ai-clean-btn').addEventListener('click', aiSuiteCleanDescription);
  document.getElementById('ai-route-btn').addEventListener('click', aiSuiteRouteSuggest);
  document.getElementById('ai-rate-btn').addEventListener('click', aiSuiteRateCompare);
}

// ----------------------------------------------------
// ROLE MANAGER SIMULATION
// ----------------------------------------------------
function setRole(role) {
  state.activeRole = role;
  dom.userRoleLabel.textContent = `${role} View`;
  
  const roleProfiles = {
    Customer: { name: 'Tesla Supply Chain', label: 'Cargo Exporter' },
    Admin: { name: 'Sarah Jenkins', label: 'Air Cargo Admin' },
    Operations: { name: 'Rajeev Mehta', label: 'Operations Supervisor' },
    Accounts: { name: 'Clara Oswald', label: 'Financial Comptroller' },
    Warehouse: { name: 'Marcus Brody', label: 'Warehouse Specialist' },
    Agent: { name: 'Express logistics', label: 'Partner Agent' }
  };

  const profile = roleProfiles[role] || { name: 'Guest User', label: 'Viewer' };
  dom.userName.textContent = profile.name;
  dom.userRoleLabel.textContent = profile.label;

  // React on layout options
  if (role === 'Customer') {
    dom.quickQuoteBtn.style.display = 'inline-flex';
  } else {
    dom.quickQuoteBtn.style.display = 'inline-flex'; // Available to admin too
  }

  // Refresh current view immediately with appropriate permissions
  refreshData(state.activeTab);
}

// ----------------------------------------------------
// ROUTING ENGINE (SPA NAVIGATION)
// ----------------------------------------------------
function navigateTo(tabId) {
  state.activeTab = tabId;
  
  // Set tab active styling
  dom.menuItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Display View
  dom.tabViews.forEach(view => {
    if (view.id === `view-${tabId}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Update Header Labels
  const headerLabels = {
    dashboard: { title: 'Operations Dashboard', subtitle: 'Real-time air freight insights & quotation flow control' },
    quotations: { title: 'Quotations Management', subtitle: 'Create, negotiate, review and authorize pricing slab configurations' },
    bookings: { title: 'Consignment Milestones Tracker', subtitle: 'Airway Bills flight scheduling, locations, and transition status logs' },
    warehouse: { title: 'Warehouse Storage Inventory', subtitle: 'Zone storage allocations, shelf layouts and cold-chain monitoring' },
    pickup: { title: 'Airport Pickup Scheduler', subtitle: 'Coordinate driver, vehicle, and factory ground movements' },
    billing: { title: 'Accounts & Billing Invoicing', subtitle: 'Commercial invoices, outstanding balances, and payment audits' },
    claims: { title: 'Disputes & Insurance Claims', subtitle: 'Track cargo damages, loss claims, and resolution history' },
    'ai-suite': { title: 'AI Logistics Assistants Suite', subtitle: 'Optimize descriptions, fetch routing schedules, compare airline prices' },
    notifications: { title: 'Customer Notification Channels', subtitle: 'Outgoing simulated WhatsApp, email, and SMS triggers audit logs' }
  };

  const labels = headerLabels[tabId] || { title: 'ORBEM Cargo', subtitle: 'Solutions Systems' };
  dom.sectionTitle.textContent = labels.title;
  dom.sectionSubtitle.textContent = labels.subtitle;

  // Fetch data for the active view
  refreshData(tabId);
}

async function refreshData(tabId, showSpinner = true) {
  try {
    switch (tabId) {
      case 'dashboard':
        await loadDashboardData();
        break;
      case 'quotations':
        await loadQuotationsData();
        break;
      case 'bookings':
        await loadBookingsData();
        break;
      case 'warehouse':
        await loadWarehouseData();
        break;
      case 'pickup':
        await loadPickupData();
        break;
      case 'billing':
        await loadBillingData();
        break;
      case 'claims':
        await loadClaimsData();
        break;
      case 'notifications':
        await loadNotificationsData();
        break;
    }
  } catch (err) {
    console.error('Data load error:', err);
  }
}

// ----------------------------------------------------
// DATABASE LOADERS
// ----------------------------------------------------
async function fetchAirports() {
  try {
    const res = await fetch(`${BASE_URL}/airports`);
    state.airports = await res.json();
  } catch (err) {
    console.error('Error fetching airports:', err);
  }
}

function populateAirportSelects() {
  document.querySelectorAll('.origin-airport-select, .dest-airport-select').forEach(select => {
    select.innerHTML = '';
    const isOrigin = select.classList.contains('origin-airport-select');
    
    state.airports.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.code;
      opt.textContent = `${a.city} (${a.code}) - ${a.name}`;
      
      // Default selects selections
      if (isOrigin && a.code === 'BLR') opt.selected = true;
      if (!isOrigin && a.code === 'DXB') opt.selected = true;
      
      select.appendChild(opt);
    });
  });
}

// DASHBOARD
async function loadDashboardData() {
  const res = await fetch(`${BASE_URL}/dashboard/stats`);
  const data = await res.json();

  // Populate cards
  document.getElementById('stat-total-quotes').textContent = data.summary.totalQuotes;
  document.getElementById('stat-pending-quotes').textContent = data.summary.pendingQuotes;
  document.getElementById('stat-active-bookings').textContent = data.summary.activeBookings;
  document.getElementById('stat-total-revenue').textContent = `$${data.summary.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

  // Populate activities list
  const activityBody = document.getElementById('dashboard-activity-feed');
  activityBody.innerHTML = '';
  
  if (data.recentActivity.length === 0) {
    activityBody.innerHTML = `<div class="empty-state">No recent updates logged yet.</div>`;
  } else {
    data.recentActivity.forEach(a => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      
      let icon = 'fa-circle-dot';
      if (a.entity_type === 'Quotation') icon = 'fa-file-invoice-dollar';
      else if (a.entity_type === 'Booking') icon = 'fa-truck-ramp-box';
      else if (a.entity_type === 'Invoice') icon = 'fa-credit-card';
      else if (a.entity_type === 'Claim') icon = 'fa-shield-halved';
      
      item.innerHTML = `
        <span class="timeline-time">${new Date(a.timestamp).toLocaleString()}</span>
        <span class="timeline-user"><i class="fa-solid ${icon} text-light"></i> [${a.user_role}]</span>
        <div class="timeline-desc">
          <strong>${a.action}</strong>: ${a.comments || ''}
        </div>
      `;
      activityBody.appendChild(item);
    });
  }

  // Populate priority recent quotes table
  const recentTable = document.getElementById('dashboard-recent-quotes');
  recentTable.innerHTML = '';
  
  // Show only pending admin review or sent to customer on dashboard
  const filterQuotes = data.recentActivity.filter(x => x.entity_type === 'Quotation');
  
  // We'll load the full quotations api for the table
  const qRes = await fetch(`${BASE_URL}/quotations`);
  const allQuotes = await qRes.json();
  const priorityQuotes = allQuotes.slice(0, 4);

  if (priorityQuotes.length === 0) {
    recentTable.innerHTML = `<tr><td colspan="8" class="text-center">No quotation requests.</td></tr>`;
  } else {
    priorityQuotes.forEach(q => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${q.reference_number}</strong></td>
        <td>${q.customer_name}</td>
        <td>${q.origin} <i class="fa-solid fa-arrow-right-long text-light"></i> ${q.destination}</td>
        <td><span class="badge badge-info">${q.cargo_type}</span></td>
        <td>${q.chargeable_weight} kg</td>
        <td><strong>$${q.total_cost.toFixed(2)}</strong></td>
        <td><span class="badge badge-${q.status.toLowerCase().replace(/\s+/g, '-')}">${q.status}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openQuoteDetails(${q.id})">Review</button>
        </td>
      `;
      recentTable.appendChild(tr);
    });
  }

  // Render Charts
  renderDashboardCharts(data.categoryBreakdown, data.summary);
}

function renderDashboardCharts(breakdown, summary) {
  // Destroy old charts to prevent duplicate canvases overlaps
  if (state.charts.cargo) state.charts.cargo.destroy();
  
  const ctx = document.getElementById('cargoChart').getContext('2d');
  
  const categories = breakdown.map(c => c.cargo_type);
  const counts = breakdown.map(c => c.count);

  state.charts.cargo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.length ? categories : ['General', 'Perishable', 'Hazardous', 'Valuable'],
      datasets: [{
        label: 'Quotations Created',
        data: counts.length ? counts : [0, 0, 0, 0],
        backgroundColor: [
          'rgba(79, 70, 229, 0.75)', // Indigo
          'rgba(13, 148, 136, 0.75)', // Teal
          'rgba(245, 158, 11, 0.75)', // Amber
          'rgba(139, 92, 246, 0.75)'  // Purple
        ],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { stepSize: 1 }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// QUOTATIONS
async function loadQuotationsData() {
  const res = await fetch(`${BASE_URL}/quotations`);
  state.quotations = await res.json();
  renderQuotationsTable('all');
}

function renderQuotationsTable(statusFilter) {
  const tbody = document.getElementById('quotation-list-body');
  tbody.innerHTML = '';

  let list = state.quotations;
  if (statusFilter !== 'all') {
    list = list.filter(q => q.status === statusFilter);
  }

  // Set filter tabs active state
  document.querySelectorAll('#quote-filters .filter-tab').forEach(btn => {
    if (btn.getAttribute('data-status') === statusFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No quotations found matching status [${statusFilter}].</td></tr>`;
    return;
  }

  list.forEach(q => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${q.reference_number}</strong></td>
      <td>${q.customer_name}</td>
      <td><strong>${q.origin}</strong> <i class="fa-solid fa-arrow-right-long text-light"></i> <strong>${q.destination}</strong></td>
      <td><span class="badge badge-info">${q.cargo_type}</span></td>
      <td>${q.urgency}</td>
      <td>${q.chargeable_weight} kg</td>
      <td><strong>$${q.total_cost.toFixed(2)}</strong></td>
      <td><span class="badge badge-${q.status.toLowerCase().replace(/\s+/g, '-')}">${q.status}</span></td>
      <td>${new Date(q.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openQuoteDetails(${q.id})">Open Worksheet</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Connect filter buttons dynamically
document.querySelectorAll('#quote-filters .filter-tab').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const status = e.target.getAttribute('data-status');
    renderQuotationsTable(status);
  });
});

// BOOKINGS
async function loadBookingsData() {
  const res = await fetch(`${BASE_URL}/bookings`);
  state.bookings = await res.json();
  
  const tbody = document.getElementById('booking-list-body');
  tbody.innerHTML = '';

  // Load scheduler active bookings select dropdown
  const pickupSelect = document.getElementById('pickup-booking-select');
  pickupSelect.innerHTML = '<option value="">-- Choose Active Booking --</option>';
  
  const claimSelect = document.getElementById('claim-booking-select');
  claimSelect.innerHTML = '<option value="">-- Select Booking --</option>';

  if (state.bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No active bookings found. Validate and approve quotes to generate shipments.</td></tr>`;
    return;
  }

  state.bookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.awb_number}</strong></td>
      <td><span class="text-muted">${b.reference_number}</span></td>
      <td>${b.customer_name}</td>
      <td><strong>${b.origin}</strong> <i class="fa-solid fa-plane text-light"></i> <strong>${b.destination}</strong></td>
      <td>${b.carrier} <br><small class="text-muted">${b.flight_number}</small></td>
      <td>${new Date(b.est_delivery).toLocaleDateString()}</td>
      <td><span class="badge badge-info">${b.current_location}</span></td>
      <td><span class="badge badge-success">${b.tracking_status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openBookingMilestones(${b.id})">Milestones</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Populate scheduler selects
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.awb_number} (${b.customer_name} | ${b.origin}->${b.destination})`;
    pickupSelect.appendChild(opt.cloneNode(true));
    claimSelect.appendChild(opt);
  });
}

// WAREHOUSE
async function loadWarehouseData() {
  const res = await fetch(`${BASE_URL}/warehouse`);
  state.warehouseInventory = await res.json();

  // Draw Matrix Visual Shelves Layout Map
  renderWarehouseMap();

  // Render lists table
  const tbody = document.getElementById('warehouse-inventory-body');
  tbody.innerHTML = '';

  if (state.warehouseInventory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Warehouse database is empty. Add AWB status "Received at Warehouse" to allocate.</td></tr>`;
    return;
  }

  state.warehouseInventory.forEach(w => {
    const isCustomer = state.activeRole === 'Customer';
    const actionBtn = isCustomer 
      ? `<button class="btn btn-outline btn-sm" disabled>Locked</button>` 
      : `<button class="btn btn-outline btn-sm" onclick="editWarehouseSlot(${w.id})">Move Box</button>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${w.awb_number}</strong></td>
      <td>${w.customer_name}</td>
      <td>${w.zone}</td>
      <td><strong>${w.aisle} / ${w.shelf}</strong></td>
      <td><span class="badge badge-info">${w.storage_temp}</span></td>
      <td><span class="badge badge-success">${w.dispatch_status}</span></td>
      <td>${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderWarehouseMap() {
  const zoneCold = document.getElementById('zone-cold-chain-slots');
  const zoneGen = document.getElementById('zone-general-slots');
  const zoneSecure = document.getElementById('zone-secure-slots');

  // Clear slots
  zoneCold.innerHTML = '';
  zoneGen.innerHTML = '';
  zoneSecure.innerHTML = '';

  // Generate 12 cold slots
  for (let i = 1; i <= 12; i++) {
    const slotCode = `A-${i}`;
    const cargoItem = state.warehouseInventory.find(w => w.zone.includes('Cold') && w.aisle === slotCode);
    createSlotElement(zoneCold, slotCode, cargoItem, 'perish');
  }

  // Generate 24 General slots
  for (let i = 1; i <= 24; i++) {
    const aisleNum = Math.ceil(i / 6);
    const slotCode = `A-${aisleNum}-${i}`;
    const cargoItem = state.warehouseInventory.find(w => w.zone.includes('General') && w.aisle === slotCode);
    createSlotElement(zoneGen, slotCode, cargoItem, 'general');
  }

  // Generate 12 Secure slots
  for (let i = 1; i <= 12; i++) {
    const slotCode = `C-${i}`;
    const cargoItem = state.warehouseInventory.find(w => w.zone.includes('Security') && w.aisle === slotCode);
    createSlotElement(zoneSecure, slotCode, cargoItem, 'hazard');
  }
}

function createSlotElement(container, slotCode, cargoItem, themeClass) {
  const div = document.createElement('div');
  div.className = 'shelf-slot';
  div.textContent = slotCode;
  
  if (cargoItem) {
    div.classList.add('occupied');
    div.classList.add(themeClass);
    
    // Tooltip hover details
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `
      <strong>AWB:</strong> ${cargoItem.awb_number}<br>
      <strong>Cargo:</strong> ${cargoItem.cargo_type}<br>
      <strong>Client:</strong> ${cargoItem.customer_name}
    `;
    div.appendChild(tooltip);
    
    // Double click lets admin reallocate instantly
    div.addEventListener('click', () => {
      editWarehouseSlot(cargoItem.id);
    });
  } else {
    // Empty slot indicator
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = 'Slot Available';
    div.appendChild(tooltip);
  }
  
  container.appendChild(div);
}

// PICKUPS
async function loadPickupData() {
  const res = await fetch(`${BASE_URL}/pickup`);
  state.pickups = await res.json();

  const tbody = document.getElementById('pickup-list-body');
  tbody.innerHTML = '';

  if (state.pickups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No pickup movements scheduled.</td></tr>`;
    return;
  }

  state.pickups.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.awb_number}</strong></td>
      <td>${p.customer_name}</td>
      <td><strong>${p.origin}</strong> <i class="fa-solid fa-arrow-right-long text-light"></i> <strong>${p.destination}</strong></td>
      <td>${new Date(p.schedule_date).toLocaleDateString()}</td>
      <td>${p.driver_name} <br><small class="text-muted">No. ${p.vehicle_number}</small></td>
      <td>${p.pickup_city} <br><small class="text-muted">${p.pickup_address.slice(0, 20)}...</small></td>
      <td><span class="badge badge-pending">${p.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// BILLING & ACCOUNTING
async function loadBillingData() {
  const res = await fetch(`${BASE_URL}/billing`);
  state.invoices = await res.json();

  const tbody = document.getElementById('billing-list-body');
  tbody.innerHTML = '';

  if (state.invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No commercial billing records available.</td></tr>`;
    return;
  }

  state.invoices.forEach(inv => {
    const balance = inv.total_amount - inv.amount_paid;
    let badgeClass = 'unpaid';
    if (inv.payment_status === 'Paid') badgeClass = 'approved';
    else if (inv.payment_status === 'Partially Paid') badgeClass = 'revision';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${inv.invoice_number}</strong></td>
      <td><span class="text-muted">${inv.awb_number}</span></td>
      <td>${inv.customer_name}</td>
      <td>${inv.origin} -> ${inv.destination}</td>
      <td><strong>$${inv.total_amount.toFixed(2)}</strong></td>
      <td>$${inv.amount_paid.toFixed(2)}</td>
      <td class="${balance > 0 ? 'text-danger' : 'text-green'}"><strong>$${balance.toFixed(2)}</strong></td>
      <td>${new Date(inv.due_date).toLocaleDateString()}</td>
      <td><span class="badge badge-${badgeClass}">${inv.payment_status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openInvoiceSheet(${inv.id})">Invoice Detail</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// CLAIMS
async function loadClaimsData() {
  const res = await fetch(`${BASE_URL}/claims`);
  state.claims = await res.json();

  const tbody = document.getElementById('claims-list-body');
  tbody.innerHTML = '';

  if (state.claims.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No insurance claims logged.</td></tr>`;
    return;
  }

  state.claims.forEach(c => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-pending';
    if (c.status === 'Approved') badgeClass = 'badge-success';
    else if (c.status === 'Rejected') badgeClass = 'badge-danger';

    let actionBtns = '';
    if (state.activeRole === 'Admin') {
      actionBtns = `
        <button class="btn btn-success btn-sm" onclick="adjustClaim(${c.id}, 'Approved')">Pay</button>
        <button class="btn btn-danger btn-sm" onclick="adjustClaim(${c.id}, 'Rejected')">Reject</button>
      `;
    } else {
      actionBtns = `<span class="text-muted text-xs">Locked for Admin</span>`;
    }

    tr.innerHTML = `
      <td><strong>${c.claim_reference}</strong></td>
      <td>${c.awb_number}</td>
      <td>${c.origin} -> ${c.destination}</td>
      <td>${c.claimant_name}</td>
      <td><span class="badge badge-info">${c.type}</span></td>
      <td>Cargo Value: $${c.cargo_value.toFixed(2)} <br><strong class="text-danger">Claim: $${c.claim_amount.toFixed(2)}</strong></td>
      <td><span class="badge ${badgeClass}">${c.status}</span></td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
      <td><div class="action-set">${actionBtns}</div></td>
    `;
    tbody.appendChild(tr);
  });
}

// NOTIFICATION LOGS
async function loadNotificationsData() {
  const res = await fetch(`${BASE_URL}/notifications`);
  state.notifications = await res.json();

  // Update badge count
  document.getElementById('notification-count').textContent = state.notifications.length;

  const tbody = document.getElementById('notification-logs-body');
  tbody.innerHTML = '';

  if (state.notifications.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Listening... Change quote states to see notifications triggers.</td></tr>`;
    return;
  }

  state.notifications.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><small class="text-muted">${new Date(log.timestamp).toLocaleTimeString()}</small></td>
      <td><strong>${log.type}</strong></td>
      <td><code>${log.recipient}</code></td>
      <td><span class="text-sm">${log.message}</span></td>
      <td><span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> ${log.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------
// POPUP DIALOGS CONTROL
// ----------------------------------------------------

// QUOTE REQUEST MODAL
function openQuoteModal() {
  dom.newQuoteForm.reset();
  // Clear live labels
  dom.modalVolumetricWt.textContent = '0.0';
  dom.modalChargeableWt.textContent = '0.0';
  dom.modalAiBanner.classList.add('hidden');
  
  dom.estBaseRate.textContent = '$0.00/kg';
  dom.estBaseCost.textContent = '$0.00';
  dom.estUrgencyCost.textContent = '$0.00';
  dom.estHandlingCost.textContent = '$0.00';
  dom.estTotalCost.textContent = '$0.00';

  dom.quoteModal.classList.add('active');
  runLiveCalculatorEstimation();
}

function closeQuoteModal() {
  dom.quoteModal.classList.remove('active');
}

// Live math updates instantly on typing dimension metrics
async function runLiveCalculatorEstimation() {
  const l = parseFloat(dom.quoteLength.value) || 0;
  const w = parseFloat(dom.quoteWidth.value) || 0;
  const h = parseFloat(dom.quoteHeight.value) || 0;
  const count = parseInt(dom.quoteCount.value) || 0;
  const weight = parseFloat(dom.quoteWeight.value) || 0;
  const urgency = dom.quoteUrgency.value;
  const cargoType = dom.quoteCargoType.value;
  const origin = dom.quoteOrigin.value;
  const dest = dom.quoteDest.value;

  if (l && w && h && count && weight && origin && dest) {
    // Standard IATA conversion divider (5000 cm^3 per kg)
    const volumetric = parseFloat(((l * w * h * count) / 5000).toFixed(2));
    const chargeable = Math.max(weight, volumetric);

    dom.modalVolumetricWt.textContent = volumetric.toFixed(2);
    dom.modalChargeableWt.textContent = chargeable.toFixed(2);

    // Call estimation API
    try {
      const res = await fetch(`${BASE_URL}/quotations/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin, destination: dest, length: l, width: w, height: h, package_count: count, actual_weight: weight, urgency, cargo_type: cargoType
        })
      });
      const est = await res.json();
      
      if (!est.error) {
        dom.estBaseRate.textContent = `$${est.base_rate_per_kg.toFixed(2)}/kg`;
        dom.estBaseCost.textContent = `$${est.base_cost.toFixed(2)}`;
        dom.estUrgencyCost.textContent = `$${est.urgency_surcharge.toFixed(2)}`;
        dom.estHandlingCost.textContent = `$${est.handling_fee.toFixed(2)}`;
        dom.estTotalCost.textContent = `$${est.total_cost.toFixed(2)}`;
      }
    } catch (e) {
      console.error(e);
    }
  }
}

// AI Description category classifier
async function analyzeDescriptionCargoCategory() {
  const descText = dom.quoteDescInput.value;
  if (!descText) {
    alert("Please write a cargo description first (e.g. 'lithium laptop battery' or 'fruits')");
    return;
  }

  dom.quoteDescAnalyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';

  try {
    const res = await fetch(`${BASE_URL}/ai/clean-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: descText })
    });
    const result = await res.json();

    if (!result.error) {
      // Auto select suggested cargo category
      dom.quoteCargoType.value = result.cargoCategorySuggestion;
      
      // Auto clean text input
      dom.quoteDescInput.value = result.cleanedDescription;

      // Show alert banner inside modal
      dom.modalAiBanner.classList.remove('hidden');
      dom.modalAiBannerText.innerHTML = `<strong>AI Cleaner Optimization:</strong> Category suggest: <u>${result.cargoCategorySuggestion}</u>.<br>${result.aiRecommendation}`;
      
      // Run math updates
      runLiveCalculatorEstimation();
    }
  } catch (err) {
    console.error(err);
  } finally {
    dom.quoteDescAnalyzeBtn.innerHTML = '<i class="fa-solid fa-brain"></i> Analyze Category';
  }
}

// Submit Quote Request
async function handleNewQuoteSubmit(e) {
  e.preventDefault();

  const payload = {
    customer_name: document.getElementById('quote-customer').value,
    origin: dom.quoteOrigin.value,
    destination: dom.quoteDest.value,
    cargo_type: dom.quoteCargoType.value,
    urgency: dom.quoteUrgency.value,
    package_count: parseInt(dom.quoteCount.value),
    actual_weight: parseFloat(dom.quoteWeight.value),
    length: parseFloat(dom.quoteLength.value),
    width: parseFloat(dom.quoteWidth.value),
    height: parseFloat(dom.quoteHeight.value),
    volumetric_weight: parseFloat(dom.modalVolumetricWt.textContent),
    chargeable_weight: parseFloat(dom.modalChargeableWt.textContent),
    base_rate_per_kg: parseFloat(dom.estBaseRate.textContent.replace('$', '').replace('/kg', '')),
    base_cost: parseFloat(dom.estBaseCost.textContent.replace('$', '')),
    urgency_surcharge: parseFloat(dom.estUrgencyCost.textContent.replace('$', '')),
    handling_fee: parseFloat(dom.estHandlingCost.textContent.replace('$', '')),
    total_cost: parseFloat(dom.estTotalCost.textContent.replace('$', '')),
    status: state.activeRole === 'Customer' ? 'Pending Admin Review' : 'Draft',
    owner: state.activeRole === 'Admin' ? 'Admin Staff' : 'Pending Assignment'
  };

  try {
    const res = await fetch(`${BASE_URL}/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      closeQuoteModal();
      navigateTo('quotations');
    }
  } catch (err) {
    console.error('Error submitting quote:', err);
  }
}

// QUOTATION REVIEW DETAIL & WORKFLOW SHEET
let currentQuoteId = null;
async function openQuoteDetails(id) {
  currentQuoteId = id;
  const res = await fetch(`${BASE_URL}/quotations/${id}`);
  const data = await res.json();

  const q = data.quote;
  const history = data.history;

  // Labels fill
  document.getElementById('details-ref-num').textContent = q.reference_number;
  document.getElementById('details-customer-name').textContent = q.customer_name;
  document.getElementById('details-origin').textContent = q.origin;
  document.getElementById('details-destination').textContent = q.destination;
  document.getElementById('details-cargo-type').textContent = q.cargo_type;
  document.getElementById('details-urgency').textContent = q.urgency;
  document.getElementById('details-pkg-count').textContent = q.package_count;
  document.getElementById('details-dim').textContent = `${q.length}x${q.width}x${q.height}`;
  document.getElementById('details-act-wt').textContent = q.actual_weight;
  document.getElementById('details-vol-wt').textContent = q.volumetric_weight;
  document.getElementById('details-chg-wt').textContent = q.chargeable_weight;

  // Admin adjustments prepopulate inputs
  document.getElementById('edit-base-rate').value = q.base_rate_per_kg;
  document.getElementById('edit-handling-fee').value = q.handling_fee;
  document.getElementById('edit-urgency-surcharge').value = q.urgency_surcharge;
  document.getElementById('edit-total-cost').textContent = q.total_cost.toFixed(2);

  // Setup adjust listeners
  ['edit-base-rate', 'edit-handling-fee', 'edit-urgency-surcharge'].forEach(id => {
    document.getElementById(id).oninput = () => {
      const br = parseFloat(document.getElementById('edit-base-rate').value) || 0;
      const hf = parseFloat(document.getElementById('edit-handling-fee').value) || 0;
      const us = parseFloat(document.getElementById('edit-urgency-surcharge').value) || 0;
      const chgWt = q.chargeable_weight;
      const baseCost = chgWt * br;
      const finalCost = baseCost + hf + us;
      document.getElementById('edit-total-cost').textContent = finalCost.toFixed(2);
    };
  });

  // Rejection feedback box handler
  const feedbackViewer = document.getElementById('quote-feedback-viewer');
  if (q.customer_feedback) {
    feedbackViewer.classList.remove('hidden');
    document.getElementById('details-feedback-text').textContent = q.customer_feedback;
  } else {
    feedbackViewer.classList.add('hidden');
  }

  // Audit timeline loader
  const timeline = document.getElementById('details-timeline-feed');
  timeline.innerHTML = '';
  history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <span class="timeline-time">${new Date(h.timestamp).toLocaleString()}</span>
      <span class="timeline-user">[${h.user_role}]</span>
      <div class="timeline-desc"><strong>${h.action}</strong>: ${h.comments || ''}</div>
    `;
    timeline.appendChild(item);
  });

  // Export button
  document.getElementById('btn-export-quote').onclick = () => {
    window.location.href = `${BASE_URL}/quotations/${q.id}/export`;
  };

  // Display control actions depending on status and Active Role
  setupWorkflowActions(q);

  dom.quoteDetailsModal.classList.add('active');
}

function setupWorkflowActions(q) {
  const adminSet = document.getElementById('admin-actions');
  const customerSet = document.getElementById('customer-actions');
  const feedbackInputBox = document.getElementById('customer-feedback-input-box');
  const adminPriceEditor = document.getElementById('admin-price-editor');

  adminSet.classList.add('hidden');
  customerSet.classList.add('hidden');
  feedbackInputBox.classList.add('hidden');
  adminPriceEditor.classList.add('hidden');

  const isOpsOrAdmin = state.activeRole === 'Admin' || state.activeRole === 'Operations';
  const isCustomer = state.activeRole === 'Customer';

  if (isOpsOrAdmin) {
    adminPriceEditor.classList.remove('hidden');
    // Admin can edit price and click buttons only if not yet approved
    if (q.status === 'Pending Admin Review' || q.status === 'Revision Requested' || q.status === 'Draft') {
      adminSet.classList.remove('hidden');
      
      // Update buttons
      document.getElementById('btn-quote-send-exporter').onclick = () => updateQuoteState(q.id, 'Sent to Customer');
      document.getElementById('btn-quote-revise-admin').onclick = () => updateQuoteState(q.id, 'Pending Admin Review', 'Internal revision update applied.');
    }
  }

  if (isCustomer) {
    if (q.status === 'Sent to Customer') {
      customerSet.classList.remove('hidden');
      feedbackInputBox.classList.remove('hidden');

      // Bind Customer Accept / Reject / Negotiate triggers
      document.getElementById('btn-quote-approve').onclick = () => updateQuoteState(q.id, 'Approved');
      document.getElementById('btn-quote-reject').onclick = () => {
        const comment = document.getElementById('customer-feedback-comments').value;
        if (!comment) return alert("Please specify rejection details in comments.");
        updateQuoteState(q.id, 'Rejected', comment);
      };
      document.getElementById('btn-quote-request-rev').onclick = () => {
        const comment = document.getElementById('customer-feedback-comments').value;
        if (!comment) return alert("Please specify required revision price or requirements.");
        updateQuoteState(q.id, 'Revision Requested', comment);
      };
    }
  }
}

async function updateQuoteState(id, status, comment = '') {
  const payload = {
    status,
    comments: comment,
    user_role: state.activeRole
  };

  // If Admin is submitting, include price worksheet adjustments
  const isOpsOrAdmin = state.activeRole === 'Admin' || state.activeRole === 'Operations';
  if (isOpsOrAdmin) {
    payload.base_rate_per_kg = parseFloat(document.getElementById('edit-base-rate').value);
    payload.handling_fee = parseFloat(document.getElementById('edit-handling-fee').value);
    payload.urgency_surcharge = parseFloat(document.getElementById('edit-urgency-surcharge').value);
    payload.total_cost = parseFloat(document.getElementById('edit-total-cost').textContent);
  }

  const res = await fetch(`${BASE_URL}/quotations/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    dom.quoteDetailsModal.classList.remove('active');
    refreshData(state.activeTab);
  }
}

// TRACKING MILESTONES TRANSITION POPUP
async function openBookingMilestones(id) {
  const res = await fetch(`${BASE_URL}/bookings`);
  const list = await res.json();
  const b = list.find(x => x.id === id);

  document.getElementById('booking-awb-num').textContent = b.awb_number;
  document.getElementById('booking-db-id').value = b.id;
  
  // Pop inputs
  document.getElementById('tracking-status-select').value = b.tracking_status;
  document.getElementById('tracking-location').value = b.current_location;
  document.getElementById('tracking-carrier').value = b.carrier;
  document.getElementById('tracking-flight').value = b.flight_number;
  document.getElementById('tracking-comment').value = '';

  // Draw timeline steps states active class
  const steps = document.querySelectorAll('.milestone-visual-stepper .step');
  const allStages = ['Booked', 'Received at Warehouse', 'Customs Cleared', 'Departed', 'Arrived', 'Out for Delivery', 'Delivered'];
  const currentIndex = allStages.indexOf(b.tracking_status);

  steps.forEach(el => {
    const stepName = el.getAttribute('data-step');
    const stepIndex = allStages.indexOf(stepName);
    
    el.classList.remove('active', 'completed');
    if (stepIndex < currentIndex) {
      el.classList.add('completed');
    } else if (stepIndex === currentIndex) {
      el.classList.add('active');
    }
  });

  // Enable fields only for Operations / Admin
  const isOpsOrAdmin = state.activeRole === 'Admin' || state.activeRole === 'Operations';
  const saveBtn = document.getElementById('save-milestone-btn');
  document.querySelectorAll('#update-milestone-form input, #update-milestone-form select').forEach(el => {
    el.disabled = !isOpsOrAdmin;
  });
  saveBtn.style.display = isOpsOrAdmin ? 'block' : 'none';

  dom.bookingModal.classList.add('active');
}

async function handleMilestoneUpdate(e) {
  e.preventDefault();
  
  const id = document.getElementById('booking-db-id').value;
  const payload = {
    tracking_status: document.getElementById('tracking-status-select').value,
    current_location: document.getElementById('tracking-location').value,
    carrier: document.getElementById('tracking-carrier').value,
    flight_number: document.getElementById('tracking-flight').value,
    comment: document.getElementById('tracking-comment').value,
    user_role: state.activeRole
  };

  const res = await fetch(`${BASE_URL}/bookings/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    dom.bookingModal.classList.remove('active');
    refreshData(state.activeTab);
  }
}

// WAREHOUSE LAYOUT BINS MOVEMENT
async function editWarehouseSlot(id) {
  const item = state.warehouseInventory.find(x => x.id === id);
  if (!item) return;

  const newZone = prompt("Reallocate Zone (Ambient / Cold Chain / Secure):", item.zone);
  if (newZone === null) return;
  const newAisle = prompt("Reallocate Aisle (A-1 to A-5):", item.aisle);
  if (newAisle === null) return;
  const newShelf = prompt("Reallocate Shelf (Shelf-01 to Shelf-09):", item.shelf);
  if (newShelf === null) return;

  const res = await fetch(`${BASE_URL}/warehouse/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zone: newZone,
      aisle: newAisle,
      shelf: newShelf,
      storage_temp: item.storage_temp,
      dispatch_status: item.dispatch_status,
      user_role: state.activeRole
    })
  });

  if (res.ok) {
    refreshData('warehouse');
  }
}

// INVOICE POPUP SHEET
async function openInvoiceSheet(id) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;

  // Header meta
  document.getElementById('inv-bill-num').textContent = inv.invoice_number;
  document.getElementById('inv-bill-date').textContent = new Date(inv.created_at).toLocaleDateString();
  document.getElementById('inv-bill-client').textContent = inv.customer_name;
  document.getElementById('inv-bill-awb').textContent = inv.awb_number;
  document.getElementById('inv-bill-route').textContent = `${inv.origin} -> ${inv.destination}`;
  document.getElementById('inv-bill-due').textContent = new Date(inv.due_date).toLocaleDateString();

  // Find quotation to get rates splitting breakdown
  const q = state.quotations.find(x => x.reference_number === inv.reference_number) || {
    chargeable_weight: 100, base_rate_per_kg: 5.0, base_cost: 500, urgency_surcharge: 0, handling_fee: 100, urgency: 'Standard'
  };

  document.getElementById('inv-bill-urgency').textContent = q.urgency;
  document.getElementById('inv-item-weight').textContent = q.chargeable_weight;
  document.getElementById('inv-item-rate').textContent = q.base_rate_per_kg.toFixed(2);
  document.getElementById('inv-item-base-cost').textContent = q.base_cost.toFixed(2);
  document.getElementById('inv-item-urgency-surcharge').textContent = q.urgency_surcharge.toFixed(2);
  document.getElementById('inv-item-handling').textContent = q.handling_fee.toFixed(2);

  const total = inv.total_amount;
  const paid = inv.amount_paid;
  const balance = total - paid;

  document.getElementById('inv-total-sum').textContent = total.toFixed(2);
  document.getElementById('inv-paid-sum').textContent = paid.toFixed(2);
  document.getElementById('inv-balance-sum').textContent = balance.toFixed(2);

  // Payments input display
  document.getElementById('payment-invoice-id').value = inv.id;
  document.getElementById('pay-amount').value = balance.toFixed(2);
  
  const paymentBox = document.getElementById('accounts-payment-box');
  const isAccountsOrAdmin = state.activeRole === 'Accounts' || state.activeRole === 'Admin';
  
  if (isAccountsOrAdmin && balance > 0) {
    paymentBox.classList.remove('hidden');
  } else {
    paymentBox.classList.add('hidden');
  }

  dom.invoiceModal.classList.add('active');
}

async function handlePaymentRecord(e) {
  e.preventDefault();

  const id = document.getElementById('payment-invoice-id').value;
  const payload = {
    amount: parseFloat(document.getElementById('pay-amount').value),
    payment_reference: document.getElementById('pay-ref').value,
    user_role: state.activeRole
  };

  const res = await fetch(`${BASE_URL}/billing/${id}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    dom.invoiceModal.classList.remove('active');
    refreshData(state.activeTab);
  }
}

// PICKUP SCHEDULER
async function handlePickupScheduleSubmit(e) {
  e.preventDefault();

  const payload = {
    booking_id: parseInt(document.getElementById('pickup-booking-select').value),
    pickup_city: document.getElementById('pickup-city').value,
    pickup_address: document.getElementById('pickup-address').value,
    schedule_date: document.getElementById('pickup-date').value,
    driver_name: document.getElementById('pickup-driver').value,
    driver_phone: document.getElementById('pickup-phone').value,
    vehicle_number: document.getElementById('pickup-vehicle').value,
    user_role: state.activeRole
  };

  const res = await fetch(`${BASE_URL}/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    document.getElementById('pickup-schedule-form').reset();
    refreshData('pickup');
  }
}

// INSURANCE CLAIMS SUBMIT
async function handleClaimSubmit(e) {
  e.preventDefault();

  const payload = {
    booking_id: parseInt(document.getElementById('claim-booking-select').value),
    claimant_name: document.getElementById('claim-claimant').value,
    type: document.getElementById('claim-type').value,
    cargo_value: parseFloat(document.getElementById('claim-cargo-val').value),
    claim_amount: parseFloat(document.getElementById('claim-amount').value),
    description: document.getElementById('claim-desc').value,
    user_role: state.activeRole
  };

  const res = await fetch(`${BASE_URL}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    document.getElementById('claim-submission-form').reset();
    refreshData('claims');
  }
}

async function adjustClaim(id, status) {
  const comment = prompt(`Provide justification for claim ${status}:`);
  if (comment === null) return;

  const res = await fetch(`${BASE_URL}/claims/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      comments: comment,
      user_role: state.activeRole
    })
  });

  if (res.ok) {
    refreshData('claims');
  }
}

// ----------------------------------------------------
// AI LOGISTICS SUITE ACTIONS
// ----------------------------------------------------

// AI 1: Cargo Description Cleaner
async function aiSuiteCleanDescription() {
  const desc = document.getElementById('ai-raw-desc').value;
  if (!desc) return alert("Write raw description first.");

  const btn = document.getElementById('ai-clean-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

  const res = await fetch(`${BASE_URL}/ai/clean-description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: desc })
  });
  const data = await res.json();

  btn.innerHTML = 'Optimize Cargo Info';
  document.getElementById('ai-clean-results').classList.remove('hidden');
  document.getElementById('ai-res-clean-desc').textContent = data.cleanedDescription;
  document.getElementById('ai-res-slab-cat').textContent = data.cargoCategorySuggestion;
  document.getElementById('ai-res-hazard').textContent = data.hazardFlag ? "HAZARDOUS DGR" : "NO HAZARD";
  document.getElementById('ai-res-advice').textContent = data.aiRecommendation;
}

// AI 2: Route Suggester
async function aiSuiteRouteSuggest() {
  const origin = document.getElementById('ai-route-origin').value;
  const dest = document.getElementById('ai-route-dest').value;
  const type = document.getElementById('ai-route-cargo-type').value;

  const btn = document.getElementById('ai-route-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Suggesting...';

  const res = await fetch(`${BASE_URL}/ai/route-suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination: dest, cargo_type: type })
  });
  const data = await res.json();

  btn.innerHTML = 'Fetch Routing Matrix';
  document.getElementById('ai-route-results').classList.remove('hidden');

  // List suggested routes
  const ul = document.getElementById('ai-res-routes');
  ul.innerHTML = '';
  data.suggestedRoutes.forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>${r.route}</strong> via ${r.carrier}</span>
      <span class="badge badge-info">${r.duration} [${r.type}]</span>
    `;
    ul.appendChild(li);
  });

  // Customs checklists
  const check = document.getElementById('ai-res-checklist');
  check.innerHTML = '';
  data.customsChecklist.forEach(doc => {
    const div = document.createElement('div');
    div.className = 'checklist-grid-item';
    div.innerHTML = `<i class="fa-solid fa-square-check text-green"></i> <span>${doc}</span>`;
    check.appendChild(div);
  });
}

// AI 3: Airline Rates comparator
async function aiSuiteRateCompare() {
  const origin = document.getElementById('ai-rate-origin').value;
  const dest = document.getElementById('ai-rate-dest').value;
  const wt = document.getElementById('ai-rate-wt').value;

  const btn = document.getElementById('ai-rate-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comparing...';

  const res = await fetch(`${BASE_URL}/ai/rate-compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination: dest, weight: wt })
  });
  const data = await res.json();

  btn.innerHTML = 'Compare Market Rates';
  document.getElementById('ai-rate-results').classList.remove('hidden');

  const tbody = document.getElementById('ai-res-rates-tbody');
  tbody.innerHTML = '';
  data.comparisons.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.airline}</strong></td>
      <td>$${c.rate_per_kg.toFixed(2)}/kg</td>
      <td><strong>$${c.total_cost.toFixed(2)}</strong></td>
      <td>${c.speed}</td>
      <td><span class="text-warning">${c.rating}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
