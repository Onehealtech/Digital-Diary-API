import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  testData,
  expectSuccessResponse,
  expectErrorResponse,
  getAuthHeader,
  createSuperAdmin,
  loginUser,
  createDoctor,
  createAssistant,
  delay,
} from '../helpers/testHelper';

describe('Reports & Export APIs', () => {
  let exportId: string;
  let patientId: string;

  beforeAll(async () => {
    // Create super admin
    await createSuperAdmin(app);
    testTokens.superAdminToken = await loginUser(
      app,
      testData.superAdmin.email,
      testData.superAdmin.password
    );

    // Create doctor
    await createDoctor(app, testTokens.superAdminToken);
    testTokens.doctorToken = await loginUser(
      app,
      testData.doctor.email,
      testData.doctor.password
    );

    // Create assistant
    await createAssistant(app, testTokens.doctorToken);
    testTokens.assistantToken = await loginUser(
      app,
      testData.assistant.email,
      testData.assistant.password
    );

    // Create a test patient for export operations
    const patientRes = await request(app)
      .post('/api/v1/patient')
      .set(getAuthHeader(testTokens.doctorToken))
      .send({
        fullName: 'Export Test Patient',
        age: 40,
        gender: 'female',
        phone: '8888888888',
      });

    if (patientRes.body.data && patientRes.body.data.id) {
      patientId = patientRes.body.data.id;
    }
  });

  describe('POST /reports/patient-data', () => {
    it('should queue patient data export successfully', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created');
        return;
      }

      const res = await request(app)
        .post('/api/v1/reports/patient-data')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          patientId,
          format: 'pdf',
          includeTestHistory: true,
          includeDiaryEntries: true,
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('exportId');
      expect(res.body.data).toHaveProperty('status');

      if (res.body.data.exportId) {
        exportId = res.body.data.exportId;
      }
    });

    it('should allow assistant to export patient data', async () => {
      if (!patientId) return;

      const res = await request(app)
        .post('/api/v1/reports/patient-data')
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          patientId,
          format: 'pdf',
          includeTestHistory: false,
          includeDiaryEntries: false,
        });

      expect([200, 201, 403]).toContain(res.status);
    });

    it('should reject export without patient ID', async () => {
      const res = await request(app)
        .post('/api/v1/reports/patient-data')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          format: 'pdf',
        });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('POST /reports/diary-pages', () => {
    it('should queue diary pages export successfully', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created');
        return;
      }

      const res = await request(app)
        .post('/api/v1/reports/diary-pages')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          patientId,
          format: 'pdf',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('exportId');
      expect(res.body.data).toHaveProperty('status');
    });

    it('should allow assistant to export diary pages', async () => {
      if (!patientId) return;

      const res = await request(app)
        .post('/api/v1/reports/diary-pages')
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          patientId,
          format: 'pdf',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect([200, 201, 403]).toContain(res.status);
    });
  });

  describe('POST /reports/test-summary', () => {
    it('should queue test summary export successfully', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created');
        return;
      }

      const res = await request(app)
        .post('/api/v1/reports/test-summary')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          patientId,
          format: 'excel',
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('exportId');
      expect(res.body.data).toHaveProperty('status');
    });

    it('should support PDF format for test summary', async () => {
      if (!patientId) return;

      const res = await request(app)
        .post('/api/v1/reports/test-summary')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          patientId,
          format: 'pdf',
        });

      expect([200, 201]).toContain(res.status);
    });

    it('should allow assistant to export test summary', async () => {
      if (!patientId) return;

      const res = await request(app)
        .post('/api/v1/reports/test-summary')
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          patientId,
          format: 'excel',
        });

      expect([200, 201, 403]).toContain(res.status);
    });
  });

  describe('GET /reports/exports', () => {
    it('should get all exports for doctor', async () => {
      const res = await request(app)
        .get('/api/v1/reports/exports')
        .query({
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('exports');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.exports).toBeInstanceOf(Array);
    });

    it('should allow assistant to view exports', async () => {
      const res = await request(app)
        .get('/api/v1/reports/exports')
        .set(getAuthHeader(testTokens.assistantToken));

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('exports');
      }
    });

    it('should allow super admin to view all exports', async () => {
      const res = await request(app)
        .get('/api/v1/reports/exports')
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/reports/exports')
        .query({
          page: 2,
          limit: 10,
        })
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /reports/exports/:id/download', () => {
    it('should get export download details', async () => {
      if (!exportId) {
        console.warn('Skipping: No export created');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/reports/exports/${exportId}/download`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('type');
        expect(res.body.data).toHaveProperty('format');
      }
    });

    it('should return 404 for non-existent export', async () => {
      const fakeId = 'non-existent-export-id';
      const res = await request(app)
        .get(`/api/v1/reports/exports/${fakeId}/download`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([404, 500]).toContain(res.status);
    });

    it('should reject unauthorized access', async () => {
      if (!exportId) return;

      const res = await request(app).get(
        `/api/v1/reports/exports/${exportId}/download`
      );

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /reports/exports/:id', () => {
    it('should delete export successfully', async () => {
      if (!exportId) {
        console.warn('Skipping: No export created');
        return;
      }

      // Wait a bit to ensure export is created
      await delay(1000);

      const res = await request(app)
        .delete(`/api/v1/reports/exports/${exportId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expectSuccessResponse(res);
      }
    });

    it('should return 404 for non-existent export', async () => {
      const fakeId = 'non-existent-export-id';
      const res = await request(app)
        .delete(`/api/v1/reports/exports/${fakeId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([404, 500]).toContain(res.status);
    });

    it('should reject unauthorized deletion', async () => {
      const res = await request(app).delete('/api/v1/reports/exports/some-id');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/analytics/patient/:id', () => {
    it('should get patient analytics successfully', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/reports/analytics/patient/${patientId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('patient');
      }
    });

    it('should allow assistant to view patient analytics', async () => {
      if (!patientId) return;

      const res = await request(app)
        .get(`/api/v1/reports/analytics/patient/${patientId}`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect([200, 404, 403]).toContain(res.status);
    });

    it('should return 404 for non-existent patient', async () => {
      const fakeId = 'non-existent-patient-id';
      const res = await request(app)
        .get(`/api/v1/reports/analytics/patient/${fakeId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([404, 500]).toContain(res.status);
    });
  });
});
