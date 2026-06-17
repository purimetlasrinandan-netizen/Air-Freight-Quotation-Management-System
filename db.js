const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Run database migrations and seeding
db.serialize(() => {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS airports (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS route_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      rate_under_45 REAL NOT NULL,
      rate_45_to_100 REAL NOT NULL,
      rate_100_to_300 REAL NOT NULL,
      rate_300_to_500 REAL NOT NULL,
      rate_over_500 REAL NOT NULL,
      transit_days INTEGER NOT NULL,
      FOREIGN KEY(origin) REFERENCES airports(code),
      FOREIGN KEY(destination) REFERENCES airports(code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      cargo_type TEXT NOT NULL,
      urgency TEXT NOT NULL,
      package_count INTEGER NOT NULL,
      actual_weight REAL NOT NULL,
      length REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      volumetric_weight REAL NOT NULL,
      chargeable_weight REAL NOT NULL,
      base_rate_per_kg REAL NOT NULL,
      base_cost REAL NOT NULL,
      urgency_surcharge REAL NOT NULL,
      handling_fee REAL NOT NULL,
      total_cost REAL NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      customer_feedback TEXT,
      FOREIGN KEY(origin) REFERENCES airports(code),
      FOREIGN KEY(destination) REFERENCES airports(code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      awb_number TEXT UNIQUE NOT NULL,
      tracking_status TEXT NOT NULL,
      current_location TEXT NOT NULL,
      carrier TEXT NOT NULL,
      flight_number TEXT NOT NULL,
      est_delivery TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(quotation_id) REFERENCES quotations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS warehouse_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      zone TEXT NOT NULL,
      aisle TEXT NOT NULL,
      shelf TEXT NOT NULL,
      storage_temp TEXT NOT NULL,
      received_date TEXT NOT NULL,
      dispatch_status TEXT NOT NULL,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pickup_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      pickup_city TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      schedule_date TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      invoice_number TEXT UNIQUE NOT NULL,
      total_amount REAL NOT NULL,
      amount_paid REAL NOT NULL,
      payment_status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      claim_reference TEXT UNIQUE NOT NULL,
      claimant_name TEXT NOT NULL,
      type TEXT NOT NULL,
      cargo_value REAL NOT NULL,
      claim_amount REAL NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      document_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS action_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      user_role TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      comments TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  // Seed Data: Airports
  db.get("SELECT COUNT(*) as count FROM airports", (err, row) => {
    if (row && row.count === 0) {
      const airports = [
        { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India' },
        { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE' },
        { code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom' },
        { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA' },
        { code: 'SIN', name: 'Changi Airport', city: 'Singapore', country: 'Singapore' },
        { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'USA' }
      ];

      const stmt = db.prepare("INSERT INTO airports (code, name, city, country) VALUES (?, ?, ?, ?)");
      airports.forEach(a => stmt.run(a.code, a.name, a.city, a.country));
      stmt.finalize();
      console.log('Seeded airports.');
    }
  });

  // Seed Data: Route Rates
  db.get("SELECT COUNT(*) as count FROM route_rates", (err, row) => {
    if (row && row.count === 0) {
      const rates = [
        { origin: 'BLR', destination: 'DXB', under_45: 4.50, t_45_100: 4.00, t_100_300: 3.50, t_300_500: 3.00, over_500: 2.50, days: 2 },
        { origin: 'BLR', destination: 'LHR', under_45: 7.50, t_45_100: 7.00, t_100_300: 6.20, t_300_500: 5.50, over_500: 4.80, days: 4 },
        { origin: 'DXB', destination: 'LHR', under_45: 5.00, t_45_100: 4.50, t_100_300: 4.00, t_300_500: 3.50, over_500: 3.00, days: 3 },
        { origin: 'SIN', destination: 'SFO', under_45: 9.00, t_45_100: 8.50, t_100_300: 7.80, t_300_500: 7.00, over_500: 6.20, days: 5 },
        { origin: 'JFK', destination: 'LHR', under_45: 5.50, t_45_100: 5.00, t_100_300: 4.20, t_300_500: 3.80, over_500: 3.20, days: 3 },
        { origin: 'SFO', destination: 'JFK', under_45: 3.50, t_45_100: 3.00, t_100_300: 2.50, t_300_500: 2.20, over_500: 1.80, days: 2 },
        { origin: 'BLR', destination: 'JFK', under_45: 10.50, t_45_100: 9.80, t_100_300: 9.00, t_300_500: 8.20, over_500: 7.50, days: 5 }
      ];

      const stmt = db.prepare(`
        INSERT INTO route_rates (
          origin, destination, rate_under_45, rate_45_to_100, rate_100_to_300, rate_300_to_500, rate_over_500, transit_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      rates.forEach(r => {
        stmt.run(r.origin, r.destination, r.under_45, r.t_45_100, r.t_100_300, r.t_300_500, r.over_500, r.days);
      });
      stmt.finalize();
      console.log('Seeded route rates.');
    }
  });

  // Seed Data: Sample Quotation & Bookings to make the dashboard look populated instantly
  db.get("SELECT COUNT(*) as count FROM quotations", (err, row) => {
    if (row && row.count === 0) {
      const now = new Date().toISOString();
      
      // Sample Quote 1 (Approved -> Becomes Booking)
      db.run(`
        INSERT INTO quotations (
          reference_number, customer_name, origin, destination, cargo_type, urgency,
          package_count, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
          base_rate_per_kg, base_cost, urgency_surcharge, handling_fee, total_cost, status, owner, created_at, updated_at
        ) VALUES (
          'QT-2026-0001', 'Tesla Motors Inc.', 'SIN', 'SFO', 'Valuable', 'Express',
          5, 250.0, 80.0, 60.0, 50.0, 240.0, 250.0,
          8.50, 2125.0, 425.0, 150.0, 2700.0, 'Approved', 'Admin Staff', ?, ?
        )
      `, [now, now], function(err) {
        if (!err) {
          const qId = this.lastID;
          
          // Add Action History
          db.run("INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments) VALUES (?, ?, ?, ?, ?, ?)",
            ['Quotation', qId, 'Create Draft', 'Customer', now, 'Requested via online customer portal']
          );
          db.run("INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments) VALUES (?, ?, ?, ?, ?, ?)",
            ['Quotation', qId, 'Send Quote to Customer', 'Admin', now, 'Quote generated using slab rates ($8.50/kg)']
          );
          db.run("INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments) VALUES (?, ?, ?, ?, ?, ?)",
            ['Quotation', qId, 'Approve Quote', 'Customer', now, 'Approved and authorized booking creation']
          );

          // Create Booking
          db.run(`
            INSERT INTO bookings (
              quotation_id, awb_number, tracking_status, current_location, carrier, flight_number, est_delivery, updated_at
            ) VALUES (
              ?, 'AWB-882-99018821', 'Received at Warehouse', 'Singapore Changi (SIN)', 'Singapore Airlines Cargo', 'SQ-732', '2026-06-15', ?
            )
          `, [qId, now], function(err) {
            if (!err) {
              const bId = this.lastID;
              
              // Warehouse inventory
              db.run(`
                INSERT INTO warehouse_inventory (
                  booking_id, zone, aisle, shelf, storage_temp, received_date, dispatch_status
                ) VALUES (?, 'Zone C (High Security)', 'Aisle A3', 'Shelf 02', 'Ambient', '2026-06-12', 'Stored')
              `, [bId]);

              // Invoice
              db.run(`
                INSERT INTO invoices (
                  booking_id, invoice_number, total_amount, amount_paid, payment_status, due_date, created_at
                ) VALUES (?, 'INV-2026-0001', 2700.0, 2700.0, 'Paid', '2026-06-25', ?)
              `, [bId, now]);

              // Notification Log
              db.run(`
                INSERT INTO notifications_log (
                  type, recipient, message, status, timestamp
                ) VALUES ('Email', 'shipping@tesla.com', 'Your booking AWB-882-99018821 has been confirmed. Invoice INV-2026-0001 is paid.', 'Sent', ?)
              `, [now]);
            }
          });
        }
      });

      // Sample Quote 2 (Pending Admin Review)
      db.run(`
        INSERT INTO quotations (
          reference_number, customer_name, origin, destination, cargo_type, urgency,
          package_count, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
          base_rate_per_kg, base_cost, urgency_surcharge, handling_fee, total_cost, status, owner, created_at, updated_at
        ) VALUES (
          'QT-2026-0002', 'Apex Pharma Lab', 'BLR', 'LHR', 'Perishable', 'Critical',
          2, 35.0, 50.0, 40.0, 40.0, 32.0, 35.0,
          7.50, 262.50, 131.25, 120.0, 513.75, 'Pending Admin Review', 'Pending Assignment', ?, ?
        )
      `, [now, now], function(err) {
        if (!err) {
          const qId = this.lastID;
          db.run("INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments) VALUES (?, ?, ?, ?, ?, ?)",
            ['Quotation', qId, 'Create Draft', 'Customer', now, 'Requested vaccine shipment. Requires cold chain logistics.']
          );
        }
      });

      // Sample Quote 3 (Sent to Customer)
      db.run(`
        INSERT INTO quotations (
          reference_number, customer_name, origin, destination, cargo_type, urgency,
          package_count, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
          base_rate_per_kg, base_cost, urgency_surcharge, handling_fee, total_cost, status, owner, created_at, updated_at
        ) VALUES (
          'QT-2026-0003', 'Globex Chemicals', 'DXB', 'LHR', 'Hazardous', 'Standard',
          10, 600.0, 100.0, 100.0, 100.0, 2000.0, 2000.0,
          3.00, 6000.0, 0.0, 450.0, 6450.0, 'Sent to Customer', 'Admin Staff', ?, ?
        )
      `, [now, now], function(err) {
        if (!err) {
          const qId = this.lastID;
          db.run("INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments) VALUES (?, ?, ?, ?, ?, ?)",
            ['Quotation', qId, 'Create Draft', 'Customer', now, 'Chemical samples']
          );
          db.run("INSERT INTO action_history (entity_type, entity_id, action, user_role, timestamp, comments) VALUES (?, ?, ?, ?, ?, ?)",
            ['Quotation', qId, 'Send Quote to Customer', 'Admin', now, 'Charged based on volumetric weight (2000 kg volumetric vs 600 kg actual)']
          );
        }
      });
    }
  });

});

module.exports = db;
