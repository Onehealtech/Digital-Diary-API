import request from 'supertest';
import app from '../../src/index';
import {
  testTokens,
  testUsers,
  expectSuccessResponse,
  getAuthHeader,
  loginUser,
  testData,
  createDoctor,
  createAssistant,
} from '../helpers/testHelper';

describe('Task Management APIs', () => {
  let taskId: string;

  beforeAll(async () => {
    // Ensure we have required tokens
    if (!testTokens.superAdminToken) {
      testTokens.superAdminToken = await loginUser(
        app,
        testData.superAdmin.email,
        testData.superAdmin.password
      );
    }

    // Create doctor if not exists
    if (!testUsers.doctor) {
      await createDoctor(app, testTokens.superAdminToken);
      testTokens.doctorToken = await loginUser(
        app,
        testData.doctor.email,
        testData.doctor.password
      );
    }

    // Create assistant if not exists
    if (!testUsers.assistant && testTokens.doctorToken) {
      await createAssistant(app, testTokens.doctorToken);
      testTokens.assistantToken = await loginUser(
        app,
        testData.assistant.email,
        testData.assistant.password
      );
    }
  });

  describe('POST /tasks (Create Task)', () => {
    it('should create a task as doctor', async () => {
      if (!testTokens.doctorToken || !testUsers.assistant) {
        console.log('Doctor or Assistant not available, skipping test');
        return;
      }

      const res = await request(app)
        .post('/api/v1/tasks')
        .set(getAuthHeader(testTokens.doctorToken))
        .send({
          assignedTo: testUsers.assistant.id,
          title: 'Review patient diary entries',
          description: 'Review entries for patients needing attention',
          taskType: 'review-entries',
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          relatedPatients: [],
        });

      expect(res.status).toBe(201);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('status', 'pending');

      taskId = res.body.data.id;
    });

    it('should reject task creation by non-doctor', async () => {
      if (!testTokens.assistantToken) {
        return;
      }

      const res = await request(app)
        .post('/api/v1/tasks')
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          assignedTo: testUsers.doctor?.id,
          title: 'Unauthorized task',
          taskType: 'review-entries',
          priority: 'medium',
          dueDate: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /tasks (Get All Tasks)', () => {
    it('should get all tasks for doctor', async () => {
      if (!testTokens.doctorToken) {
        return;
      }

      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=20')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('tasks');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter tasks by status', async () => {
      if (!testTokens.doctorToken) {
        return;
      }

      const res = await request(app)
        .get('/api/v1/tasks?status=pending')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should filter tasks by priority', async () => {
      if (!testTokens.doctorToken) {
        return;
      }

      const res = await request(app)
        .get('/api/v1/tasks?priority=high')
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });
  });

  describe('GET /tasks/:id (Get Task by ID)', () => {
    it('should get task details', async () => {
      if (!testTokens.doctorToken || !taskId) {
        return;
      }

      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id', taskId);
      expect(res.body.data).toHaveProperty('title');
    });
  });

  describe('PUT /tasks/:id (Update Task)', () => {
    it('should update task status', async () => {
      if (!testTokens.assistantToken || !taskId) {
        return;
      }

      const res = await request(app)
        .put(`/api/v1/tasks/${taskId}`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          status: 'in-progress',
          notes: 'Started working on the task',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('status', 'in-progress');
    });
  });

  describe('PUT /tasks/:id/complete (Complete Task)', () => {
    it('should mark task as complete', async () => {
      if (!testTokens.assistantToken || !taskId) {
        return;
      }

      const res = await request(app)
        .put(`/api/v1/tasks/${taskId}/complete`)
        .set(getAuthHeader(testTokens.assistantToken))
        .send({
          notes: 'Task completed successfully',
        });

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
      expect(res.body.data).toHaveProperty('status', 'completed');
    });
  });

  describe('DELETE /tasks/:id (Delete Task)', () => {
    it('should delete task as doctor', async () => {
      if (!testTokens.doctorToken || !taskId) {
        return;
      }

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set(getAuthHeader(testTokens.doctorToken));

      expect(res.status).toBe(200);
      expectSuccessResponse(res);
    });

    it('should reject task deletion by assistant', async () => {
      if (!testTokens.assistantToken) {
        return;
      }

      const res = await request(app)
        .delete(`/api/v1/tasks/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeader(testTokens.assistantToken));

      expect(res.status).toBe(403);
    });
  });
});
