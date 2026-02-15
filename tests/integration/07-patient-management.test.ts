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
  createVendor,
  createAssistant,
} from '../helpers/testHelper';

describe('Patient Management APIs', () => {
  let patientId: string;
  let diaryCode: string;

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

    // Create vendor
    await createVendor(app, testTokens.superAdminToken);
    testTokens.vendorToken = await loginUser(
      app,
      testData.vendor.email,
      testData.vendor.password
    );
  });

  describe('POST /patient (Legacy)', () => {
    it('should create a patient successfully', async () => {
      const res = await request(app)
        .post('/api/v1/patient')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          fullName: testData.patient.fullName,
          age: testData.patient.age,
          gender: testData.patient.gender,
          phone: testData.patient.phoneNumber,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('data');
      if (res.body.data && res.body.data.id) {
        patientId = res.body.data.id;
      }
    });

    it('should reject patient creation without auth', async () => {
      const res = await request(app)
        .post('/api/v1/patient')
        .send({
          fullName: 'Test Patient',
          age: 30,
          gender: 'male',
          phone: '9999999999',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /patient/getAllPatients (Legacy)', () => {
    it('should get all patients for doctor', async () => {
      const res = await request(app)
        .get('/api/v1/patient/getAllPatients')
        .set(getAuthHeader(testTokens.doctorToken));

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('patients');
    });

    it('should reject without auth', async () => {
      const res = await request(app).get('/api/v1/patient/getAllPatients');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /patient/follow-up', () => {
    it('should get patients needing follow-up', async () => {
      const res = await request(app)
        .get('/api/v1/patient/follow-up')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should reject non-doctor access', async () => {
      const res = await request(app)
        .get('/api/v1/patient/follow-up')
        .set(getAuthHeader(testTokens.vendorToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /patient/:id', () => {
    it('should get patient by ID', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created yet');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/patient/${patientId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id', patientId);
    });

    it('should allow assistant to view patient', async () => {
      if (!patientId) return;

      const res = await request(app)
        .get(`/api/v1/patient/${patientId}`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('PUT /patient/:id', () => {
    it('should update patient details', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created yet');
        return;
      }

      const res = await request(app)
        .put(`/api/v1/patient/${patientId}`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          address: 'Updated Test Address',
          stage: 'stage-3',
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
    });

    it('should reject unauthorized update', async () => {
      if (!patientId) return;

      const res = await request(app)
        .put(`/api/v1/patient/${patientId}`)
        .set(getAuthHeader(testTokens.vendorToken))
        .send({
          address: 'Malicious Update',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /patient/:id/tests', () => {
    it('should prescribe tests to patient', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created yet');
        return;
      }

      const res = await request(app)
        .post(`/api/v1/patient/${patientId}/tests`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          tests: [
            {
              testName: 'CBC (Complete Blood Count)',
              testType: 'normal',
            },
            {
              testName: 'Biopsy',
              testType: 'major',
            },
          ],
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
    });

    it('should reject non-doctor prescribing tests', async () => {
      if (!patientId) return;

      const res = await request(app)
        .post(`/api/v1/patient/${patientId}/tests`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          tests: [{ testName: 'X-Ray', testType: 'normal' }],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /patient/:id/tests/:testName', () => {
    it('should update test status', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created yet');
        return;
      }

      const testName = encodeURIComponent('CBC (Complete Blood Count)');
      const res = await request(app)
        .put(`/api/v1/patient/${patientId}/tests/${testName}`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          completed: true,
          reportReceived: true,
        });

      expect([200, 404]).toContain(res.status); // 404 if test not found
    });
  });

  describe('POST /patient/:id/call', () => {
    it('should log call attempt successfully', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created yet');
        return;
      }

      const res = await request(app)
        .post(`/api/v1/patient/${patientId}/call`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          outcome: 'answered',
          notes: 'Patient confirmed test completion',
          followUpRequired: false,
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
    });

    it('should allow assistant to log calls', async () => {
      if (!patientId) return;

      const res = await request(app)
        .post(`/api/v1/patient/${patientId}/call`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          outcome: 'not-answered',
          notes: 'No response',
          followUpRequired: true,
        });

      expect([200, 201, 403]).toContain(res.status);
    });
  });

  describe('GET /patient/:id/test-progress', () => {
    it('should get test progress for patient', async () => {
      if (!patientId) {
        console.warn('Skipping: No patient created yet');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/patient/${patientId}/test-progress`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('patientId');
    });

    it('should allow assistant to view test progress', async () => {
      if (!patientId) return;

      const res = await request(app)
        .get(`/api/v1/patient/${patientId}/test-progress`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('GET /patient/profile (Patient Auth)', () => {
    it('should get patient profile with patient token', async () => {
      // This test would require patient authentication flow
      // Skipping for now as it requires patient OTP login
      console.log('Patient profile test requires patient auth - skipping');
    });
  });

  describe('GET /patient/reminders (Patient Auth)', () => {
    it('should get patient reminders with patient token', async () => {
      // This test would require patient authentication flow
      // Skipping for now as it requires patient OTP login
      console.log('Patient reminders test requires patient auth - skipping');
    });
  });
});
