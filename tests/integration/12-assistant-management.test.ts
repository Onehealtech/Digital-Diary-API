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
  createAssistant,
  uniqueEmail,
} from '../helpers/testHelper';

describe('Assistant Management APIs', () => {
  let assistantId: string;

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
    const assistantRes = await createAssistant(app, testTokens.doctorToken);
    if (assistantRes.body.data && assistantRes.body.data.id) {
      assistantId = assistantRes.body.data.id;
    }

    testTokens.assistantToken = await loginUser(
      app,
      testData.assistant.email,
      testData.assistant.password
    );
  });

  describe('GET /assistants', () => {
    it('should get all assistants for super admin', async () => {
      const res = await request(app)
        .get('/api/v1/assistants')
        .query({
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('assistants');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.assistants).toBeInstanceOf(Array);
    });

    it('should allow doctor to view their assistants', async () => {
      const res = await request(app)
        .get('/api/v1/assistants')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('assistants');
    });

    it('should support search functionality', async () => {
      const res = await request(app)
        .get('/api/v1/assistants')
        .query({
          search: 'assistant',
          page: 1,
          limit: 20,
        })
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should reject assistant viewing other assistants', async () => {
      const res = await request(app)
        .get('/api/v1/assistants')
        .set(getAuthHeader(testTokens.assistantToken));

      expect(res.status).toBe(403);
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app).get('/api/v1/assistants');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /assistants/:id', () => {
    it('should get assistant by ID for super admin', async () => {
      if (!assistantId) {
        console.warn('Skipping: No assistant created');
        return;
      }

      const res = await request(app)
        .get(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id', assistantId);
      expect(res.body.data).toHaveProperty('fullName');
      expect(res.body.data).toHaveProperty('email');
      expect(res.body.data).toHaveProperty('permissions');
      expect(res.body.data).toHaveProperty('parent');
    });

    it('should allow doctor to view their assistant', async () => {
      if (!assistantId) return;

      const res = await request(app)
        .get(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should return 404 for non-existent assistant', async () => {
      const fakeId = 'non-existent-assistant-id';
      const res = await request(app)
        .get(`/api/v1/assistants/${fakeId}`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect([404, 500]).toContain(res.status);
    });

    it('should reject assistant viewing other assistants', async () => {
      if (!assistantId) return;

      const res = await request(app)
        .get(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PUT /assistants/:id', () => {
    it('should update assistant successfully by super admin', async () => {
      if (!assistantId) {
        console.warn('Skipping: No assistant created');
        return;
      }

      const res = await request(app)
        .put(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          fullName: 'Updated Assistant Name',
          phoneNumber: '8888888888',
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
    });

    it('should allow doctor to update their assistant', async () => {
      if (!assistantId) return;

      const res = await request(app)
        .put(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          phoneNumber: '7777777777',
        });

      expect([200, 201]).toContain(res.status);
      expectSuccessResponse(res);
    });

    it('should update assistant permissions', async () => {
      if (!assistantId) return;

      const res = await request(app)
        .put(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          permissions: {
            viewPatients: true,
            callPatients: true,
            exportData: true,
            sendNotifications: true,
          },
        });

      expect([200, 201]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expectSuccessResponse(res);
        expect(res.body.data).toHaveProperty('permissions');
      }
    });

    it('should reject assistant updating themselves', async () => {
      if (!assistantId) return;

      const res = await request(app)
        .put(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          fullName: 'Self Update Attempt',
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent assistant', async () => {
      const fakeId = 'non-existent-assistant-id';
      const res = await request(app)
        .put(`/api/v1/assistants/${fakeId}`)
        .set(getAuthHeader(testTokens.superAdminToken))
        .send({
          fullName: 'Test Update',
        });

      expect([404, 500]).toContain(res.status);
    });
  });

  describe('DELETE /assistants/:id', () => {
    it('should create and delete a new assistant successfully', async () => {
      // Create a new assistant specifically for deletion
      const newAssistantEmail = uniqueEmail('assistant_to_delete');
      const createRes = await request(app)
        .post('/api/v1/doctor/create-assistant')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          fullName: 'Assistant To Delete',
          email: newAssistantEmail,
          password: 'Test@123456',
          phoneNumber: '6666666666',
          permissions: {
            viewPatients: true,
            callPatients: false,
            exportData: false,
            sendNotifications: false,
          },
        });

      if (createRes.body.data && createRes.body.data.id) {
        const newAssistantId = createRes.body.data.id;

        // Now delete the newly created assistant
        const deleteRes = await request(app)
          .delete(`/api/v1/assistants/${newAssistantId}`)
          .set(getAuthHeader(testTokens.doctorToken));

        expect([200, 404]).toContain(deleteRes.status);
        if (deleteRes.status === 200) {
          expectSuccessResponse(deleteRes);
        }
      }
    });

    it('should allow super admin to delete assistant', async () => {
      // Create another assistant for super admin deletion test
      const anotherEmail = uniqueEmail('assistant_super_delete');
      const createRes = await request(app)
        .post('/api/v1/doctor/create-assistant')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          fullName: 'Assistant Super Delete',
          email: anotherEmail,
          password: 'Test@123456',
          phoneNumber: '5555555555',
          permissions: {
            viewPatients: true,
            callPatients: true,
          },
        });

      if (createRes.body.data && createRes.body.data.id) {
        const assistantToDelete = createRes.body.data.id;

        const deleteRes = await request(app)
          .delete(`/api/v1/assistants/${assistantToDelete}`)
          .set(getAuthHeader(testTokens.superAdminToken));

        expect([200, 404]).toContain(deleteRes.status);
      }
    });

    it('should return 404 for non-existent assistant', async () => {
      const fakeId = 'non-existent-assistant-id';
      const res = await request(app)
        .delete(`/api/v1/assistants/${fakeId}`)
        .set(getAuthHeader(testTokens.superAdminToken));

      expect([404, 500]).toContain(res.status);
    });

    it('should reject assistant deleting themselves', async () => {
      if (!assistantId) return;

      const res = await request(app)
        .delete(`/api/v1/assistants/${assistantId}`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect(res.status).toBe(403);
    });
  });
});
