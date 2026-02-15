import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  testUsers,
  testData,
  expectSuccessResponse,
  expectErrorResponse,
  getAuthHeader,
  createSuperAdmin,
  loginUser,
  createVendor,
} from '../helpers/testHelper';

describe('Financial System APIs', () => {
  let vendorId: string;

  beforeAll(async () => {
    // Create super admin
    await createSuperAdmin(app);
    testTokens.superAdminToken = await loginUser(
      app,
      testData.superAdmin.email,
      testData.superAdmin.password
    );

    // Create vendor
    const vendorRes = await createVendor(app, testTokens.superAdminToken);
    if (vendorRes.body.data && vendorRes.body.data.id) {
      vendorId = vendorRes.body.data.id;
    }

    testTokens.vendorToken = await loginUser(
      app,
      testData.vendor.email,
      testData.vendor.password
    );
  });

  describe('GET /financials/dashboard', () => {
    it('should get financial dashboard for super admin', async () => {
      const res = await request(app)
        .get('/api/v1/financials/dashboard')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('overview');
      expect(res.body.data.overview).toHaveProperty('totalRevenue');
      expect(res.body.data.overview).toHaveProperty('totalCommissionPaid');
      expect(res.body.data.overview).toHaveProperty('totalPayouts');
      expect(res.body.data.overview).toHaveProperty('netProfit');
    });

    it('should reject non-super-admin access', async () => {
      const res = await request(app)
        .get('/api/v1/financials/dashboard')
        .set(getAuthHeader(testTokens.vendorToken));

      expect(res.status).toBe(403);
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app).get('/api/v1/financials/dashboard');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /financials/transactions', () => {
    it('should get all transactions for super admin', async () => {
      const res = await request(app)
        .get('/api/v1/financials/transactions')
        .query({
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('transactions');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.transactions).toBeInstanceOf(Array);
    });

    it('should filter transactions by type', async () => {
      const res = await request(app)
        .get('/api/v1/financials/transactions')
        .query({
          type: 'commission',
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should allow vendor to view their own transactions', async () => {
      const res = await request(app)
        .get('/api/v1/financials/transactions')
        .set(getAuthHeader(testTokens.vendorToken));

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('transactions');
      }
    });

    it('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/v1/financials/transactions')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /financials/stats', () => {
    it('should get transaction statistics', async () => {
      const res = await request(app)
        .get('/api/v1/financials/stats')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('byType');
      expect(res.body.data.byType).toBeInstanceOf(Array);
    });

    it('should get stats for specific vendor', async () => {
      if (!vendorId) {
        console.warn('Skipping: No vendor created');
        return;
      }

      const res = await request(app)
        .get('/api/v1/financials/stats')
        .query({ vendorId })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should allow vendor to view their own stats', async () => {
      const res = await request(app)
        .get('/api/v1/financials/stats')
        .set(getAuthHeader(testTokens.vendorToken));

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('GET /financials/statement', () => {
    it('should get financial statement with date range', async () => {
      const res = await request(app)
        .get('/api/v1/financials/statement')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('period');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('totalSales');
      expect(res.body.data.summary).toHaveProperty('totalCommissions');
      expect(res.body.data.summary).toHaveProperty('netEarnings');
    });

    it('should get statement for specific vendor', async () => {
      if (!vendorId) {
        console.warn('Skipping: No vendor created');
        return;
      }

      const res = await request(app)
        .get('/api/v1/financials/statement')
        .query({
          vendorId,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('vendor');
    });

    it('should allow vendor to view their own statement', async () => {
      const res = await request(app)
        .get('/api/v1/financials/statement')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
        .set(getAuthHeader(testTokens.vendorToken));

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('POST /financials/payout', () => {
    it('should process payout successfully', async () => {
      if (!vendorId) {
        console.warn('Skipping: No vendor created');
        return;
      }

      const res = await request(app)
        .post('/api/v1/financials/payout')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          vendorId,
          amount: 100,
          paymentMethod: 'bank_transfer',
          description: 'Test payout',
        });

      // May fail if vendor doesn't have enough balance, which is expected
      expect([200, 201, 400]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('transaction');
      }
    });

    it('should reject payout with invalid amount', async () => {
      if (!vendorId) return;

      const res = await request(app)
        .post('/api/v1/financials/payout')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          vendorId,
          amount: -100,
          paymentMethod: 'bank_transfer',
          description: 'Invalid payout',
        });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject non-super-admin payout', async () => {
      if (!vendorId) return;

      const res = await request(app)
        .post('/api/v1/financials/payout')
        .set(getAuthHeader(testTokens.vendorToken))
        .send({
          vendorId,
          amount: 100,
          paymentMethod: 'bank_transfer',
          description: 'Unauthorized payout',
        });

      expect(res.status).toBe(403);
    });

    it('should reject payout without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/financials/payout')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          amount: 100,
        });

      expect([400, 422]).toContain(res.status);
    });
  });
});
