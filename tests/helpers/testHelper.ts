import request from 'supertest';

export interface TestTokens {
  superAdminToken: string;
  doctorToken: string;
  vendorToken: string;
  assistantToken: string;
  patientToken: string;
}

export interface TestUsers {
  superAdmin: any;
  doctor: any;
  vendor: any;
  assistant: any;
  patient: any;
}

export const testTokens: TestTokens = {
  superAdminToken: '',
  doctorToken: '',
  vendorToken: '',
  assistantToken: '',
  patientToken: '',
};

export const testUsers: TestUsers = {
  superAdmin: null,
  doctor: null,
  vendor: null,
  assistant: null,
  patient: null,
};

// Test data
export const testData = {
  superAdmin: {
    fullName: 'Test Super Admin',
    email: 'superadmin@test.com',
    password: 'Test@123456',
    phoneNumber: '1234567890',
  },
  doctor: {
    fullName: 'Dr. Test Doctor',
    email: 'doctor@test.com',
    password: 'Test@123456',
    phoneNumber: '1234567891',
  },
  vendor: {
    fullName: 'Test Vendor',
    email: 'vendor@test.com',
    password: 'Test@123456',
    phoneNumber: '1234567892',
    businessName: 'Test Medical Store',
    businessAddress: '123 Test Street, Test City',
    licenseNumber: 'LIC123456',
    gstNumber: 'GST123456',
    bankDetails: {
      accountNumber: '1234567890',
      ifscCode: 'TEST0001234',
      accountHolderName: 'Test Vendor',
    },
  },
  assistant: {
    fullName: 'Test Assistant',
    email: 'assistant@test.com',
    password: 'Test@123456',
    phoneNumber: '1234567893',
    permissions: {
      viewPatients: true,
      callPatients: true,
      exportData: false,
      sendNotifications: true,
    },
  },
  patient: {
    fullName: 'Test Patient',
    phoneNumber: '9876543210',
    age: 45,
    gender: 'female',
    address: 'Test Patient Address',
    diaryType: 'breast-cancer-treatment',
    stage: 'stage-2',
  },
};

// Helper function to get auth header
export const getAuthHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

// Helper to create super admin
export const createSuperAdmin = async (app: any) => {
  const res = await request(app)
    .post('/api/v1/auth/signup-super-admin')
    .send(testData.superAdmin);

  // If super admin already exists (403), that's okay for testing
  if (res.body.success) {
    testUsers.superAdmin = res.body.data;
  } else if (res.status === 403) {
    // Super admin already exists, this is fine for testing
    console.log('ℹ️  Super Admin already exists, proceeding with tests...');
  }
  return res;
};

// Helper to login and get token
export const loginUser = async (app: any, email: string, password: string) => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (!loginRes.body.success) {
    console.error('Login failed:', loginRes.body);
    throw new Error(`Login failed: ${loginRes.body.message || 'Unknown error'}`);
  }

  // Login returns email, not tempToken
  const userEmail = loginRes.body.data.email;

  // For testing, we'll use a mock OTP (123456)
  const verifyRes = await request(app)
    .post('/api/v1/auth/verify-2fa')
    .send({ email: userEmail, otp: '123456' });

  if (!verifyRes.body.success) {
    console.error('2FA verification failed:', verifyRes.body);
    throw new Error(`2FA failed: ${verifyRes.body.message || 'Unknown error'}`);
  }

  return verifyRes.body.data?.token || '';
};

// Helper to create doctor
export const createDoctor = async (app: any, superAdminToken: string) => {
  const res = await request(app)
    .post('/api/v1/admin/create-staff')
    .set(getAuthHeader(superAdminToken))
    .send(testData.doctor);

  if (res.body.success || res.body.data) {
    testUsers.doctor = res.body.data;
  }
  return res;
};

// Helper to create vendor
export const createVendor = async (app: any, superAdminToken: string) => {
  const res = await request(app)
    .post('/api/v1/vendors')
    .set(getAuthHeader(superAdminToken))
    .send(testData.vendor);

  if (res.body.success) {
    testUsers.vendor = res.body.data;
  }
  return res;
};

// Helper to create assistant
export const createAssistant = async (app: any, doctorToken: string) => {
  const res = await request(app)
    .post('/api/v1/doctor/create-assistant')
    .set(getAuthHeader(doctorToken))
    .send(testData.assistant);

  if (res.body.success || res.body.data) {
    testUsers.assistant = res.body.data;
  }
  return res;
};

// Helper to wait for async operations
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Helper to generate random string
export const randomString = (length: number = 8) => {
  return Math.random().toString(36).substring(2, length + 2);
};

// Helper to generate unique email
export const uniqueEmail = (prefix: string = 'test') => {
  return `${prefix}_${randomString()}@test.com`;
};

// Helper to check response structure
export const expectSuccessResponse = (response: any) => {
  expect(response.body).toHaveProperty('success');
  expect(response.body).toHaveProperty('message');
  expect(response.body.success).toBe(true);
};

export const expectErrorResponse = (response: any) => {
  expect(response.body).toHaveProperty('success');
  expect(response.body).toHaveProperty('message');
  expect(response.body.success).toBe(false);
};

// Cleanup helper
export const cleanupTestData = async () => {
  // This will be implemented based on your database cleanup needs
  // For now, it's a placeholder
  console.log('Cleaning up test data...');
};
