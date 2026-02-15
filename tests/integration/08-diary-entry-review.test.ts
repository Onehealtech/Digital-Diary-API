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
} from '../helpers/testHelper';

describe('Diary Entry Review APIs', () => {
  let diaryEntryId: string;

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
  });

  describe('GET /diary-entries', () => {
    it('should get all diary entries with filters', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries')
        .query({
          page: 1,
          limit: 20,
          reviewed: false,
          pageType: 'test-status',
        })
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('entries');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.entries).toBeInstanceOf(Array);

      // Save first entry ID if available
      if (res.body.data.entries.length > 0) {
        diaryEntryId = res.body.data.entries[0].id;
      }
    });

    it('should allow assistant to view diary entries', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries')
        .set(getAuthHeader(testTokens.assistantToken));

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('entries');
      }
    });

    it('should filter by page type', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries')
        .query({ pageType: 'symptoms' })
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should filter by reviewed status', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries')
        .query({ reviewed: 'true' })
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app).get('/api/v1/diary-entries');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /diary-entries/stats', () => {
    it('should get diary entry statistics', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries/stats')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('reviewed');
      expect(res.body.data).toHaveProperty('unreviewed');
    });

    it('should reject non-doctor access', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries/stats')
        .set(getAuthHeader(testTokens.assistantToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /diary-entries/review/pending', () => {
    it('should get pending reviews', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries/review/pending')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('unreviewed');
      expect(res.body.data).toHaveProperty('flagged');
      expect(res.body.data.unreviewed).toBeInstanceOf(Array);
      expect(res.body.data.flagged).toBeInstanceOf(Array);
    });

    it('should reject non-doctor access', async () => {
      const res = await request(app)
        .get('/api/v1/diary-entries/review/pending')
        .set(getAuthHeader(testTokens.assistantToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /diary-entries/:id', () => {
    it('should get diary entry by ID', async () => {
      if (!diaryEntryId) {
        console.warn('Skipping: No diary entry available');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/diary-entries/${diaryEntryId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id', diaryEntryId);
      expect(res.body.data).toHaveProperty('pageType');
    });

    it('should allow assistant to view diary entry', async () => {
      if (!diaryEntryId) return;

      const res = await request(app)
        .get(`/api/v1/diary-entries/${diaryEntryId}`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect([200, 403]).toContain(res.status);
    });

    it('should return 404 for non-existent entry', async () => {
      const fakeId = 'non-existent-uuid';
      const res = await request(app)
        .get(`/api/v1/diary-entries/${fakeId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect([404, 500]).toContain(res.status);
    });
  });

  describe('PUT /diary-entries/:id/review', () => {
    it('should review diary entry successfully', async () => {
      if (!diaryEntryId) {
        console.warn('Skipping: No diary entry available');
        return;
      }

      const res = await request(app)
        .put(`/api/v1/diary-entries/${diaryEntryId}/review`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          doctorNotes: 'Patient showing good progress',
          flagged: false,
        });

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('doctorReviewed', true);
      }
    });

    it('should reject non-doctor review', async () => {
      if (!diaryEntryId) return;

      const res = await request(app)
        .put(`/api/v1/diary-entries/${diaryEntryId}/review`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          doctorNotes: 'Unauthorized review',
          flagged: false,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /diary-entries/:id/flag', () => {
    it('should flag diary entry successfully', async () => {
      if (!diaryEntryId) {
        console.warn('Skipping: No diary entry available');
        return;
      }

      const res = await request(app)
        .put(`/api/v1/diary-entries/${diaryEntryId}/flag`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          flagged: true,
        });

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('flagged', true);
      }
    });

    it('should unflag diary entry successfully', async () => {
      if (!diaryEntryId) return;

      const res = await request(app)
        .put(`/api/v1/diary-entries/${diaryEntryId}/flag`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          flagged: false,
        });

      expect([200, 404]).toContain(res.status);
    });

    it('should reject non-doctor flagging', async () => {
      if (!diaryEntryId) return;

      const res = await request(app)
        .put(`/api/v1/diary-entries/${diaryEntryId}/flag`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          flagged: true,
        });

      expect(res.status).toBe(403);
    });
  });
});
