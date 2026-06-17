const http = require('http');
const assert = require('assert');
const path = require('path');
const db = require('../db');

// We will launch the server programmatically on a test port
const serverPort = 5001;
process.env.PORT = serverPort;
const server = require('../server');

// Helper to make HTTP Requests programmatically
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: serverPort,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', err => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Delay helper
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('STARTING AIR FREIGHT SYSTEM INTEGRATION TEST FLOW');
  console.log('--------------------------------------------------');
  
  // Wait a moment for server and database to spin up
  await sleep(1000);

  try {
    // TEST 1: Retrieve Airports
    console.log('Test 1: GET /api/airports');
    const airportsRes = await makeRequest('GET', '/api/airports');
    assert.strictEqual(airportsRes.status, 200);
    assert.ok(Array.isArray(airportsRes.body), 'Airports should be an array');
    assert.ok(airportsRes.body.length >= 5, 'Should contain seeded airports');
    console.log('✔ Test 1 passed: Returned', airportsRes.body.length, 'airports.');

    // TEST 2: Chargeable Weight Calculation Check
    console.log('\nTest 2: POST /api/quotations/calculate (Volumetric Vs Actual)');
    const calcPayload = {
      origin: 'BLR',
      destination: 'DXB',
      length: 100,      // in cm
      width: 80,        // in cm
      height: 60,       // in cm
      package_count: 2, // 2 packages
      actual_weight: 150.0, // 150 kg actual
      urgency: 'Express',
      cargo_type: 'General'
    };
    
    // Volumetric weight: (100 * 80 * 60 * 2) / 5000 = 192 kg.
    // Chargeable weight = max(150, 192) = 192 kg.
    const calcRes = await makeRequest('POST', '/api/quotations/calculate', calcPayload);
    assert.strictEqual(calcRes.status, 200);
    assert.strictEqual(calcRes.body.volumetric_weight, 192);
    assert.strictEqual(calcRes.body.chargeable_weight, 192);
    assert.ok(calcRes.body.total_cost > 0, 'Total cost should be calculated');
    console.log('✔ Test 2 passed: Chargeable weight verified as max(Actual, Volumetric) = 192 kg.');

    // TEST 3: AI Cargo Cleaning
    console.log('\nTest 3: POST /api/ai/clean-description (AI Description classification)');
    const cleanPayload = { description: 'cold cases of polio vaccine and medical freeze containers' };
    const cleanRes = await makeRequest('POST', '/api/ai/clean-description', cleanPayload);
    assert.strictEqual(cleanRes.status, 200);
    assert.strictEqual(cleanRes.body.cargoCategorySuggestion, 'Perishable');
    assert.strictEqual(cleanRes.body.hazardFlag, false);
    console.log('✔ Test 3 passed: AI classified cargo as Perishable/Non-hazardous.');

    // TEST 4: Create Quotation Request
    console.log('\nTest 4: POST /api/quotations (Request creation)');
    const quotePayload = {
      customer_name: 'Apple Operations India',
      origin: 'BLR',
      destination: 'LHR',
      cargo_type: 'General',
      urgency: 'Standard',
      package_count: 5,
      actual_weight: 400.0,
      length: 100,
      width: 80,
      height: 50,
      volumetric_weight: 400.0,
      chargeable_weight: 400.0,
      base_rate_per_kg: 5.50,
      base_cost: 2200.0,
      urgency_surcharge: 0.0,
      handling_fee: 100.0,
      total_cost: 2300.0,
      status: 'Pending Admin Review'
    };

    const quoteRes = await makeRequest('POST', '/api/quotations', quotePayload);
    assert.strictEqual(quoteRes.status, 201);
    assert.ok(quoteRes.body.id, 'Quotation should return an ID');
    assert.ok(quoteRes.body.reference_number.startsWith('QT-'), 'Should return ref QT-');
    console.log('✔ Test 4 passed: Created Quote with Ref:', quoteRes.body.reference_number);

    const testQuoteId = quoteRes.body.id;

    // TEST 5: Status transition workflow (Admin sends to customer)
    console.log('\nTest 5: PUT /api/quotations/:id/status (Admin updates to Sent)');
    const sentStatusRes = await makeRequest('PUT', `/api/quotations/${testQuoteId}/status`, {
      status: 'Sent to Customer',
      user_role: 'Admin',
      comments: 'Pricing verified. base rate adjusted to $5.50/kg'
    });
    assert.strictEqual(sentStatusRes.status, 200);
    console.log('✔ Test 5 passed: Status transitioned to "Sent to Customer".');

    // TEST 6: Customer Approves -> Triggers Booking & Invoice creation
    console.log('\nTest 6: PUT /api/quotations/:id/status (Customer Approves -> Auto Booking/Invoicing)');
    const approvedStatusRes = await makeRequest('PUT', `/api/quotations/${testQuoteId}/status`, {
      status: 'Approved',
      user_role: 'Customer',
      comments: 'Quote approved. Proceed with air freight booking.'
    });
    assert.strictEqual(approvedStatusRes.status, 200);

    // Fetch bookings to check if booking was generated
    const bookingsRes = await makeRequest('GET', '/api/bookings');
    const createdBooking = bookingsRes.body.find(b => b.quotation_id === testQuoteId);
    assert.ok(createdBooking, 'Auto booking should be created');
    assert.strictEqual(createdBooking.tracking_status, 'Booked');
    assert.ok(createdBooking.awb_number.startsWith('AWB-'), 'AWB number should be auto generated');
    console.log('✔ Test 6 passed: Auto booking generated. AWB:', createdBooking.awb_number);

    // TEST 7: Auto Invoice Generation
    console.log('\nTest 7: GET /api/billing (Auto invoice creation)');
    const billingRes = await makeRequest('GET', '/api/billing');
    const createdInvoice = billingRes.body.find(inv => inv.booking_id === createdBooking.id);
    assert.ok(createdInvoice, 'Auto invoice should be created');
    assert.strictEqual(createdInvoice.payment_status, 'Unpaid');
    assert.strictEqual(createdInvoice.total_amount, 2300.0);
    console.log('✔ Test 7 passed: Invoice generated for total amount:', createdInvoice.total_amount);

    // TEST 8: Log Payment Transaction
    console.log('\nTest 8: POST /api/billing/:id/pay (Process wire payment)');
    const payRes = await makeRequest('POST', `/api/billing/${createdInvoice.id}/pay`, {
      amount: 2300.0,
      payment_reference: 'WIRE-HDFC-890122',
      user_role: 'Accounts'
    });
    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.payment_status, 'Paid');
    assert.strictEqual(payRes.body.amount_paid, 2300.0);
    console.log('✔ Test 8 passed: Recorded full payment of $2300. Invoice status: PAID');

    console.log('\n--------------------------------------------------');
    console.log('ALL TESTS PASSED SUCCESSFULLY! WORKFLOW IS ROBUST.');
    console.log('--------------------------------------------------');
    
    // Success shutdown
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test execution failed!');
    console.error(err);
    process.exit(1);
  }
}

runTests();
