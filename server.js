const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');

const app = express();
const PORT = parseInt(process.env.PORT || 5000, 10);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public'));

// Helper: Generate Sequential Reference Numbers
function generateRef(prefix) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
}

// ----------------------------------------------------
// DB PROMISES HELPERS (to avoid callback hell)
// ----------------------------------------------------
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// ----------------------------------------------------
// CORE ROUTE: Airports list
// ----------------------------------------------------
app.get('/api/airports', async (req, res) => {
  try {
    const airports = await dbAll("SELECT * FROM airports ORDER BY city ASC");
    res.json(airports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DASHBOARD: Stats Overview
// ----------------------------------------------------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const quotes = await dbAll("SELECT status, total_cost FROM quotations");
    const bookings = await dbAll("SELECT tracking_status FROM bookings");
    const invoices = await dbAll("SELECT total_amount, amount_paid FROM invoices");
    const claims = await dbAll("SELECT status FROM claims");

    // Summarize
    let totalQuotes = quotes.length;
    let pendingQuotes = quotes.filter(q => q.status === 'Pending Admin Review').length;
    let approvedQuotes = quotes.filter(q => q.status === 'Approved').length;
    let activeBookings = bookings.filter(b => b.tracking_status !== 'Delivered').length;
    
    let totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
    let pendingReceivables = invoices.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);
    let activeClaims = claims.filter(c => c.status !== 'Resolved' && c.status !== 'Rejected').length;

    // Cargo categories breakdown
    const categoryQuery = await dbAll("SELECT cargo_type, COUNT(*) as count FROM quotations GROUP BY cargo_type");
    
    // Recent activity log
    const recentActivity = await dbAll("SELECT * FROM action_history ORDER BY id DESC LIMIT 8");

    res.json({
      summary: {
        totalQuotes,
        pendingQuotes,
        approvedQuotes,
        activeBookings,
        totalRevenue,
        pendingReceivables,
        activeClaims
      },
      categoryBreakdown: categoryQuery,
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// QUOTATIONS API
// ----------------------------------------------------

// Calculate Chargeable Weight & Rates dynamically
app.post('/api/quotations/calculate', async (req, res) => {
  const { origin, destination, length, width, height, package_count, actual_weight, urgency, cargo_type } = req.body;
  
  if (!origin || !destination || !length || !width || !height || !package_count || !actual_weight) {
    return res.status(400).json({ error: "Missing required fields for calculation" });
  }

  try {
    // Volumetric Weight Calculation (Standard Air Freight factor is 5000 cm^3/kg)
    const volumetric_weight = parseFloat(((length * width * height * package_count) / 5000).toFixed(2));
    const chargeable_weight = Math.max(actual_weight, volumetric_weight);

    // Fetch slab rates from database for specific route
    let rateRow = await dbGet("SELECT * FROM route_rates WHERE origin = ? AND destination = ?", [origin, destination]);
    
    // Fallback if no specific route rate is defined
    if (!rateRow) {
      rateRow = {
        rate_under_45: 8.00,
        rate_45_to_100: 7.50,
        rate_100_to_300: 6.80,
        rate_300_to_500: 6.00,
        rate_over_500: 5.20,
        transit_days: 4
      };
    }

    // Determine Base Rate based on weight slab
    let base_rate = rateRow.rate_under_45;
    if (chargeable_weight >= 45 && chargeable_weight < 100) base_rate = rateRow.rate_45_to_100;
    else if (chargeable_weight >= 100 && chargeable_weight < 300) base_rate = rateRow.rate_100_to_300;
    else if (chargeable_weight >= 300 && chargeable_weight < 500) base_rate = rateRow.rate_300_to_500;
    else if (chargeable_weight >= 500) base_rate = rateRow.rate_over_500;

    const base_cost = parseFloat((chargeable_weight * base_rate).toFixed(2));

    // Urgency Surcharge
    let urgency_factor = 0;
    if (urgency === 'Express') urgency_factor = 0.20; // +20%
    else if (urgency === 'Critical') urgency_factor = 0.50; // +50%
    const urgency_surcharge = parseFloat((base_cost * urgency_factor).toFixed(2));

    // Handling Fees based on cargo category
    let handling_fee = 100.00; // General default
    if (cargo_type === 'Perishable') handling_fee = 180.00;
    else if (cargo_type === 'Hazardous') handling_fee = 350.00;
    else if (cargo_type === 'Valuable') handling_fee = 500.00;
    else if (cargo_type === 'Express') handling_fee = 150.00;

    const total_cost = parseFloat((base_cost + urgency_surcharge + handling_fee).toFixed(2));

    res.json({
      volumetric_weight,
      chargeable_weight,
      base_rate_per_kg: base_rate,
      base_cost,
      urgency_surcharge,
      handling_fee,
      total_cost,
      transit_days: rateRow.transit_days
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Quotation
app.post('/api/quotations', async (req, res) => {
  const {
    customer_name, origin, destination, cargo_type, urgency,
    package_count, actual_weight, length, width, height,
    volumetric_weight, chargeable_weight, base_rate_per_kg,
    base_cost, urgency_surcharge, handling_fee, total_cost,
    status, owner
  } = req.body;

  const refNum = generateRef('QT');
  const now = new Date().toISOString();
  const finalStatus = status || 'Pending Admin Review';
  const finalOwner = owner || 'Pending Assignment';

  try {
    const query = `
      INSERT INTO quotations (
        reference_number, customer_name, origin, destination, cargo_type, urgency,
        package_count, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
        base_rate_per_kg, base_cost, urgency_surcharge, handling_fee, total_cost, status, owner, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await dbRun(query, [
      refNum, customer_name, origin, destination, cargo_type, urgency,
      package_count, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
      base_rate_per_kg, base_cost, urgency_surcharge, handling_fee, total_cost, finalStatus, finalOwner, now, now
    ]);

    // Insert history
    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Quotation', ?, 'Create Quote Request', 'Customer', ?, 'Created reference ' || ?)
    `, [result.id, now, refNum]);

    // Log notification
    await dbRun(`
      INSERT INTO notifications_log (type, recipient, message, status, timestamp)
      VALUES ('Email', ?, ?, 'Sent', ?)
    `, [
      customer_name.replace(/\s+/g, '').toLowerCase() + '@cargo-partner.com',
      `Quotation request ${refNum} has been received and is under operational review.`,
      now
    ]);

    res.status(201).json({ id: result.id, reference_number: refNum, status: finalStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all Quotations
app.get('/api/quotations', async (req, res) => {
  try {
    const quotes = await dbAll("SELECT * FROM quotations ORDER BY id DESC");
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Quotation details & History
app.get('/api/quotations/:id', async (req, res) => {
  try {
    const quote = await dbGet("SELECT * FROM quotations WHERE id = ?", [req.params.id]);
    if (!quote) return res.status(404).json({ error: "Quotation not found" });

    const history = await dbAll(
      "SELECT * FROM action_history WHERE entity_type = 'Quotation' AND entity_id = ? ORDER BY id DESC",
      [req.params.id]
    );

    res.json({ quote, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Quotation Status / Negotiate / Approve / Revise
app.put('/api/quotations/:id/status', async (req, res) => {
  const { status, comments, base_rate_per_kg, urgency_surcharge, handling_fee, total_cost, user_role } = req.body;
  const now = new Date().toISOString();

  try {
    const quote = await dbGet("SELECT * FROM quotations WHERE id = ?", [req.params.id]);
    if (!quote) return res.status(404).json({ error: "Quotation not found" });

    // Build update parameters dynamically
    let updateFields = ["status = ?", "updated_at = ?"];
    let params = [status, now];

    if (base_rate_per_kg !== undefined) {
      updateFields.push("base_rate_per_kg = ?");
      params.push(base_rate_per_kg);
    }
    if (urgency_surcharge !== undefined) {
      updateFields.push("urgency_surcharge = ?");
      params.push(urgency_surcharge);
    }
    if (handling_fee !== undefined) {
      updateFields.push("handling_fee = ?");
      params.push(handling_fee);
    }
    if (total_cost !== undefined) {
      updateFields.push("total_cost = ?");
      params.push(total_cost);
    }
    if (comments && (status === 'Rejected' || status === 'Revision Requested')) {
      updateFields.push("customer_feedback = ?");
      params.push(comments);
    }

    params.push(req.params.id);

    await dbRun(`UPDATE quotations SET ${updateFields.join(', ')} WHERE id = ?`, params);

    // Save action history
    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Quotation', ?, ?, ?, ?, ?)
    `, [req.params.id, `Status updated to ${status}`, user_role || 'System', now, comments || 'Status modification']);

    // Send Simulated Outgoing WhatsApp/Email
    const emailRecipient = quote.customer_name.replace(/\s+/g, '').toLowerCase() + '@cargo-partner.com';
    let alertMsg = `Update on Quote ${quote.reference_number}: Status changed to ${status}.`;
    if (status === 'Approved') {
      alertMsg = `Congratulations! Quote ${quote.reference_number} is approved. Your airway bill and invoicing are being processed.`;
    }

    await dbRun(`
      INSERT INTO notifications_log (type, recipient, message, status, timestamp)
      VALUES ('WhatsApp', 'Customer', ?, 'Sent', ?)
    `, [alertMsg, now]);

    // IF APPROVED: Automatically spawn Booking & Invoice
    if (status === 'Approved') {
      // Check if booking already exists
      const existingBooking = await dbGet("SELECT id FROM bookings WHERE quotation_id = ?", [req.params.id]);
      if (!existingBooking) {
        const awbNumber = `AWB-${Math.floor(100 + Math.random() * 900)}-${Math.floor(10000000 + Math.random() * 90000000)}`;
        
        // Define mock flight carriers based on destinations
        let carrier = "Emirates SkyCargo";
        let flight = "EK-512";
        if (quote.destination === 'LHR') { carrier = "British Airways World Cargo"; flight = "BA-224"; }
        else if (quote.destination === 'SFO') { carrier = "Singapore Airlines Cargo"; flight = "SQ-12"; }
        else if (quote.destination === 'SIN') { carrier = "Singapore Airlines Cargo"; flight = "SQ-501"; }

        // Calc delivery date based on route rate transit days
        const rateRow = await dbGet("SELECT transit_days FROM route_rates WHERE origin = ? AND destination = ?", [quote.origin, quote.destination]);
        const transitDays = rateRow ? rateRow.transit_days : 3;
        const estDeliveryDate = new Date();
        estDeliveryDate.setDate(estDeliveryDate.getDate() + transitDays);
        const estDeliveryStr = estDeliveryDate.toISOString().slice(0, 10);

        const bookingResult = await dbRun(`
          INSERT INTO bookings (
            quotation_id, awb_number, tracking_status, current_location, carrier, flight_number, est_delivery, updated_at
          ) VALUES (?, ?, 'Booked', ?, ?, ?, ?, ?)
        `, [req.params.id, awbNumber, quote.origin, carrier, flight, estDeliveryStr, now]);

        await dbRun(`
          INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
          VALUES ('Booking', ?, 'Cargo Booked', 'System', ?, 'AWB generated automatically upon quote approval')
        `, [bookingResult.id, now]);

        // Auto Create Invoice
        const invNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 14 days credit limit
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        const invResult = await dbRun(`
          INSERT INTO invoices (
            booking_id, invoice_number, total_amount, amount_paid, payment_status, due_date, created_at
          ) VALUES (?, ?, ?, 0.00, 'Unpaid', ?, ?)
        `, [bookingResult.id, invNumber, total_cost || quote.total_cost, dueDateStr, now]);

        await dbRun(`
          INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
          VALUES ('Invoice', ?, 'Invoice Generated', 'Accounts', ?, 'Automated system billing setup')
        `, [invResult.id, now]);
      }
    }

    res.json({ message: "Status updated successfully", status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Quote details as CSV mock string
app.get('/api/quotations/:id/export', async (req, res) => {
  try {
    const quote = await dbGet("SELECT * FROM quotations WHERE id = ?", [req.params.id]);
    if (!quote) return res.status(404).json({ error: "Quotation not found" });

    // Generate CSV string
    const headers = "Field,Value\n";
    const data = [
      `Quote Reference,${quote.reference_number}`,
      `Customer,${quote.customer_name}`,
      `Route,${quote.origin} -> ${quote.destination}`,
      `Cargo Type,${quote.cargo_type}`,
      `Urgency,${quote.urgency}`,
      `Actual Weight,${quote.actual_weight} kg`,
      `Dimensions,${quote.length}x${quote.width}x${quote.height} cm`,
      `Chargeable Weight,${quote.chargeable_weight} kg`,
      `Base Rate Per KG,$${quote.base_rate_per_kg}`,
      `Base Cost,$${quote.base_cost}`,
      `Urgency Surcharge,$${quote.urgency_surcharge}`,
      `Handling Fee,$${quote.handling_fee}`,
      `Total Cost,$${quote.total_cost}`,
      `Status,${quote.status}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=quote_${quote.reference_number}.csv`);
    res.send(headers + data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// BOOKINGS & MILESTONE TRACKING API
// ----------------------------------------------------
app.get('/api/bookings', async (req, res) => {
  try {
    const query = `
      SELECT b.*, q.reference_number, q.customer_name, q.origin, q.destination, q.cargo_type, q.total_cost 
      FROM bookings b
      JOIN quotations q ON b.quotation_id = q.id
      ORDER BY b.id DESC
    `;
    const bookings = await dbAll(query);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bookings/:id/status', async (req, res) => {
  const { tracking_status, current_location, carrier, flight_number, user_role, comment } = req.body;
  const now = new Date().toISOString();

  try {
    const booking = await dbGet("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    await dbRun(`
      UPDATE bookings 
      SET tracking_status = ?, current_location = ?, carrier = ?, flight_number = ?, updated_at = ?
      WHERE id = ?
    `, [tracking_status, current_location, carrier, flight_number, now, req.params.id]);

    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Booking', ?, ?, ?, ?, ?)
    `, [req.params.id, `Status update: ${tracking_status}`, user_role || 'Operations', now, comment || `Location: ${current_location}`]);

    // If milestone transitions to "Received at Warehouse", auto-create a storage allocation slot
    if (tracking_status === 'Received at Warehouse') {
      const exist = await dbGet("SELECT id FROM warehouse_inventory WHERE booking_id = ?", [req.params.id]);
      if (!exist) {
        // Auto assign zones
        const zones = ['Zone A (General)', 'Zone B (Cold Chain)', 'Zone C (High Security)'];
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const aisle = `A-${Math.floor(1 + Math.random() * 5)}`;
        const shelf = `Shelf-0${Math.floor(1 + Math.random() * 9)}`;

        await dbRun(`
          INSERT INTO warehouse_inventory (booking_id, zone, aisle, shelf, storage_temp, received_date, dispatch_status)
          VALUES (?, ?, ?, ?, 'Ambient', ?, 'Stored')
        `, [req.params.id, zone, aisle, shelf, now.slice(0, 10)]);

        await dbRun(`
          INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
          VALUES ('Warehouse', ?, 'Auto Stored Cargo', 'System', ?, 'Assigned to ' || ? || ' Aisle: ' || ? || ' Shelf: ' || ?)
        `, [req.params.id, now, zone, aisle, shelf]);
      }
    }

    // Trigger Outgoing notifications simulation
    await dbRun(`
      INSERT INTO notifications_log (type, recipient, message, status, timestamp)
      VALUES ('Email', 'Customer', ?, 'Sent', ?)
    `, [`Tracking Update: Shipment ${booking.awb_number} is now [${tracking_status}] at [${current_location}]. Carrier: ${carrier} Flight: ${flight_number}.`, now]);

    res.json({ message: "Milestone status updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// WAREHOUSE INVENTORY API
// ----------------------------------------------------
app.get('/api/warehouse', async (req, res) => {
  try {
    const query = `
      SELECT w.*, b.awb_number, q.customer_name, q.cargo_type, q.package_count, q.chargeable_weight
      FROM warehouse_inventory w
      JOIN bookings b ON w.booking_id = b.id
      JOIN quotations q ON b.quotation_id = q.id
      ORDER BY w.id DESC
    `;
    const inventory = await dbAll(query);
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/warehouse/:id', async (req, res) => {
  const { zone, aisle, shelf, storage_temp, dispatch_status, user_role } = req.body;
  const now = new Date().toISOString();

  try {
    await dbRun(`
      UPDATE warehouse_inventory 
      SET zone = ?, aisle = ?, shelf = ?, storage_temp = ?, dispatch_status = ?
      WHERE id = ?
    `, [zone, aisle, shelf, storage_temp, dispatch_status, req.params.id]);

    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Warehouse', ?, 'Update Layout Storage', ?, ?, 'Reassigned cargo slot')
    `, [req.params.id, user_role || 'Warehouse', now]);

    res.json({ message: "Warehouse storage updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AIRPORT PICKUP & SCHEDULER API
// ----------------------------------------------------
app.get('/api/pickup', async (req, res) => {
  try {
    const query = `
      SELECT p.*, b.awb_number, q.customer_name, q.origin, q.destination
      FROM pickup_schedule p
      JOIN bookings b ON p.booking_id = b.id
      JOIN quotations q ON b.quotation_id = q.id
      ORDER BY p.id DESC
    `;
    const schedules = await dbAll(query);
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pickup', async (req, res) => {
  const { booking_id, pickup_city, pickup_address, schedule_date, driver_name, driver_phone, vehicle_number, user_role } = req.body;
  const now = new Date().toISOString();

  try {
    const result = await dbRun(`
      INSERT INTO pickup_schedule (
        booking_id, pickup_city, pickup_address, schedule_date, driver_name, driver_phone, vehicle_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')
    `, [booking_id, pickup_city, pickup_address, schedule_date, driver_name, driver_phone, vehicle_number]);

    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Booking', ?, 'Schedule Airport Pickup', ?, ?, 'Driver: ' || ? || ', Date: ' || ?)
    `, [booking_id, user_role || 'Operations', now, driver_name, schedule_date]);

    res.status(201).json({ message: "Airport pickup scheduled successfully", id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// INVOICES & BILLING API
// ----------------------------------------------------
app.get('/api/billing', async (req, res) => {
  try {
    const query = `
      SELECT i.*, b.awb_number, q.customer_name, q.origin, q.destination, q.total_cost
      FROM invoices i
      JOIN bookings b ON i.booking_id = b.id
      JOIN quotations q ON b.quotation_id = q.id
      ORDER BY i.id DESC
    `;
    const invoices = await dbAll(query);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/billing/:id/pay', async (req, res) => {
  const { amount, payment_reference, user_role } = req.body;
  const now = new Date().toISOString();

  try {
    const invoice = await dbGet("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const newAmountPaid = invoice.amount_paid + parseFloat(amount);
    let newStatus = 'Unpaid';
    if (newAmountPaid >= invoice.total_amount) {
      newStatus = 'Paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'Partially Paid';
    }

    await dbRun(`
      UPDATE invoices 
      SET amount_paid = ?, payment_status = ?
      WHERE id = ?
    `, [newAmountPaid, newStatus, req.params.id]);

    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Invoice', ?, 'Process Payment', ?, ?, 'Ref: ' || ? || ', Amount: $' || ?)
    `, [req.params.id, user_role || 'Accounts', now, payment_reference || 'CASH', amount]);

    res.json({ message: "Payment processed successfully", amount_paid: newAmountPaid, payment_status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CLAIMS & COMPLAINTS API
// ----------------------------------------------------
app.get('/api/claims', async (req, res) => {
  try {
    const query = `
      SELECT c.*, b.awb_number, q.origin, q.destination 
      FROM claims c
      JOIN bookings b ON c.booking_id = b.id
      JOIN quotations q ON b.quotation_id = q.id
      ORDER BY c.id DESC
    `;
    const claims = await dbAll(query);
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/claims', async (req, res) => {
  const { booking_id, claimant_name, type, cargo_value, claim_amount, description, user_role } = req.body;
  const now = new Date().toISOString();
  const claimRef = generateRef('CLM');

  try {
    const result = await dbRun(`
      INSERT INTO claims (
        booking_id, claim_reference, claimant_name, type, cargo_value, claim_amount, description, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?)
    `, [booking_id, claimRef, claimant_name, type, cargo_value, claim_amount, description, now]);

    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Claim', ?, 'File Claim Dispute', ?, ?, 'Reference: ' || ?)
    `, [result.id, user_role || 'Customer', now, claimRef]);

    res.status(201).json({ message: "Claim filed successfully", claim_reference: claimRef, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/claims/:id/status', async (req, res) => {
  const { status, comments, user_role } = req.body;
  const now = new Date().toISOString();

  try {
    await dbRun("UPDATE claims SET status = ? WHERE id = ?", [status, req.params.id]);

    await dbRun(`
      INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments)
      VALUES ('Claim', ?, ?, ?, ?, ?)
    `, [req.params.id, `Claim status to ${status}`, user_role || 'Admin', now, comments]);

    res.json({ message: "Claim status updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// NOTIFICATION LOGS & ACTION LOGS API
// ----------------------------------------------------
app.get('/api/notifications', async (req, res) => {
  try {
    const logs = await dbAll("SELECT * FROM notifications_log ORDER BY id DESC LIMIT 50");
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/action-history', async (req, res) => {
  try {
    const logs = await dbAll("SELECT * FROM action_history ORDER BY id DESC LIMIT 50");
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AI LOGIC MODULE APIS
// ----------------------------------------------------

// 1. Cargo Description Cleaner & Hazard Checker
app.post('/api/ai/clean-description', (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ error: "Description required" });
    }

    const cleanMap = [
      { keywords: ['vacc', 'pharma', 'biotech', 'medicine', 'cold'], clean: 'Perishable Medical Supplies (Vaccines) - Temp Controlled (2-8°C)', category: 'Perishable', hazard: false },
      { keywords: ['batter', 'lithium', 'cellphone', 'laptop', 'device'], clean: 'Lithium-Ion Battery Cargo (UN3481) - Class 9 Miscellaneous Dangerous Goods', category: 'Hazardous', hazard: true },
      { keywords: ['acid', 'chemical', 'toxic', 'liquid', 'flam'], clean: 'Corrosive Chemicals (Liquid) - Class 8 Packing Group II UN-Approved Packing', category: 'Hazardous', hazard: true },
      { keywords: ['gold', 'jewel', 'watch', 'diamond', 'cash'], clean: 'Valuable Cargo Secured Shipments - High Value Cargo Escort Required', category: 'Valuable', hazard: false },
      { keywords: ['fruit', 'veg', 'meat', 'seafood', 'fresh'], clean: 'Perishable Foodstuffs - Refrigerated Fresh Produce', category: 'Perishable', hazard: false }
    ];

    let cleaned = description;
    let category = 'General';
    let hazard = false;

    const descLower = description.toLowerCase();
    for (const item of cleanMap) {
      if (item.keywords.some(k => descLower.includes(k))) {
        cleaned = item.clean;
        category = item.category;
        hazard = item.hazard;
        break;
      }
    }

    // If no keywords matched, standard capitalisation and clean up
    if (cleaned === description) {
      cleaned = description.charAt(0).toUpperCase() + description.slice(1).trim();
    }

    res.json({
      originalDescription: description,
      cleanedDescription: cleaned,
      cargoCategorySuggestion: category,
      hazardFlag: hazard,
      aiRecommendation: hazard 
        ? "WARNING: Dangerous Goods Cargo detected. Shipper's Declaration for Dangerous Goods (SDDG) is required before departure."
        : "Standard clearance procedures apply. Keep documents handy."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. AI Route Suggester & Customs Checklist
app.post('/api/ai/route-suggest', (req, res) => {
  try {
    const { origin, destination, cargo_type } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and Destination required" });
    }

    // Route Options database simulator
    const connections = {
      'BLR-DXB': {
        options: [
          { route: 'BLR -> DXB (Direct)', carrier: 'Emirates SkyCargo', duration: '4h 15m (Direct)', type: 'Fastest', carbon: 'Low' },
          { route: 'BLR -> BOM -> DXB', carrier: 'Air India Cargo', duration: '9h 30m (1 Stop)', type: 'Economical', carbon: 'Medium' }
        ]
      },
      'BLR-LHR': {
        options: [
          { route: 'BLR -> LHR (Direct)', carrier: 'British Airways World Cargo', duration: '10h 30m (Direct)', type: 'Fastest', carbon: 'Low' },
          { route: 'BLR -> DXB -> LHR', carrier: 'Emirates SkyCargo', duration: '14h 45m (1 Stop)', type: 'Recommended', carbon: 'High' }
        ]
      },
      'SIN-SFO': {
        options: [
          { route: 'SIN -> SFO (Direct)', carrier: 'Singapore Airlines Cargo', duration: '15h 10m (Direct)', type: 'Fastest', carbon: 'Low' },
          { route: 'SIN -> NRT -> SFO', carrier: 'ANA Cargo', duration: '20h 15m (1 Stop)', type: 'Economical', carbon: 'Medium' }
        ]
      }
    };

    const routeKey = `${origin}-${destination}`;
    const mockOptions = connections[routeKey] ? connections[routeKey].options : [
      { route: `${origin} -> ${destination} (Direct Connection)`, carrier: 'Global Cargo Express', duration: '8h 00m (Direct)', type: 'Standard', carbon: 'Low' },
      { route: `${origin} -> SIN -> ${destination}`, carrier: 'Changi Air Logistics', duration: '16h 30m (1 Stop)', type: 'Alternative', carbon: 'Medium' }
    ];

    // Required documentation checklist based on Cargo Type and Destination
    const docChecklist = [
      "Air Waybill (AWB)",
      "Commercial Invoice",
      "Packing List",
      "Shipper's Letter of Instruction (SLI)"
    ];

    if (cargo_type === 'Hazardous') {
      docChecklist.push("Shipper's Declaration for Dangerous Goods (DGD)");
      docChecklist.push("Material Safety Data Sheet (MSDS)");
    } else if (cargo_type === 'Perishable') {
      docChecklist.push("Phytosanitary Certificate / Food Safety Import Permit");
      docChecklist.push("Cold Chain Log & Temperature Log Declaration");
    } else if (cargo_type === 'Valuable') {
      docChecklist.push("Security Escort Clearance Certificate");
      docChecklist.push("Insurance Certificate Declaration (Valuable Cargo Cover)");
    }

    res.json({
      routeKey,
      origin,
      destination,
      suggestedRoutes: mockOptions,
      customsChecklist: docChecklist,
      complianceStatus: "Compliant - Documentation Verified",
      transitInsuranceSuggestion: "Suggested Premium cargo cover: 0.15% of declared cargo value."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Airline rate comparator
app.post('/api/ai/rate-compare', (req, res) => {
  try {
    const { origin, destination, weight } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and Destination required" });
    }

    const weightNum = parseFloat(weight || 100);

    // Generate comparisons dynamic based on inputs
    const comparators = [
      { airline: 'Emirates SkyCargo', rate_per_kg: 4.2, speed: 'Fast (2 days)', rating: '4.8★', space_availability: 'High', logo: 'EK' },
      { airline: 'Qatar Airways Cargo', rate_per_kg: 3.9, speed: 'Fast (2.5 days)', rating: '4.7★', space_availability: 'Medium', logo: 'QR' },
      { airline: 'Lufthansa Cargo', rate_per_kg: 4.5, speed: 'Express (1.5 days)', rating: '4.9★', space_availability: 'Low (Pre-booking needed)', logo: 'LH' },
      { airline: 'Singapore Airlines Cargo', rate_per_kg: 4.1, speed: 'Standard (3 days)', rating: '4.6★', space_availability: 'High', logo: 'SQ' }
    ];

    // Adjust prices slightly based on weight slabs to make calculations real
    const adjustedRates = comparators.map(c => {
      let priceMultiplier = 1.0;
      if (weightNum >= 300) priceMultiplier = 0.85; // discount for heavy
      else if (weightNum < 45) priceMultiplier = 1.25; // premium for light

      const rate = parseFloat((c.rate_per_kg * priceMultiplier).toFixed(2));
      const total = parseFloat((rate * weightNum).toFixed(2));
      
      return {
        ...c,
        rate_per_kg: rate,
        total_cost: total
      };
    });

    res.json({
      route: `${origin} -> ${destination}`,
      weight: weightNum,
      comparisons: adjustedRates
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start listening with automatic port recovery on EADDRINUSE
const startServer = (port) => {
  const server = app.listen(port);

  server.on('listening', () => {
    console.log("\n==================================================");
    console.log("  ORBEM SOLUTIONS - AIR FREIGHT QUOTATION SYSTEM  ");
    console.log("==================================================");
    console.log(`  ➜  Local preview URL:  http://localhost:${port}/`);
    console.log("  ➜  Press Ctrl+C to stop the server");
    console.log("==================================================\n");
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("Server error:", err);
    }
  });
};

startServer(PORT);
