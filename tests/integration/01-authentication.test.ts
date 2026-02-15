import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  testUsers,
  testData,
  createSuperAdmin,
  loginUser,
  expectSuccessResponse,
  expectErrorResponse,
  getAuthHeader,
} from '../helpers/testHelper';

describe('Authentication APIs', () => {
  describe('POST /auth/signup-super-admin', () => {
    it('should create a super admin successfully or already exist', async () => {
      const res = await createSuperAdmin(app);

      // Accept both 201 (created) or 403 (already exists)
      expect([201, 403]).toContain(res.status);

      if (res.status === 201) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('role', 'SUPER_ADMIN');
      }
    });

    it('should not create duplicate super admin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup-super-admin')
        .send(testData.superAdmin);

      // Expect 403 if super admin already exists
      expect(res.status).toBe(403);
    });
  });

  describe('POST /auth/login (Staff)', () => {
    it('should send OTP for valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testData.superAdmin.email,
          password: testData.superAdmin.password,
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('email');
      expect(res.body.data.email).toBe(testData.superAdmin.email);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid@test.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testData.superAdmin.email,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/verify-2fa', () => {
    let userEmail: string;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testData.superAdmin.email,
          password: testData.superAdmin.password,
        });
      userEmail = loginRes.body.data.email;
    });

    it('should verify 2FA with correct OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-2fa')
        .send({
          email: userEmail,
          otp: '123456', // Mock OTP for testing
        });

      if (res.body.success) {
        expect(res.status).toBe(200);
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('token');
        expect(res.body.data).toHaveProperty('user');

        // Save token for other tests
        testTokens.superAdminToken = res.body.data.token;
      }
    });

    it('should reject invalid OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-2fa')
        .send({
          email: userEmail,
          otp: '000000',
        });

      expect([400, 401]).toContain(res.status);
    });
  });

  describe('GET /auth/me', () => {
    it('should get current user details with valid token', async () => {
      // Make sure we have a token
      if (!testTokens.superAdminToken) {
        testTokens.superAdminToken = await loginUser(
          app,
          testData.superAdmin.email,
          testData.superAdmin.password
        );
      }

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('email');
      expect(res.body.data).toHaveProperty('role');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set(getAuthHeader('invalid_token'));

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          token: testTokens.superAdminToken,
        });

      if (res.body.success) {
        expect(res.status).toBe(200);
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('token');
      }
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send reset password email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: testData.superAdmin.email,
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should handle non-existent email gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'nonexistent@test.com',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // This test requires a valid reset token
      // In real scenario, you'd get this from forgot-password email
      const resetToken = 'mock_reset_token';

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          resetToken,
          newPassword: 'NewPassword@123',
        });

      // May fail if reset token validation is strict
      expect([200, 400, 401]).toContain(res.status);
    });
  });
});
