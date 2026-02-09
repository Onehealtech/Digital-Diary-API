# OneHeal Enterprise Backend - API Reference

**Base URL**: `http://localhost:5050/api/v1`

---

## 🔐 Authentication Endpoints

### 1. Staff Login (Step 1)
**Endpoint**: `POST /auth/login`  
**Access**: Public  
**Description**: Validates staff credentials and sends OTP to email

**Request Body**:
```json
{
  "email": "doctor@oneheal.com",
  "password": "YourPassword123!"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "data": {
    "email": "doctor@oneheal.com"
  }
}
```

---

### 2. Staff Verify 2FA (Step 2)
**Endpoint**: `POST /auth/verify-2fa`  
**Access**: Public  
**Description**: Verifies OTP and returns JWT token

**Request Body**:
```json
{
  "email": "doctor@oneheal.com",
  "otp": "123456"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "fullName": "Dr. Name",
      "email": "doctor@oneheal.com",
      "role": "DOCTOR",
      "parentId": null
    }
  }
}
```

---

### 3. Patient Login (Step 1)
**Endpoint**: `POST /patient/login`  
**Access**: Public  
**Description**: Validates sticker ID and requests OTP

**Request Body**:
```json
{
  "stickerId": "QR-2024-001"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP Required. Please enter the verification code.",
  "data": {
    "stickerId": "QR-2024-001"
  }
}
```

---

### 4. Patient Verify OTP (Step 2)
**Endpoint**: `POST /patient/verify-otp`  
**Access**: Public  
**Description**: Verifies OTP (hardcoded "1234" for MVP) and returns JWT

**Request Body**:
```json
{
  "stickerId": "QR-2024-001",
  "otp": "1234"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "patient": {
      "id": "uuid",
      "stickerId": "QR-2024-001",
      "fullName": "Patient Name",
      "age": 58,
      "status": "ACTIVE"
    }
  }
}
```

---

## 👨‍💼 Admin Endpoints (SUPER_ADMIN Only)

### 5. Create Staff
**Endpoint**: `POST /admin/create-staff`  
**Access**: SUPER_ADMIN  
**Description**: Creates Doctor or Pharmacist, generates password, sends email

**Headers**:
```
Authorization: Bearer <SUPER_ADMIN_TOKEN>
```

**Request Body**:
```json
{
  "fullName": "Dr. Rajesh Kumar",
  "email": "rajesh@oneheal.com",
  "phone": "+91-9876543210",
  "role": "DOCTOR"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "DOCTOR created successfully. Credentials sent to rajesh@oneheal.com",
  "data": {
    "id": "uuid",
    "fullName": "Dr. Rajesh Kumar",
    "email": "rajesh@oneheal.com",
    "role": "DOCTOR"
  }
}
```

**Email Sent**: Password delivered to staff member's email

---

## 👨‍⚕️ Doctor Endpoints (DOCTOR Only)

### 6. Create Assistant
**Endpoint**: `POST /doctor/create-assistant`  
**Access**: DOCTOR  
**Description**: Creates Assistant linked to Doctor via parentId

**Headers**:
```
Authorization: Bearer <DOCTOR_TOKEN>
```

**Request Body**:
```json
{
  "fullName": "Priya Sharma",
  "email": "priya@oneheal.com",
  "phone": "+91-9876543211"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Assistant created successfully. Credentials sent to priya@oneheal.com",
  "data": {
    "id": "uuid",
    "fullName": "Priya Sharma",
    "email": "priya@oneheal.com",
    "role": "ASSISTANT",
    "parentId": "doctor-uuid"
  }
}
```

---

## 🏥 Clinic Endpoints (DOCTOR & ASSISTANT)

### 7. Register Patient
**Endpoint**: `POST /clinic/register-patient`  
**Access**: DOCTOR, ASSISTANT  
**Description**: Registers patient with sticker ID

**Headers**:
```
Authorization: Bearer <DOCTOR_OR_ASSISTANT_TOKEN>
```

**Request Body**:
```json
{
  "stickerId": "QR-2024-001",
  "fullName": "Ramesh Patel",
  "age": 58,
  "phone": "+91-9876543212",
  "gender": "Male",
  "caseType": "CHEMOTHERAPY"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Patient registered successfully",
  "data": {
    "id": "uuid",
    "stickerId": "QR-2024-001",
    "fullName": "Ramesh Patel",
    "age": 58,
    "phone": "+91-9876543212",
    "gender": "Male",
    "caseType": "CHEMOTHERAPY",
    "status": "ACTIVE",
    "doctorId": "doctor-uuid",
    "registeredBy": "ASSISTANT"
  }
}
```

**Business Logic**:
- If DOCTOR: `doctorId = doctor's own ID`
- If ASSISTANT: `doctorId = assistant's parentId` (Doctor's ID)
- `caseType` is optional: `PERI_OPERATIVE`, `POST_OPERATIVE`, `FOLLOW_UP`, `CHEMOTHERAPY`, `RADIOLOGY`

---

## 📊 Dashboard Endpoints (DOCTOR, ASSISTANT, PHARMACIST)

### 8. Get Patients
**Endpoint**: `GET /dashboard/patients`  
**Access**: DOCTOR, ASSISTANT, PHARMACIST  
**Description**: Lists patients based on role

**Headers**:
```
Authorization: Bearer <STAFF_TOKEN>
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (ACTIVE, CRITICAL, COMPLETED)
- `search` (optional): Search by patient name

**Example**:
```
GET /dashboard/patients?page=1&limit=10&status=ACTIVE&search=Ramesh
```

**Response** (200):
```json
{
  "success": true,
  "message": "Patients retrieved successfully",
  "data": {
    "patients": [
      {
        "id": "uuid",
        "stickerId": "QR-2024-001",
        "fullName": "Ramesh Patel",
        "age": 58,
        "gender": "Male",
        "phone": "+91-9876543212",
        "status": "ACTIVE",
        "doctorId": "doctor-uuid",
        "createdAt": "2026-02-04T02:00:00.000Z",
        "updatedAt": "2026-02-04T02:00:00.000Z",
        "doctor": {
          "id": "doctor-uuid",
          "fullName": "Dr. Rajesh Kumar",
          "email": "rajesh@oneheal.com"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

**Role-Based Filtering**:
- **DOCTOR**: Sees patients where `doctorId = their ID`
- **ASSISTANT**: Sees patients where `doctorId = their parentId`
- **PHARMACIST**: Sees ALL patients

---

## 📝 Scan Endpoints (PATIENT Only)

### 9. Submit Scan
**Endpoint**: `POST /scan/submit`  
**Access**: PATIENT  
**Description**: Submits symptom scan data from diary page

**Headers**:
```
Authorization: Bearer <PATIENT_TOKEN>
```

**Request Body**:
```json
{
  "pageId": "PAGE_05",
  "scanData": {
    "symptoms": ["nausea", "fatigue", "headache"],
    "severity": {
      "nausea": 7,
      "fatigue": 5,
      "headache": 3
    },
    "medications": {
      "taken": true,
      "time": "08:00 AM"
    },
    "notes": "Feeling tired after chemotherapy session"
  }
}
```

**Response** (201 for new, 200 for update):
```json
{
  "success": true,
  "message": "Scan submitted successfully",
  "data": {
    "id": "uuid",
    "pageId": "PAGE_05",
    "scannedAt": "2026-02-04T02:45:00.000Z",
    "isUpdated": false,
    "updatedCount": 0
  }
}
```

**Notes**:
- `scanData` is stored as JSONB (flexible schema)
- Patient's `updatedAt` timestamp is automatically updated
- **Re-scan behavior**: If same `pageId` is scanned again, existing record is updated
- Re-scanned pages will have `isUpdated: true` and incremented `updatedCount`

---

### 10. Get Scan History
**Endpoint**: `GET /scan/history`  
**Access**: PATIENT  
**Description**: Retrieves patient's scan history

**Headers**:
```
Authorization: Bearer <PATIENT_TOKEN>
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example**:
```
GET /scan/history?page=1&limit=20
```

**Response** (200):
```json
{
  "success": true,
  "message": "Scan history retrieved successfully",
  "data": {
    "scans": [
      {
        "id": "uuid",
        "patientId": "patient-uuid",
        "pageId": "PAGE_05",
        "scanData": {
          "symptoms": ["nausea", "fatigue"],
          "severity": {
            "nausea": 7,
            "fatigue": 5
          }
        },
        "scannedAt": "2026-02-04T02:45:00.000Z",
        "createdAt": "2026-02-04T02:45:00.000Z",
        "updatedAt": "2026-02-04T02:45:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 🔒 Authentication & Authorization

### JWT Token Format

**Staff Token**:
```json
{
  "id": "uuid",
  "email": "user@oneheal.com",
  "role": "DOCTOR",
  "fullName": "Dr. Name",
  "parentId": null,
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Patient Token**:
```json
{
  "id": "uuid",
  "stickerId": "QR-2024-001",
  "fullName": "Patient Name",
  "type": "PATIENT",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Token Expiry
- **Staff**: 7 days
- **Patient**: 30 days (long-lived for illiterate users)

### Authorization Header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Email and password are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Patient not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to create staff member"
}
```

---

## 📋 Role Permissions Matrix

| Endpoint | SUPER_ADMIN | DOCTOR | PHARMACIST | ASSISTANT | PATIENT |
|----------|-------------|--------|------------|-----------|---------|
| POST /auth/login | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /auth/verify-2fa | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /patient/login | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /patient/verify-otp | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /admin/create-staff | ✅ | ❌ | ❌ | ❌ | ❌ |
| POST /doctor/create-assistant | ❌ | ✅ | ❌ | ❌ | ❌ |
| POST /clinic/register-patient | ❌ | ✅ | ❌ | ✅ | ❌ |
| GET /dashboard/patients | ❌ | ✅ | ✅ | ✅ | ❌ |
| POST /scan/submit | ❌ | ❌ | ❌ | ❌ | ✅ |
| GET /scan/history | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🧪 Postman Collection

Import this into Postman for quick testing:

```json
{
  "info": {
    "name": "OneHeal Enterprise API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5050/api/v1"
    }
  ]
}
```

---

## 👤 Patient Profile Endpoints (PATIENT Only)

### 11. Get Patient Profile
**Endpoint**: `GET /patient/profile`  
**Access**: PATIENT  
**Description**: Retrieves current patient profile including case type

**Headers**:
```
Authorization: Bearer <PATIENT_TOKEN>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "uuid",
    "stickerId": "QR-2024-001",
    "fullName": "Ramesh Patel",
    "age": 58,
    "gender": "Male",
    "phone": "+91-9876543212",
    "caseType": "CHEMOTHERAPY",
    "status": "ACTIVE"
  }
}
```

---

### 12. Request Edit OTP
**Endpoint**: `POST /patient/request-edit-otp`  
**Access**: PATIENT  
**Description**: Requests OTP to edit profile (hardcoded "1234" for MVP)

**Response** (200):
```json
{
  "success": true,
  "message": "OTP sent to your registered mobile number",
  "data": {
    "phone": "+91-9876****12"
  }
}
```

---

### 13. Update Patient Profile
**Endpoint**: `POST /patient/update-profile`  
**Access**: PATIENT  
**Description**: Updates patient profile after OTP verification

**Request Body**:
```json
{
  "otp": "1234",
  "fullName": "Updated Name",
  "age": 59
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "fullName": "Updated Name",
    "age": 59
  }
}
```

---

## 🔔 Reminder Endpoints

### 14. Create Reminder
**Endpoint**: `POST /clinic/create-reminder`  
**Access**: DOCTOR, ASSISTANT  
**Description**: Creates appointment reminder for a patient

**Request Body**:
```json
{
  "patientId": "patient-uuid",
  "message": "Chemotherapy session tomorrow at 10 AM",
  "reminderDate": "2026-02-10T10:00:00Z",
  "type": "CHEMOTHERAPY"
}
```

**Reminder Types**: `APPOINTMENT`, `CHEMOTHERAPY`, `RADIOLOGY`, `FOLLOW_UP`, `OTHER`

**Response** (201):
```json
{
  "success": true,
  "message": "Reminder created successfully",
  "data": {
    "id": "uuid",
    "message": "Chemotherapy session tomorrow at 10 AM",
    "type": "CHEMOTHERAPY",
    "status": "PENDING"
  }
}
```

---

### 15. Get Patient Reminders
**Endpoint**: `GET /patient/reminders`  
**Access**: PATIENT  
**Query**: `?status=PENDING` (optional)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "id": "uuid",
        "message": "Chemotherapy session tomorrow at 10 AM",
        "reminderDate": "2026-02-10T10:00:00Z",
        "type": "CHEMOTHERAPY",
        "status": "PENDING"
      }
    ],
    "total": 1
  }
}
```

---

### 16. Mark Reminder as Read
**Endpoint**: `PATCH /patient/reminders/:id/read`  
**Access**: PATIENT

**Response** (200):
```json
{
  "success": true,
  "message": "Reminder marked as read"
}
```

---

### 17. Get Dashboard Reminders
**Endpoint**: `GET /dashboard/reminders`  
**Access**: DOCTOR, ASSISTANT  
**Query**: `?status=PENDING&patientId=uuid` (optional)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "id": "uuid",
        "message": "Chemotherapy session tomorrow",
        "patient": {
          "fullName": "Ramesh Patel",
          "stickerId": "QR-2024-001"
        }
      }
    ]
  }
}
```

---

## 📞 Support

For issues or questions, contact the development team or refer to the [walkthrough.md](file:///C:/Users/Yash%20Srivastava/.gemini/antigravity/brain/a1a63cd6-0268-4d16-9758-9986e3edf75d/walkthrough.md) for detailed implementation guide.

