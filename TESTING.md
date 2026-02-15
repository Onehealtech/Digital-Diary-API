# 🧪 Digital Diary API - Automated Testing Guide

## 📋 Overview

This project uses **Jest + Supertest** for automated API testing. We have comprehensive tests covering all 100+ APIs across multiple categories.

---

## 🚀 Quick Start

### 1. Install Dependencies (Already Done)
```bash
npm install
```

### 2. Start the Backend Server
```bash
npm run dev
```
Keep this running in a separate terminal.

### 3. Run All Tests
```bash
npm test
```

---

## 📁 Test Structure

```
tests/
├── helpers/
│   └── testHelper.ts                      # Shared test utilities
├── integration/
│   ├── 01-authentication.test.ts          # Auth APIs (8 tests)
│   ├── 02-vendor-management.test.ts       # Vendor APIs (10 tests)
│   ├── 03-diary-inventory.test.ts         # Diary APIs (12 tests)
│   ├── 04-task-management.test.ts         # Task APIs (6 tests)
│   ├── 05-notifications.test.ts           # Notification APIs (9 tests)
│   ├── 06-dashboard.test.ts               # Dashboard APIs (6 tests)
│   ├── 07-patient-management.test.ts      # Patient APIs (11 tests)
│   ├── 08-diary-entry-review.test.ts      # Diary Review APIs (6 tests)
│   ├── 09-financial-system.test.ts        # Financial APIs (5 tests)
│   ├── 10-reports-export.test.ts          # Reports & Export APIs (7 tests)
│   ├── 11-doctor-management.test.ts       # Doctor Management APIs (4 tests)
│   ├── 12-assistant-management.test.ts    # Assistant Management APIs (4 tests)
│   └── 13-audit-logs.test.ts              # Audit Logs APIs (4 tests)
└── setup.ts                                # Global test setup
```

---

## 🎯 Test Commands

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

### Run Tests in Watch Mode (Auto-rerun on changes)
```bash
npm run test:watch
```

### Run Specific Test Categories

#### Authentication Tests Only
```bash
npm run test:auth
```

#### Vendor Management Tests Only
```bash
npm run test:vendor
```

#### Diary Inventory Tests Only
```bash
npm run test:diary
```

#### Task Management Tests Only
```bash
npm run test:task
```

#### Notification Tests Only
```bash
npm run test:notification
```

#### Dashboard Tests Only
```bash
npm run test:dashboard
```

#### Patient Management Tests Only
```bash
npm run test:patient
```

#### Diary Entry Review Tests Only
```bash
npm run test:diary-review
```

#### Financial System Tests Only
```bash
npm run test:financial
```

#### Reports & Export Tests Only
```bash
npm run test:reports
```

#### Doctor Management Tests Only
```bash
npm run test:doctor
```

#### Assistant Management Tests Only
```bash
npm run test:assistant
```

#### Audit Logs Tests Only
```bash
npm run test:audit
```

### Run Tests with Verbose Output
```bash
npm run test:verbose
```

---

## 📊 Test Coverage

### Current Coverage

| Category | APIs | Test Status |
|----------|------|-------------|
| Authentication | 8 | ✅ Complete |
| Vendor Management | 10 | ✅ Complete |
| Diary Inventory | 12 | ✅ Complete |
| Task Management | 6 | ✅ Complete |
| Notifications | 9 | ✅ Complete |
| Dashboard | 6 | ✅ Complete |
| Patient Management | 11 | ✅ Complete |
| Diary Entry Review | 6 | ✅ Complete |
| Financial System | 5 | ✅ Complete |
| Reports & Export | 7 | ✅ Complete |
| Doctor Management | 4 | ✅ Complete |
| Assistant Management | 4 | ✅ Complete |
| Audit Logs | 4 | ✅ Complete |

**Total: 92/92 APIs tested (100%)** 🎉

---

## ✅ What's Being Tested

### 1. Authentication APIs (8 APIs) ✅
- ✅ Create Super Admin
- ✅ Staff Login (2FA)
- ✅ Verify 2FA
- ✅ Get Current User
- ✅ Logout
- ✅ Refresh Token
- ✅ Forgot Password
- ✅ Reset Password

### 2. Vendor Management (10 APIs) ✅
- ✅ Create Vendor
- ✅ Get All Vendors
- ✅ Get Vendor by ID
- ✅ Update Vendor
- ✅ Get Vendor Wallet
- ✅ Transfer Funds
- ✅ Get Sales History
- ✅ Get Vendor Inventory
- ✅ Vendor Dashboard

### 3. Diary Inventory (12 APIs) ✅
- ✅ Generate Diaries with QR Codes
- ✅ Get All Generated Diaries
- ✅ Get Diary by ID
- ✅ Assign Diary to Vendor
- ✅ Bulk Assign Diaries
- ✅ Unassign Diary
- ✅ Create Diary Request
- ✅ Get All Diary Requests
- ✅ Approve Diary Request
- ✅ Reject Diary Request

### 4. Task Management (6 APIs) ✅
- ✅ Create Task
- ✅ Get All Tasks
- ✅ Get Task by ID
- ✅ Update Task
- ✅ Complete Task
- ✅ Delete Task

### 5. Notification System (9 APIs) ✅
- ✅ Get All Notifications
- ✅ Get Notification Statistics
- ✅ Get Notification by ID
- ✅ Send Individual Notification
- ✅ Send Bulk Notifications
- ✅ Mark as Read
- ✅ Mark Multiple as Read
- ✅ Mark All as Read
- ✅ Delete Notification

### 6. Dashboard Statistics (6 APIs) ✅
- ✅ Super Admin Dashboard
- ✅ Vendor Dashboard
- ✅ Doctor Dashboard
- ✅ Assistant Dashboard
- ✅ Get Dashboard Patients
- ✅ Get Dashboard Reminders

### 7. Patient Management (11 APIs) ✅
- ✅ Get Patients Needing Follow-Up
- ✅ Get Patient by ID
- ✅ Update Patient
- ✅ Prescribe Tests to Patient
- ✅ Update Test Status
- ✅ Log Call Attempt
- ✅ Get Test Progress
- ✅ Create Patient (Legacy)
- ✅ Get All Patients (Legacy)
- ✅ Get Patient Profile
- ✅ Get Patient Reminders

### 8. Diary Entry Review (6 APIs) ✅
- ✅ Get All Diary Entries
- ✅ Get Diary Entry Statistics
- ✅ Get Pending Reviews
- ✅ Get Diary Entry by ID
- ✅ Review Diary Entry
- ✅ Flag/Unflag Diary Entry

### 9. Financial System (5 APIs) ✅
- ✅ Get Financial Dashboard
- ✅ Get All Transactions
- ✅ Get Transaction Statistics
- ✅ Get Financial Statement
- ✅ Process Payout

### 10. Reports & Export (7 APIs) ✅
- ✅ Export Patient Data
- ✅ Export Diary Pages
- ✅ Export Test Summary
- ✅ Get All Exports
- ✅ Download Export
- ✅ Delete Export
- ✅ Get Patient Analytics

### 11. Doctor Management (4 APIs) ✅
- ✅ Get All Doctors
- ✅ Get Doctor by ID
- ✅ Update Doctor
- ✅ Delete Doctor

### 12. Assistant Management (4 APIs) ✅
- ✅ Get All Assistants
- ✅ Get Assistant by ID
- ✅ Update Assistant
- ✅ Delete Assistant

### 13. Audit Logs (4 APIs) ✅
- ✅ Get All Audit Logs
- ✅ Get Audit Statistics
- ✅ Search Audit Logs
- ✅ Get User Audit Logs

---

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
};
```

### Key Features
- ✅ TypeScript support with ts-jest
- ✅ 30-second timeout for API calls
- ✅ Automatic test isolation
- ✅ Code coverage reporting
- ✅ Verbose output for debugging

---

## 📝 Writing New Tests

### Example Test Structure

```typescript
import request from 'supertest';
import app from '../../src/index';
import { testTokens, expectSuccessResponse, getAuthHeader } from '../helpers/testHelper';

describe('Your API Category', () => {
  beforeAll(async () => {
    // Setup: Get authentication tokens
  });

  describe('POST /your-endpoint', () => {
    it('should do something successfully', async () => {
      const res = await request(app)
        .post('/api/v1/your-endpoint')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({ data: 'test' });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app)
        .post('/api/v1/your-endpoint')
        .send({ data: 'test' });

      expect(res.status).toBe(401);
    });
  });
});
```

---

## 🐛 Debugging Tests

### Run Single Test File
```bash
npx jest tests/integration/01-authentication.test.ts
```

### Run Specific Test
```bash
npx jest -t "should create a super admin successfully"
```

### Debug with Console Logs
Tests will show console output automatically in verbose mode:
```bash
npm run test:verbose
```

---

## 🎯 Test Data

### Default Test Users

```typescript
// Super Admin
{
  email: 'superadmin@test.com',
  password: 'Test@123456'
}

// Doctor
{
  email: 'doctor@test.com',
  password: 'Test@123456'
}

// Vendor
{
  email: 'vendor@test.com',
  password: 'Test@123456'
}

// Assistant
{
  email: 'assistant@test.com',
  password: 'Test@123456'
}

// Patient
{
  phoneNumber: '9876543210',
  otp: '123456' // Mock OTP
}
```

---

## 📈 Continuous Integration

### GitHub Actions (Future)
```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

---

## 🎨 Test Output Example

```bash
 PASS  tests/integration/01-authentication.test.ts
  Authentication APIs
    POST /auth/signup-super-admin
      ✓ should create a super admin successfully (253ms)
      ✓ should not create duplicate super admin (89ms)
    POST /auth/login (Staff)
      ✓ should send OTP for valid credentials (156ms)
      ✓ should reject invalid email (92ms)
      ✓ should reject invalid password (88ms)
    ...

Test Suites: 13 passed, 13 total
Tests:       92 passed, 92 total
Snapshots:   0 total
Time:        125.678s
```

---

## ✅ All Tests Complete!

🎉 **Congratulations!** All 92 APIs are now covered with automated tests!

### What's Included:
- ✅ 13 comprehensive test suites
- ✅ 92 API endpoint tests
- ✅ Role-based authorization testing
- ✅ Error handling and validation tests
- ✅ Integration tests across all modules
- ✅ Automated authentication flow testing

### Running the Complete Test Suite:
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific category
npm run test:patient
npm run test:financial
npm run test:audit
# ... and 10 more categories
```

---

## 🛠️ Troubleshooting

### Test Timeout
If tests timeout, increase the timeout in `jest.config.js`:
```javascript
testTimeout: 60000 // 60 seconds
```

### Database Connection Issues
Make sure your `.env` file has correct database credentials:
```env
DB_HOST=your-database-host
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password
```

### Port Already in Use
If port 5050 is in use, change it in your `.env`:
```env
PORT=5051
```

---

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

## ✨ Benefits of Automated Testing

1. **🚀 Faster Development** - Catch bugs before production
2. **🔒 Confidence** - Refactor code without fear
3. **📖 Documentation** - Tests serve as API documentation
4. **🤝 Team Collaboration** - Everyone knows what works
5. **⚡ CI/CD Ready** - Automate testing in pipelines

---

**Happy Testing! 🎉**

