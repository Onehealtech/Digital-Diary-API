import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  testUsers,
  testData,
  createVendor,
  loginUser,
  expectSuccessResponse,
  expectErrorResponse,
  getAuthHeader,
  uniqueEmail,
} from '../helpers/testHelper';

describe('Vendor Management APIs', () => {
  let vendorId: string;

  beforeAll(async () => {
    // Ensure we have super admin token
    if (!testTokens.superAdminToken) {
      testTokens.superAdminToken = await loginUser(
        app,
        testData.superAdmin.email,
        testData.superAdmin.password
      );
    }
  });

  describe('POST /vendors (Create Vendor)', () => {
    it('should create a vendor successfully', async () => {
      const vendorData = {
        ...testData.vendor,
        email: uniqueEmail('vendor'),
      };

      const res = await request(app)
        .post('/api/v1/vendors')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send(vendorData);

      expect(res.status).toBe(201);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('role', 'VENDOR');

      vendorId = res.body.data.id;
      testUsers.vendor = res.body.data;

      // Login vendor to get token
      testTokens.vendorToken = await loginUser(
        app,
        vendorData.email,
        vendorData.password
      );
    });

    it('should reject vendor creation without super admin token', async () => {
      const res = await request(app)
        .post('/api/v1/vendors')
        .send(testData.vendor);

      expect(res.status).toBe(401);
    });

    it('should reject vendor creation with missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/vendors')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          fullName: 'Incomplete Vendor',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /vendors (Get All Vendors)', () => {
    it('should get all vendors with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/vendors?page=1&limit=20')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('vendors');
      expect(res.body.data).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data.vendors)).toBe(true);
    });

    it('should search vendors by name', async () => {
      const res = await request(app)
        .get('/api/v1/vendors?search=Test')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /vendors/:id (Get Vendor by ID)', () => {
    it('should get vendor details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/${vendorId}`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id', vendorId);
    });

    it('should return 404 for non-existent vendor', async () => {
      const res = await request(app)
        .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /vendors/:id (Update Vendor)', () => {
    it('should update vendor details', async () => {
      const res = await request(app)
        .put(`/api/v1/vendors/${vendorId}`)
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          fullName: 'Updated Vendor Name',
          phoneNumber: '9999999999',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /vendors/:id/wallet (Get Vendor Wallet)', () => {
    it('should get vendor wallet details', async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/${vendorId}/wallet`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('walletBalance');
      expect(res.body.data).toHaveProperty('recentTransactions');
    });
  });

  describe('POST /vendors/:id/wallet/transfer (Transfer Funds)', () => {
    it('should transfer funds to vendor wallet', async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/${vendorId}/wallet/transfer`)
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          amount: 500,
          type: 'credit',
          description: 'Test bonus payment',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('newBalance');
    });
  });

  describe('GET /vendors/:id/sales (Get Sales History)', () => {
    it('should get vendor sales history', async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/${vendorId}/sales?page=1&limit=20`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('sales');
      expect(res.body.data).toHaveProperty('pagination');
    });
  });

  describe('GET /vendors/:id/inventory (Get Vendor Inventory)', () => {
    it('should get vendor inventory', async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/${vendorId}/inventory?page=1&limit=20`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('diaries');
      expect(res.body.data).toHaveProperty('pagination');
    });
  });

  describe('GET /vendors/:id/dashboard (Vendor Dashboard)', () => {
    it('should get vendor dashboard stats', async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/${vendorId}/dashboard`)
        .set(getAuthHeader(testTokens.vendorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('stats');
    });
  });
});
