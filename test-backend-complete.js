/**
 * Complete Backend Test Script
 * Tests all major endpoints and functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let vendorId = '';
let venueId = '';
let menuItemId = '';
let promotionId = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(`🧪 Testing: ${name}`, 'cyan');
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test 1: Health Check
async function testHealth() {
  logTest('Health Check');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logSuccess(`Health check passed: ${response.data.status}`);
    logInfo(`Socket status: ${response.data.socket}`);
    return true;
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

// Test 2: Vendor Login
async function testVendorLogin() {
  logTest('Vendor Login');
  try {
    const response = await axios.post(`${BASE_URL}/vendor/auth/login`, {
      email: 'marvelant667@gmail.com',
      password: 'password123'
    });
    
    if (response.data.data && response.data.data.accessToken) {
      authToken = response.data.data.accessToken;
      vendorId = response.data.data.vendor.id;
      logSuccess('Vendor login successful');
      logInfo(`Token: ${authToken.substring(0, 20)}...`);
      logInfo(`Vendor ID: ${vendorId}`);
      return true;
    } else {
      logError('No token received');
      return false;
    }
  } catch (error) {
    logError(`Login failed: ${error.response?.data?.message || error.message}`);
    
    // Try to create vendor if login fails
    log('\n🔄 Attempting to create test vendor...', 'yellow');
    try {
      const registerResponse = await axios.post(`${BASE_URL}/vendor/auth/register`, {
        email: 'vendor@test.com',
        password: 'password123',
        businessName: 'Test Vendor Business',
        contactPerson: 'Test Vendor',
        phone: '+919876543210'
      });
      
      if (registerResponse.data.data && registerResponse.data.data.accessToken) {
        authToken = registerResponse.data.data.accessToken;
        vendorId = registerResponse.data.data.vendor.id;
        logSuccess('Vendor created and logged in');
        logInfo(`Vendor ID: ${vendorId}`);
        return true;
      }
    } catch (regError) {
      logError(`Registration failed: ${regError.response?.data?.message || regError.message}`);
      return false;
    }
  }
}

// Test 3: Get Vendor Profile
async function testGetProfile() {
  logTest('Get Vendor Profile');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Profile retrieved successfully');
    logInfo(`Business: ${response.data.data.vendor.businessName}`);
    logInfo(`Email: ${response.data.data.vendor.email}`);
    logInfo(`Subscription: ${response.data.data.vendor.subscription.tier}`);
    return true;
  } catch (error) {
    logError(`Get profile failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 4: Get Dashboard Summary
async function testDashboardSummary() {
  logTest('Dashboard Summary');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/dashboard/summary`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Dashboard summary retrieved');
    logInfo(`Total Revenue: ₹${response.data.data.summary.totalRevenue}`);
    logInfo(`Total Bookings: ${response.data.data.summary.totalBookings}`);
    logInfo(`Total Venues: ${response.data.data.summary.totalVenues}`);
    logInfo(`Total Menu Items: ${response.data.data.summary.totalMenuItems}`);
    return true;
  } catch (error) {
    logError(`Dashboard summary failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 5: Get Venues
async function testGetVenues() {
  logTest('Get Venues');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/venues`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess(`Retrieved ${response.data.data.venues.length} venues`);
    
    if (response.data.data.venues.length > 0) {
      venueId = response.data.data.venues[0]._id;
      logInfo(`First venue: ${response.data.data.venues[0].name}`);
      logInfo(`Venue ID: ${venueId}`);
    } else {
      log('⚠️  No venues found, will create one', 'yellow');
    }
    return true;
  } catch (error) {
    logError(`Get venues failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 6: Create Venue (if needed)
async function testCreateVenue() {
  if (venueId) {
    logInfo('Venue already exists, skipping creation');
    return true;
  }
  
  logTest('Create Venue');
  try {
    const response = await axios.post(`${BASE_URL}/vendor/venues`, {
      name: 'Test Bar & Lounge',
      type: 'bar',
      description: 'A test venue for backend testing',
      address: {
        street: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        country: 'India'
      },
      contact: {
        phone: '+919876543210',
        email: 'testbar@example.com'
      },
      capacity: 100,
      priceLevel: 3
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    venueId = response.data.data.venue._id;
    logSuccess('Venue created successfully');
    logInfo(`Venue ID: ${venueId}`);
    logInfo(`Venue Name: ${response.data.data.venue.name}`);
    return true;
  } catch (error) {
    logError(`Create venue failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 7: Get Menu Items
async function testGetMenuItems() {
  if (!venueId) {
    log('⚠️  No venue ID, skipping menu test', 'yellow');
    return false;
  }
  
  logTest('Get Menu Items');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/menu/${venueId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess(`Retrieved ${response.data.data.items.length} menu items`);
    
    if (response.data.data.items.length > 0) {
      menuItemId = response.data.data.items[0]._id;
      logInfo(`First item: ${response.data.data.items[0].name}`);
    }
    return true;
  } catch (error) {
    logError(`Get menu items failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 8: Create Menu Item
async function testCreateMenuItem() {
  if (!venueId) {
    log('⚠️  No venue ID, skipping menu item creation', 'yellow');
    return false;
  }
  
  logTest('Create Menu Item');
  try {
    const response = await axios.post(`${BASE_URL}/vendor/menu/${venueId}`, {
      name: 'Test Cocktail',
      category: 'cocktails',
      price: 350,
      description: 'A delicious test cocktail',
      isAvailable: true,
      alcoholPercentage: 12
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    menuItemId = response.data.data.item._id;
    logSuccess('Menu item created successfully');
    logInfo(`Item ID: ${menuItemId}`);
    logInfo(`Item Name: ${response.data.data.item.name}`);
    return true;
  } catch (error) {
    logError(`Create menu item failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 9: Get Promotions
async function testGetPromotions() {
  logTest('Get Promotions');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/promotions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess(`Retrieved ${response.data.data.promotions.length} promotions`);
    
    if (response.data.data.promotions.length > 0) {
      promotionId = response.data.data.promotions[0]._id;
      logInfo(`First promotion: ${response.data.data.promotions[0].title}`);
    }
    return true;
  } catch (error) {
    logError(`Get promotions failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 10: Create Promotion
async function testCreatePromotion() {
  if (!venueId) {
    log('⚠️  No venue ID, skipping promotion creation', 'yellow');
    return false;
  }
  
  logTest('Create Promotion');
  try {
    const response = await axios.post(`${BASE_URL}/vendor/promotions`, {
      title: 'Test Happy Hour',
      description: 'Test promotion for backend testing',
      type: 'happy-hour',
      discountType: 'percent',
      discountValue: 50,
      venue: venueId,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: 'active'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    promotionId = response.data.data.promotion._id;
    logSuccess('Promotion created successfully');
    logInfo(`Promotion ID: ${promotionId}`);
    logInfo(`Promotion Title: ${response.data.data.promotion.title}`);
    return true;
  } catch (error) {
    logError(`Create promotion failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 11: Get Bookings
async function testGetBookings() {
  logTest('Get Bookings');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/bookings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess(`Retrieved ${response.data.data.bookings.length} bookings`);
    return true;
  } catch (error) {
    logError(`Get bookings failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 12: Get Reviews
async function testGetReviews() {
  logTest('Get Reviews');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/reviews`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess(`Retrieved ${response.data.data.reviews.length} reviews`);
    return true;
  } catch (error) {
    logError(`Get reviews failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 13: Get Analytics
async function testGetAnalytics() {
  logTest('Get Analytics');
  try {
    const response = await axios.get(`${BASE_URL}/vendor/analytics/overview`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Analytics retrieved successfully');
    return true;
  } catch (error) {
    logError(`Get analytics failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     DRINKBUDDY BACKEND - COMPREHENSIVE TEST SUITE         ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('\n');
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'Vendor Login', fn: testVendorLogin },
    { name: 'Get Profile', fn: testGetProfile },
    { name: 'Dashboard Summary', fn: testDashboardSummary },
    { name: 'Get Venues', fn: testGetVenues },
    { name: 'Create Venue', fn: testCreateVenue },
    { name: 'Get Menu Items', fn: testGetMenuItems },
    { name: 'Create Menu Item', fn: testCreateMenuItem },
    { name: 'Get Promotions', fn: testGetPromotions },
    { name: 'Create Promotion', fn: testCreatePromotion },
    { name: 'Get Bookings', fn: testGetBookings },
    { name: 'Get Reviews', fn: testGetReviews },
    { name: 'Get Analytics', fn: testGetAnalytics }
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      logError(`Test "${test.name}" threw an error: ${error.message}`);
      results.failed++;
    }
  }
  
  // Summary
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                      TEST SUMMARY                          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('\n');
  
  logSuccess(`Passed: ${results.passed}`);
  logError(`Failed: ${results.failed}`);
  log(`Total: ${results.passed + results.failed}`, 'blue');
  
  const percentage = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
  console.log('\n');
  log(`Success Rate: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
  console.log('\n');
  
  if (results.failed === 0) {
    log('🎉 ALL TESTS PASSED! Backend is working perfectly!', 'green');
  } else {
    log(`⚠️  ${results.failed} test(s) failed. Please check the errors above.`, 'yellow');
  }
  
  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
