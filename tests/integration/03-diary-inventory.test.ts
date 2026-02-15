import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  testUsers,
  expectSuccessResponse,
  getAuthHeader,
  loginUser,
  testData,
} from '../helpers/testHelper';

describe('Diary Inventory APIs', () => {
  let generatedDiaryId: string;
  let diaryRequestId: string;

  beforeAll(async () => {
    if (!testTokens.superAdminToken) {
      testTokens.superAdminToken = await loginUser(
        app,
        testData.superAdmin.email,
        testData.superAdmin.password
      );
    }
  });

  describe('POST /generated-diaries/generate (Generate Diaries)', () => {
    it('should generate diaries with QR codes', async () => {
      const res = await request(app)
        .post('/api/v1/generated-diaries/generate')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          quantity: 10,
          diaryType: 'breast-cancer-treatment',
          batchCode: 'TEST',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('count', 10);
      expect(res.body.data).toHaveProperty('diaryIds');
      expect(Array.isArray(res.body.data.diaryIds)).toBe(true);

      generatedDiaryId = res.body.data.diaryIds[0];
    });

    it('should reject invalid quantity', async () => {
      const res = await request(app)
        .post('/api/v1/generated-diaries/generate')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          quantity: 600, // Max is 500
          diaryType: 'breast-cancer-treatment',
          batchCode: 'TEST',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /generated-diaries (Get All Generated Diaries)', () => {
    it('should get all generated diaries with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/generated-diaries?page=1&limit=20')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('diaries');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter diaries by status', async () => {
      const res = await request(app)
        .get('/api/v1/generated-diaries?status=unassigned')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /generated-diaries/:id (Get Diary by ID)', () => {
    it('should get diary details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/generated-diaries/${generatedDiaryId}`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('qrCodeUrl');
    });
  });

  describe('PUT /generated-diaries/:id/assign (Assign Diary)', () => {
    it('should assign diary to vendor', async () => {
      if (!testUsers.vendor?.id) {
        console.log('Vendor not created yet, skipping test');
        return;
      }

      const res = await request(app)
        .put(`/api/v1/generated-diaries/${generatedDiaryId}/assign`)
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          vendorId: testUsers.vendor.id,
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('status', 'assigned');
    });
  });

  describe('PUT /generated-diaries/bulk-assign (Bulk Assign)', () => {
    it('should bulk assign diaries to vendor', async () => {
      if (!testUsers.vendor?.id) {
        console.log('Vendor not created yet, skipping test');
        return;
      }

      const res = await request(app)
        .put('/api/v1/generated-diaries/bulk-assign')
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          vendorId: testUsers.vendor.id,
          quantity: 5,
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('count');
    });
  });

  describe('PUT /generated-diaries/:id/unassign (Unassign Diary)', () => {
    it('should unassign diary from vendor', async () => {
      const res = await request(app)
        .put(`/api/v1/generated-diaries/${generatedDiaryId}/unassign`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('status', 'unassigned');
    });
  });

  describe('POST /diary-requests (Create Diary Request)', () => {
    it('should create diary request as vendor', async () => {
      if (!testTokens.vendorToken) {
        console.log('Vendor token not available, skipping test');
        return;
      }

      const res = await request(app)
        .post('/api/v1/diary-requests')
        .set(getAuthHeader(testTokens.vendorToken))
        .send({
          quantity: 10,
          reason: 'Stock running low',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('status', 'pending');

      diaryRequestId = res.body.data.id;
    });
  });

  describe('GET /diary-requests (Get All Diary Requests)', () => {
    it('should get all diary requests', async () => {
      const res = await request(app)
        .get('/api/v1/diary-requests?page=1&limit=20')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('requests');
    });
  });

  describe('PUT /diary-requests/:id/approve (Approve Request)', () => {
    it('should approve diary request', async () => {
      if (!diaryRequestId) {
        console.log('No diary request to approve, skipping test');
        return;
      }

      const res = await request(app)
        .put(`/api/v1/diary-requests/${diaryRequestId}/approve`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('PUT /diary-requests/:id/reject (Reject Request)', () => {
    it('should reject diary request', async () => {
      // Create another request to reject
      if (!testTokens.vendorToken) {
        return;
      }

      const createRes = await request(app)
        .post('/api/v1/diary-requests')
        .set(getAuthHeader(testTokens.vendorToken))
        .send({
          quantity: 5,
          reason: 'Need more stock',
        });

      const requestId = createRes.body.data?.id;

      if (!requestId) {
        return;
      }

      const res = await request(app)
        .put(`/api/v1/diary-requests/${requestId}/reject`)
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          reason: 'Insufficient inventory',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });
});
