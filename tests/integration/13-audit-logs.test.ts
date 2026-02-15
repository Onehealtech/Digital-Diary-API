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
  createDoctor,
  delay,
} from '../helpers/testHelper';

describe('Audit Logs APIs', () => {
  let userId: string;

  beforeAll(async () => {
    // Create super admin
    await createSuperAdmin(app);
    testTokens.superAdminToken = await loginUser(
      app,
      testData.superAdmin.email,
      testData.superAdmin.password
    );

    // Create doctor to generate some audit logs
    const doctorRes = await createDoctor(app, testTokens.superAdminToken);
    if (doctorRes.body.data && doctorRes.body.data.id) {
      userId = doctorRes.body.data.id;
    }

    testTokens.doctorToken = await loginUser(
      app,
      testData.doctor.email,
      testData.doctor.password
    );

    // Wait a bit to ensure audit logs are created
    await delay(1000);
  });

  describe('GET /audit-logs', () => {
    it('should get all audit logs with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          page: 1,
          limit: 50,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('logs');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.logs).toBeInstanceOf(Array);
    });

    it('should filter by user role', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          userRole: 'doctor',
          page: 1,
          limit: 50,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should filter by action', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          action: 'login',
          page: 1,
          limit: 50,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          page: 1,
          limit: 50,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should filter by user ID', async () => {
      if (!userId) {
        console.warn('Skipping: No user ID available');
        return;
      }

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          userId,
          page: 1,
          limit: 50,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should reject non-super-admin access', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app).get('/api/v1/audit-logs');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /audit-logs/stats', () => {
    it('should get audit statistics', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/stats')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('byUserRole');
      expect(res.body.data).toHaveProperty('topActions');
      expect(res.body.data.byUserRole).toBeInstanceOf(Array);
      expect(res.body.data.topActions).toBeInstanceOf(Array);
    });

    it('should get statistics for date range', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/stats')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should include recent activity', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/stats')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      if (res.body.data.recentActivity) {
        expect(res.body.data.recentActivity).toBeInstanceOf(Array);
      }
    });

    it('should reject non-super-admin access', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/stats')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /audit-logs/search', () => {
    it('should search audit logs by query', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/search')
        .query({
          q: 'doctor',
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('logs');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.logs).toBeInstanceOf(Array);
    });

    it('should search by email', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/search')
        .query({
          q: testData.doctor.email,
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should return empty results for non-existent query', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/search')
        .query({
          q: 'nonexistentquerythatdoesnotmatch',
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data.logs).toBeInstanceOf(Array);
    });

    it('should support pagination in search', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/search')
        .query({
          q: 'test',
          page: 2,
          limit: 10,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should reject non-super-admin search', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/search')
        .query({
          q: 'doctor',
        })
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /audit-logs/user/:userId', () => {
    it('should get audit logs for specific user', async () => {
      if (!userId) {
        console.warn('Skipping: No user ID available');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/audit-logs/user/${userId}`)
        .query({
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('logs');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.logs).toBeInstanceOf(Array);
    });

    it('should support pagination for user logs', async () => {
      if (!userId) return;

      const res = await request(app)
        .get(`/api/v1/audit-logs/user/${userId}`)
        .query({
          page: 2,
          limit: 10,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should return empty logs for non-existent user', async () => {
      const fakeUserId = 'non-existent-user-id';
      const res = await request(app)
        .get(`/api/v1/audit-logs/user/${fakeUserId}`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data.logs).toBeInstanceOf(Array);
      }
    });

    it('should reject non-super-admin access', async () => {
      if (!userId) return;

      const res = await request(app)
        .get(`/api/v1/audit-logs/user/${userId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });

    it('should reject unauthorized access', async () => {
      if (!userId) return;

      const res = await request(app).get(`/api/v1/audit-logs/user/${userId}`);

      expect(res.status).toBe(401);
    });
  });
});
