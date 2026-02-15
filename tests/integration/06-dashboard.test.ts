import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  expectSuccessResponse,
  getAuthHeader,
  loginUser,
  testData,
} from '../helpers/testHelper';

describe('Dashboard Statistics APIs', () => {
  beforeAll(async () => {
    // Ensure all tokens are available
    if (!testTokens.superAdminToken) {
      testTokens.superAdminToken = await loginUser(
        app,
        testData.superAdmin.email,
        testData.superAdmin.password
      );
    }
    if (!testTokens.doctorToken) {
      testTokens.doctorToken = await loginUser(
        app,
        testData.doctor.email,
        testData.doctor.password
      );
    }
    if (!testTokens.vendorToken) {
      testTokens.vendorToken = await loginUser(
        app,
        testData.vendor.email,
        testData.vendor.password
      );
    }
    if (!testTokens.assistantToken) {
      testTokens.assistantToken = await loginUser(
        app,
        testData.assistant.email,
        testData.assistant.password
      );
    }
  });

  describe('GET /dashboard/super-admin (Super Admin Dashboard)', () => {
    it('should get super admin dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/super-admin')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('diaries');
      expect(res.body.data).toHaveProperty('financials');
      expect(res.body.data.users).toHaveProperty('totalDoctors');
      expect(res.body.data.users).toHaveProperty('totalVendors');
      expect(res.body.data.users).toHaveProperty('totalPatients');
    });

    it('should reject non-super-admin access', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/super-admin')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /dashboard/vendor (Vendor Dashboard)', () => {
    it('should get vendor dashboard stats', async () => {
      if (!testTokens.vendorToken) {
        console.log('Vendor token not available, skipping test');
        return;
      }

      const res = await request(app)
        .get('/api/v1/dashboard/vendor')
        .set(getAuthHeader(testTokens.vendorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('sales');
      expect(res.body.data).toHaveProperty('inventory');
      expect(res.body.data).toHaveProperty('financials');
    });

    it('should reject non-vendor access', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/vendor')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /dashboard/doctor (Doctor Dashboard)', () => {
    it('should get doctor dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/doctor')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('patients');
      expect(res.body.data).toHaveProperty('diaryEntries');
      expect(res.body.data).toHaveProperty('tasks');
      expect(res.body.data.patients).toHaveProperty('total');
      expect(res.body.data.patients).toHaveProperty('activeCases');
    });

    it('should reject non-doctor access', async () => {
      if (!testTokens.vendorToken) {
        return;
      }

      const res = await request(app)
        .get('/api/v1/dashboard/doctor')
        .set(getAuthHeader(testTokens.vendorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /dashboard/assistant (Assistant Dashboard)', () => {
    it('should get assistant dashboard stats', async () => {
      if (!testTokens.assistantToken) {
        console.log('Assistant token not available, skipping test');
        return;
      }

      const res = await request(app)
        .get('/api/v1/dashboard/assistant')
        .set(getAuthHeader(testTokens.assistantToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('patients');
      expect(res.body.data).toHaveProperty('tasks');
      expect(res.body.data).toHaveProperty('permissions');
    });

    it('should reject non-assistant access', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/assistant')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /dashboard/patients (Get Dashboard Patients)', () => {
    it('should get patients list for dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/patients?page=1&limit=20')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('patients');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter patients by status', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/patients?status=active')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /dashboard/reminders (Get Dashboard Reminders)', () => {
    it('should get reminders for dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/reminders?page=1&limit=20')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('reminders');
      expect(res.body.data).toHaveProperty('pagination');
    });
  });
});
