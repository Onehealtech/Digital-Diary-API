# Digital Diary API - Complete API Testing Documentation

**Base URL:** `http://localhost:5000/api/v1`

**Total APIs:** 100

---

## 📌 Table of Contents

1. [Authentication APIs (7)](#1-authentication-apis)
2. [Vendor Management (10)](#2-vendor-management-apis)
3. [Diary Inventory (12)](#3-diary-inventory-apis)
4. [Task Management (6)](#4-task-management-apis)
5. [Notification System (9)](#5-notification-system-apis)
6. [Dashboard Statistics (6)](#6-dashboard-statistics-apis)
7. [Patient Management (11)](#7-patient-management-apis)
8. [Diary Entry Review (6)](#8-diary-entry-review-apis)
9. [Financial System (5)](#9-financial-system-apis)
10. [Reports & Export (7)](#10-reports--export-apis)
11. [Doctor Management (4)](#11-doctor-management-apis)
12. [Assistant Management (4)](#12-assistant-management-apis)
13. [Audit Logs (4)](#13-audit-logs-apis)
14. [Existing APIs (9)](#14-existing-apis)

---

## 1. Authentication APIs

### 1.1 Create Super Admin (One-Time Setup)
```
POST /auth/signup-super-admin
```
**Authorization:** None (disable after first use)

**Request Body:**
```json
{
  "fullName": "Super Admin",
  "email": "admin@example.com",
  "password": "admin123",
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Super Admin created successfully",
  "data": {
    "id": "uuid",
    "fullName": "Super Admin",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  }
}
```

---

### 1.2 Staff Login (2FA - Step 1)
```
POST /auth/login
```
**Authorization:** None

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "tempToken": "temp_token_here",
    "userId": "uuid"
  }
}
```

---

### 1.3 Verify 2FA (Step 2)
```
POST /auth/verify-2fa
```
**Authorization:** None

**Request Body:**
```json
{
  "tempToken": "temp_token_from_step1",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "uuid",
      "fullName": "Dr. John Doe",
      "email": "doctor@example.com",
      "role": "DOCTOR"
    }
  }
}
```

---

### 1.4 Get Current User
```
GET /auth/me
```
**Authorization:** Bearer Token (SUPER_ADMIN, DOCTOR, ASSISTANT, VENDOR)

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "User details fetched successfully",
  "data": {
    "id": "uuid",
    "fullName": "Dr. John Doe",
    "email": "doctor@example.com",
    "phoneNumber": "1234567890",
    "role": "DOCTOR",
    "parentId": null,
    "permissions": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 1.5 Logout
```
POST /auth/logout
```
**Authorization:** Bearer Token (All roles)

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {
    "message": "Logged out successfully",
    "userId": "uuid"
  }
}
```

---

### 1.6 Refresh Token
```
POST /auth/refresh
```
**Authorization:** None

**Request Body:**
```json
{
  "token": "old_jwt_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new_jwt_token",
    "user": {
      "id": "uuid",
      "fullName": "Dr. John Doe",
      "email": "doctor@example.com",
      "role": "DOCTOR"
    }
  }
}
```

---

### 1.7 Forgot Password
```
POST /auth/forgot-password
```
**Authorization:** None

**Request Body:**
```json
{
  "email": "doctor@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset instructions sent",
  "data": {
    "message": "If the email exists, a password reset link will be sent",
    "resetToken": "reset_token_here"
  }
}
```

---

### 1.8 Reset Password
```
POST /auth/reset-password
```
**Authorization:** None

**Request Body:**
```json
{
  "resetToken": "reset_token_from_forgot_password",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "message": "Password reset successfully"
  }
}
```

---

## 2. Vendor Management APIs

### 2.1 Get All Vendors
```
GET /vendors?page=1&limit=20&search=vendor
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name/email/phone

**Response:**
```json
{
  "success": true,
  "message": "Vendors fetched successfully",
  "data": {
    "vendors": [
      {
        "id": "uuid",
        "fullName": "Vendor Name",
        "email": "vendor@example.com",
        "phoneNumber": "1234567890",
        "profile": {
          "businessName": "Medical Store",
          "walletBalance": 5000,
          "diariesSold": 10
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

### 2.2 Get Vendor by ID
```
GET /vendors/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Vendor details fetched successfully",
  "data": {
    "id": "uuid",
    "fullName": "Vendor Name",
    "email": "vendor@example.com",
    "phoneNumber": "1234567890",
    "profile": {
      "businessName": "Medical Store",
      "licenseNumber": "LIC123",
      "walletBalance": 5000,
      "diariesSold": 10,
      "commissionRate": 50
    },
    "stats": {
      "totalSales": 10,
      "pendingSales": 2,
      "availableInventory": 15
    }
  }
}
```

---

### 2.3 Create Vendor
```
POST /vendors
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "fullName": "New Vendor",
  "email": "newvendor@example.com",
  "password": "password123",
  "phoneNumber": "9876543210",
  "businessName": "Medical Store ABC",
  "businessAddress": "123 Main St, City",
  "licenseNumber": "LIC12345",
  "gstNumber": "GST123456",
  "bankDetails": {
    "accountNumber": "1234567890",
    "ifscCode": "BANK0001234",
    "accountHolderName": "Vendor Name"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor created successfully",
  "data": {
    "id": "uuid",
    "fullName": "New Vendor",
    "email": "newvendor@example.com",
    "role": "VENDOR"
  }
}
```

---

### 2.4 Update Vendor
```
PUT /vendors/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Request Body:**
```json
{
  "fullName": "Updated Vendor Name",
  "phoneNumber": "9876543210",
  "businessAddress": "New Address"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor updated successfully",
  "data": {
    "id": "uuid",
    "fullName": "Updated Vendor Name",
    "phoneNumber": "9876543210"
  }
}
```

---

### 2.5 Get Vendor Wallet
```
GET /vendors/:id/wallet
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Wallet details fetched successfully",
  "data": {
    "walletBalance": 5000,
    "totalEarned": 10000,
    "totalWithdrawn": 5000,
    "recentTransactions": [
      {
        "id": "uuid",
        "type": "commission",
        "amount": 50,
        "balanceAfter": 5000,
        "description": "Commission for diary DRY-2024-BC-001",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 2.6 Transfer Funds (Vendor Wallet)
```
POST /vendors/:id/wallet/transfer
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "amount": 500,
  "type": "credit",
  "description": "Bonus payment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Funds transferred successfully",
  "data": {
    "newBalance": 5500,
    "transaction": {
      "id": "uuid",
      "amount": 500,
      "type": "credit"
    }
  }
}
```

---

### 2.7 Get Vendor Sales History
```
GET /vendors/:id/sales?page=1&limit=20
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Sales history fetched successfully",
  "data": {
    "sales": [
      {
        "diaryId": "DRY-2024-BC-001",
        "patientName": "Patient Name",
        "saleAmount": 500,
        "commissionAmount": 50,
        "status": "active",
        "soldAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 2.8 Get Vendor Inventory
```
GET /vendors/:id/inventory?page=1&limit=20
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Inventory fetched successfully",
  "data": {
    "diaries": [
      {
        "id": "DRY-2024-BC-001",
        "diaryType": "breast-cancer-treatment",
        "status": "assigned",
        "qrCodeUrl": "base64_qr_code",
        "assignedAt": "2024-01-01T00:00:00.000Z"
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

### 2.9 Sell Diary to Patient
```
POST /vendors/:id/sell-diary
```
**Authorization:** Bearer Token (VENDOR only)

**Request Body:**
```json
{
  "diaryId": "DRY-2024-BC-001",
  "patientName": "Patient Name",
  "phoneNumber": "9876543210",
  "age": 45,
  "gender": "female",
  "address": "Patient Address",
  "diaryType": "breast-cancer-treatment",
  "stage": "stage-2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary sold successfully",
  "data": {
    "patient": {
      "id": "uuid",
      "name": "Patient Name",
      "phoneNumber": "9876543210"
    },
    "diary": {
      "id": "DRY-2024-BC-001",
      "status": "pending"
    },
    "message": "Diary sale pending Super Admin approval"
  }
}
```

---

### 2.10 Get Vendor Dashboard
```
GET /vendors/:id/dashboard
```
**Authorization:** Bearer Token (VENDOR only)

**Response:**
```json
{
  "success": true,
  "message": "Dashboard fetched successfully",
  "data": {
    "stats": {
      "totalSales": 10,
      "thisMonthSales": 3,
      "walletBalance": 5000,
      "availableDiaries": 15,
      "pendingApprovals": 2
    },
    "recentSales": [],
    "recentTransactions": []
  }
}
```

---

## 3. Diary Inventory APIs

### 3.1 Generate Diaries
```
POST /generated-diaries/generate
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "quantity": 100,
  "diaryType": "breast-cancer-treatment",
  "batchCode": "BC"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diaries generated successfully",
  "data": {
    "message": "100 diaries generated successfully",
    "batchCode": "BC",
    "diaryIds": ["DRY-2024-BC-001", "DRY-2024-BC-002"],
    "count": 100
  }
}
```

---

### 3.2 Get All Generated Diaries
```
GET /generated-diaries?page=1&limit=20&status=unassigned
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Query Parameters:**
- `status`: unassigned, assigned, sold, active

**Response:**
```json
{
  "success": true,
  "message": "Generated diaries fetched successfully",
  "data": {
    "diaries": [
      {
        "id": "DRY-2024-BC-001",
        "diaryType": "breast-cancer-treatment",
        "status": "unassigned",
        "qrCodeUrl": "base64_qr_code",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### 3.3 Get Diary by ID
```
GET /generated-diaries/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Diary fetched successfully",
  "data": {
    "id": "DRY-2024-BC-001",
    "diaryType": "breast-cancer-treatment",
    "status": "assigned",
    "qrCodeUrl": "base64_qr_code",
    "assignedTo": "vendor_id",
    "assignedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 3.4 Assign Diary to Vendor
```
PUT /generated-diaries/:id/assign
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "vendorId": "vendor_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary assigned successfully",
  "data": {
    "id": "DRY-2024-BC-001",
    "status": "assigned",
    "assignedTo": "vendor_uuid"
  }
}
```

---

### 3.5 Bulk Assign Diaries
```
PUT /generated-diaries/bulk-assign
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "vendorId": "vendor_uuid",
  "quantity": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diaries assigned successfully",
  "data": {
    "message": "10 diaries assigned successfully",
    "diaryIds": ["DRY-2024-BC-001", "DRY-2024-BC-002"],
    "count": 10
  }
}
```

---

### 3.6 Unassign Diary from Vendor
```
PUT /generated-diaries/:id/unassign
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Diary unassigned successfully",
  "data": {
    "id": "DRY-2024-BC-001",
    "status": "unassigned"
  }
}
```

---

### 3.7 Approve Diary Sale
```
PUT /diaries/:id/approve
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "notes": "Approved by Super Admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary sale approved successfully",
  "data": {
    "diary": {
      "id": "uuid",
      "status": "active"
    },
    "commission": {
      "amount": 50,
      "creditedTo": "vendor_id"
    }
  }
}
```

---

### 3.8 Reject Diary Sale
```
PUT /diaries/:id/reject
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "reason": "Invalid patient details"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary sale rejected successfully",
  "data": {
    "diary": {
      "id": "uuid",
      "status": "rejected"
    },
    "reason": "Invalid patient details"
  }
}
```

---

### 3.9 Get Diary Requests
```
GET /diary-requests?page=1&limit=20&status=pending
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Diary requests fetched successfully",
  "data": {
    "requests": [
      {
        "id": "uuid",
        "vendorId": "vendor_uuid",
        "quantity": 10,
        "status": "pending",
        "requestedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 3.10 Create Diary Request
```
POST /diary-requests
```
**Authorization:** Bearer Token (VENDOR only)

**Request Body:**
```json
{
  "quantity": 10,
  "reason": "Stock running low"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary request created successfully",
  "data": {
    "id": "uuid",
    "quantity": 10,
    "status": "pending"
  }
}
```

---

### 3.11 Approve Diary Request
```
PUT /diary-requests/:id/approve
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Diary request approved successfully",
  "data": {
    "request": {
      "id": "uuid",
      "status": "approved"
    },
    "diariesAssigned": 10
  }
}
```

---

### 3.12 Reject Diary Request
```
PUT /diary-requests/:id/reject
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "reason": "Insufficient stock"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary request rejected successfully",
  "data": {
    "id": "uuid",
    "status": "rejected",
    "reason": "Insufficient stock"
  }
}
```

---

## 4. Task Management APIs

### 4.1 Get All Tasks
```
GET /tasks?page=1&limit=20&status=pending&priority=high
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Query Parameters:**
- `status`: pending, in-progress, completed
- `priority`: low, medium, high, urgent

**Response:**
```json
{
  "success": true,
  "message": "Tasks fetched successfully",
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "title": "Review patient entries",
        "description": "Review diary entries for patients",
        "taskType": "review-entries",
        "priority": "high",
        "status": "pending",
        "dueDate": "2024-01-10T00:00:00.000Z",
        "assignedTo": "assistant_id",
        "createdBy": "doctor_id"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 4.2 Get Task by ID
```
GET /tasks/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Response:**
```json
{
  "success": true,
  "message": "Task fetched successfully",
  "data": {
    "id": "uuid",
    "title": "Review patient entries",
    "description": "Review diary entries for patients",
    "taskType": "review-entries",
    "priority": "high",
    "status": "pending",
    "dueDate": "2024-01-10T00:00:00.000Z",
    "relatedPatients": ["patient_id_1", "patient_id_2"],
    "assignedTo": "assistant_id",
    "createdBy": "doctor_id",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 4.3 Create Task
```
POST /tasks
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "assignedTo": "assistant_uuid",
  "title": "Call patients for follow-up",
  "description": "Contact patients who haven't scanned in 7 days",
  "taskType": "call-patients",
  "priority": "high",
  "dueDate": "2024-01-10",
  "relatedPatients": ["patient_id_1", "patient_id_2"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "uuid",
    "title": "Call patients for follow-up",
    "status": "pending",
    "assignedTo": "assistant_uuid"
  }
}
```

---

### 4.4 Update Task
```
PUT /tasks/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "status": "in-progress",
  "notes": "Started calling patients"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "id": "uuid",
    "status": "in-progress",
    "notes": "Started calling patients"
  }
}
```

---

### 4.5 Mark Task Complete
```
PUT /tasks/:id/complete
```
**Authorization:** Bearer Token (ASSISTANT only)

**Request Body:**
```json
{
  "notes": "All patients contacted successfully"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task marked as complete",
  "data": {
    "id": "uuid",
    "status": "completed",
    "completedAt": "2024-01-05T00:00:00.000Z"
  }
}
```

---

### 4.6 Delete Task
```
DELETE /tasks/:id
```
**Authorization:** Bearer Token (DOCTOR only)

**Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully",
  "data": null
}
```

---

## 5. Notification System APIs

### 5.1 Get All Notifications
```
GET /notifications?page=1&limit=20&type=alert&read=false
```
**Authorization:** Bearer Token (All roles)

**Query Parameters:**
- `type`: alert, info, reminder, task-assigned, test-result
- `read`: true, false
- `severity`: low, medium, high, critical

**Response:**
```json
{
  "success": true,
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "alert",
        "severity": "high",
        "title": "Test Results Available",
        "message": "Your test results are ready",
        "read": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    },
    "unreadCount": 5
  }
}
```

---

### 5.2 Get Notification Statistics
```
GET /notifications/stats
```
**Authorization:** Bearer Token (All roles)

**Response:**
```json
{
  "success": true,
  "message": "Notification stats fetched successfully",
  "data": {
    "total": 50,
    "unread": 5,
    "read": 45,
    "bySeverity": [
      { "severity": "high", "count": 10 },
      { "severity": "medium", "count": 20 }
    ]
  }
}
```

---

### 5.3 Get Notification by ID
```
GET /notifications/:id
```
**Authorization:** Bearer Token (All roles)

**Response:**
```json
{
  "success": true,
  "message": "Notification fetched successfully",
  "data": {
    "id": "uuid",
    "type": "alert",
    "severity": "high",
    "title": "Test Results Available",
    "message": "Your test results are ready for review",
    "read": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 5.4 Send Individual Notification
```
POST /notifications
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "recipientId": "patient_uuid",
  "recipientType": "patient",
  "type": "reminder",
  "severity": "medium",
  "title": "Diary Entry Reminder",
  "message": "Please fill your daily diary entry",
  "actionUrl": "/diary/scan"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": {
    "id": "uuid",
    "type": "reminder",
    "title": "Diary Entry Reminder",
    "delivered": true
  }
}
```

---

### 5.5 Send Bulk Notifications
```
POST /notifications/bulk
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "type": "reminder",
  "severity": "medium",
  "title": "Weekly Diary Reminder",
  "message": "Please complete your diary entries",
  "filters": {
    "diaryType": "breast-cancer-treatment",
    "stage": "stage-2",
    "doctorId": "doctor_uuid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk notifications sent successfully",
  "data": {
    "message": "Notifications sent to 25 patients",
    "count": 25,
    "patientIds": ["patient_id_1", "patient_id_2"]
  }
}
```

---

### 5.6 Mark Notification as Read
```
PUT /notifications/:id/read
```
**Authorization:** Bearer Token (All roles)

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "uuid",
    "read": true,
    "readAt": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### 5.7 Mark Multiple Notifications as Read
```
PUT /notifications/bulk-read
```
**Authorization:** Bearer Token (All roles)

**Request Body:**
```json
{
  "notificationIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications marked as read",
  "data": {
    "message": "3 notifications marked as read",
    "count": 3
  }
}
```

---

### 5.8 Mark All Notifications as Read
```
PUT /notifications/mark-all-read
```
**Authorization:** Bearer Token (All roles)

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "message": "5 notifications marked as read",
    "count": 5
  }
}
```

---

### 5.9 Delete Notification
```
DELETE /notifications/:id
```
**Authorization:** Bearer Token (All roles)

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully",
  "data": {
    "message": "Notification deleted successfully"
  }
}
```

---

## 6. Dashboard Statistics APIs

### 6.1 Super Admin Dashboard
```
GET /dashboard/super-admin
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Super Admin dashboard fetched successfully",
  "data": {
    "users": {
      "totalDoctors": 50,
      "totalVendors": 100,
      "totalAssistants": 75,
      "totalPatients": 5000
    },
    "diaries": {
      "activeDiaries": 3000,
      "pendingApprovals": 50,
      "availableDiaries": 500,
      "thisMonthSold": 200
    },
    "financials": {
      "totalRevenue": 1500000,
      "totalCommission": 150000,
      "thisMonthRevenue": 100000,
      "netProfit": 1350000
    }
  }
}
```

---

### 6.2 Vendor Dashboard
```
GET /dashboard/vendor
```
**Authorization:** Bearer Token (VENDOR only)

**Response:**
```json
{
  "success": true,
  "message": "Vendor dashboard fetched successfully",
  "data": {
    "sales": {
      "total": 100,
      "approved": 90,
      "pending": 10,
      "thisMonth": 15
    },
    "inventory": {
      "available": 25
    },
    "financials": {
      "walletBalance": 4500,
      "totalCommissionEarned": 5000,
      "totalPayouts": 500,
      "pendingCommission": 500
    },
    "recentTransactions": []
  }
}
```

---

### 6.3 Doctor Dashboard
```
GET /dashboard/doctor
```
**Authorization:** Bearer Token (DOCTOR only)

**Response:**
```json
{
  "success": true,
  "message": "Doctor dashboard fetched successfully",
  "data": {
    "patients": {
      "total": 150,
      "activeCases": 100,
      "needingFollowUp": 15
    },
    "diaryEntries": {
      "thisWeek": 450,
      "pendingReviews": 25,
      "flagged": 5
    },
    "tasks": {
      "total": 50,
      "pending": 10,
      "completed": 40
    },
    "team": {
      "totalAssistants": 3
    },
    "recentEntries": []
  }
}
```

---

### 6.4 Assistant Dashboard
```
GET /dashboard/assistant
```
**Authorization:** Bearer Token (ASSISTANT only)

**Response:**
```json
{
  "success": true,
  "message": "Assistant dashboard fetched successfully",
  "data": {
    "patients": {
      "total": 150,
      "activeCases": 100,
      "needingCalls": 20
    },
    "tasks": {
      "total": 30,
      "pending": 5,
      "inProgress": 3,
      "completed": 22,
      "overdue": 0
    },
    "recentTasks": [],
    "permissions": {
      "viewPatients": true,
      "callPatients": true,
      "exportData": false,
      "sendNotifications": true
    }
  }
}
```

---

### 6.5 Get Dashboard Patients
```
GET /dashboard/patients?page=1&limit=20&status=active
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Response:**
```json
{
  "success": true,
  "message": "Patients retrieved successfully",
  "data": {
    "patients": [
      {
        "id": "uuid",
        "name": "Patient Name",
        "age": 45,
        "gender": "female",
        "phoneNumber": "9876543210",
        "stage": "stage-2",
        "doctor": {
          "id": "uuid",
          "fullName": "Dr. John Doe"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

---

### 6.6 Get Dashboard Reminders
```
GET /dashboard/reminders?page=1&limit=20
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Response:**
```json
{
  "success": true,
  "message": "Reminders retrieved successfully",
  "data": {
    "reminders": [
      {
        "id": "uuid",
        "title": "Take medication",
        "message": "Remember to take your evening dose",
        "patientId": "uuid",
        "scheduledFor": "2024-01-01T18:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

## 7. Patient Management APIs

### 7.1 Get Patients Needing Follow-Up
```
GET /patient/follow-up
```
**Authorization:** Bearer Token (DOCTOR only)

**Response:**
```json
{
  "success": true,
  "message": "Follow-up list fetched successfully",
  "data": [
    {
      "id": "uuid",
      "name": "Patient Name",
      "phoneNumber": "9876543210",
      "lastDoctorContact": "2023-12-20T00:00:00.000Z",
      "totalTestsPrescribed": 7,
      "testCompletionPercentage": 71
    }
  ]
}
```

---

### 7.2 Get Patient by ID
```
GET /patient/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Patient details fetched successfully",
  "data": {
    "id": "uuid",
    "name": "Patient Name",
    "phoneNumber": "9876543210",
    "age": 45,
    "gender": "female",
    "address": "Patient Address",
    "stage": "stage-2",
    "diaryType": "breast-cancer-treatment",
    "totalTestsPrescribed": 7,
    "testsCompleted": 5,
    "testCompletionPercentage": 71,
    "scanStats": {
      "total": 50,
      "unreviewed": 5,
      "flagged": 2
    },
    "recentScans": []
  }
}
```

---

### 7.3 Update Patient
```
PUT /patient/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "name": "Updated Patient Name",
  "phoneNumber": "9876543210",
  "address": "New Address",
  "stage": "stage-3"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Patient updated successfully",
  "data": {
    "id": "uuid",
    "name": "Updated Patient Name",
    "phoneNumber": "9876543210"
  }
}
```

---

### 7.4 Prescribe Tests to Patient
```
POST /patient/:id/tests
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "tests": [
    {
      "testName": "CBC (Complete Blood Count)",
      "testType": "normal"
    },
    {
      "testName": "Biopsy",
      "testType": "major"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tests prescribed successfully",
  "data": {
    "id": "uuid",
    "totalTestsPrescribed": 9,
    "prescribedTests": [
      {
        "testName": "CBC (Complete Blood Count)",
        "testType": "normal",
        "completed": false,
        "reportReceived": false
      }
    ]
  }
}
```

---

### 7.5 Update Test Status
```
PUT /patient/:id/tests/:testName
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "completed": true,
  "reportReceived": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test status updated successfully",
  "data": {
    "id": "uuid",
    "testsCompleted": 6,
    "reportsReceived": 6,
    "testCompletionPercentage": 86
  }
}
```

---

### 7.6 Log Call Attempt
```
POST /patient/:id/call
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "outcome": "answered",
  "notes": "Patient confirmed test completion",
  "followUpRequired": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Call logged successfully",
  "data": {
    "patientId": "uuid",
    "patientName": "Patient Name",
    "callDate": "2024-01-01T10:00:00.000Z",
    "outcome": "answered",
    "notes": "Patient confirmed test completion",
    "lastDoctorContact": "2024-01-01T10:00:00.000Z"
  }
}
```

---

### 7.7 Get Test Progress
```
GET /patient/:id/test-progress
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Response:**
```json
{
  "success": true,
  "message": "Test progress fetched successfully",
  "data": {
    "patientId": "uuid",
    "patientName": "Patient Name",
    "totalTestsPrescribed": 7,
    "testsCompleted": 5,
    "reportsReceived": 5,
    "testCompletionPercentage": 71,
    "prescribedTests": [
      {
        "testName": "CBC",
        "testType": "normal",
        "completed": true,
        "reportReceived": true
      }
    ],
    "canStartTreatment": true
  }
}
```

---

### 7.8 Create Patient (Legacy)
```
POST /patient
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "fullName": "New Patient",
  "age": 45,
  "gender": "female",
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "message": "Patient created successfully",
  "data": {
    "id": "uuid",
    "fullName": "New Patient",
    "age": 45
  }
}
```

---

### 7.9 Get All Patients (Legacy)
```
GET /patient/getAllPatients
```
**Authorization:** Bearer Token (DOCTOR only)

**Response:**
```json
{
  "id": "doctor_uuid",
  "fullName": "Dr. John Doe",
  "email": "doctor@example.com",
  "patients": [
    {
      "patientCode": "PAT001",
      "fullName": "Patient Name",
      "age": 45,
      "gender": "female"
    }
  ]
}
```

---

### 7.10 Get Patient Profile
```
GET /patient/profile
```
**Authorization:** Patient Auth Token

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Patient Name",
    "phoneNumber": "9876543210",
    "age": 45,
    "gender": "female"
  }
}
```

---

### 7.11 Get Patient Reminders
```
GET /patient/reminders
```
**Authorization:** Patient Auth Token

**Response:**
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "id": "uuid",
        "title": "Take medication",
        "message": "Evening dose reminder",
        "read": false
      }
    ]
  }
}
```

---

## 8. Diary Entry Review APIs

### 8.1 Get All Diary Entries
```
GET /diary-entries?page=1&limit=20&reviewed=false&pageType=test-status
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Query Parameters:**
- `pageType`: test-status, treatment-update, symptoms, notes
- `reviewed`: true, false
- `flagged`: true, false
- `patientId`: uuid
- `startDate`: ISO date
- `endDate`: ISO date

**Response:**
```json
{
  "success": true,
  "message": "Diary entries fetched successfully",
  "data": {
    "entries": [
      {
        "id": "uuid",
        "pageType": "test-status",
        "imageUrl": "url_to_image",
        "doctorReviewed": false,
        "flagged": false,
        "scannedAt": "2024-01-01T10:00:00.000Z",
        "patient": {
          "id": "uuid",
          "name": "Patient Name",
          "phoneNumber": "9876543210"
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "stats": {
      "unreviewed": 15,
      "flagged": 3
    }
  }
}
```

---

### 8.2 Get Diary Entry Statistics
```
GET /diary-entries/stats
```
**Authorization:** Bearer Token (DOCTOR only)

**Response:**
```json
{
  "success": true,
  "message": "Diary stats fetched successfully",
  "data": {
    "total": 500,
    "reviewed": 450,
    "unreviewed": 50,
    "flagged": 10,
    "thisWeek": 75,
    "byPageType": [
      { "pageType": "test-status", "count": 200 },
      { "pageType": "symptoms", "count": 150 }
    ]
  }
}
```

---

### 8.3 Get Pending Reviews
```
GET /diary-entries/review/pending
```
**Authorization:** Bearer Token (DOCTOR only)

**Response:**
```json
{
  "success": true,
  "message": "Pending reviews fetched successfully",
  "data": {
    "unreviewed": [
      {
        "id": "uuid",
        "pageType": "test-status",
        "scannedAt": "2024-01-01T10:00:00.000Z",
        "patient": {
          "id": "uuid",
          "name": "Patient Name"
        }
      }
    ],
    "flagged": []
  }
}
```

---

### 8.4 Get Diary Entry by ID
```
GET /diary-entries/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Response:**
```json
{
  "success": true,
  "message": "Diary entry fetched successfully",
  "data": {
    "id": "uuid",
    "pageType": "test-status",
    "imageUrl": "url_to_image",
    "scanData": {},
    "doctorReviewed": false,
    "flagged": false,
    "doctorNotes": null,
    "scannedAt": "2024-01-01T10:00:00.000Z",
    "patient": {
      "id": "uuid",
      "name": "Patient Name",
      "phoneNumber": "9876543210",
      "diaryType": "breast-cancer-treatment"
    }
  }
}
```

---

### 8.5 Review Diary Entry
```
PUT /diary-entries/:id/review
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "doctorNotes": "Patient showing good progress",
  "flagged": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary entry reviewed successfully",
  "data": {
    "id": "uuid",
    "doctorReviewed": true,
    "reviewedBy": "doctor_id",
    "reviewedAt": "2024-01-01T12:00:00.000Z",
    "doctorNotes": "Patient showing good progress"
  }
}
```

---

### 8.6 Flag/Unflag Diary Entry
```
PUT /diary-entries/:id/flag
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "flagged": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary entry flagged successfully",
  "data": {
    "id": "uuid",
    "flagged": true
  }
}
```

---

## 9. Financial System APIs

### 9.1 Get Financial Dashboard
```
GET /financials/dashboard
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Financial dashboard fetched successfully",
  "data": {
    "overview": {
      "totalRevenue": 1500000,
      "totalCommissionPaid": 150000,
      "totalPayouts": 50000,
      "pendingCommission": 5000,
      "netProfit": 1350000
    },
    "thisMonth": {
      "revenue": 100000,
      "commission": 10000,
      "payouts": 2000
    },
    "recentTransactions": [],
    "topVendorBalances": []
  }
}
```

---

### 9.2 Get All Transactions
```
GET /financials/transactions?page=1&limit=20&type=commission
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Query Parameters:**
- `type`: sale, commission, payout, refund
- `startDate`: ISO date
- `endDate`: ISO date
- `vendorId`: uuid (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Transactions fetched successfully",
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "commission",
        "amount": 50,
        "balanceBefore": 4950,
        "balanceAfter": 5000,
        "description": "Commission for diary DRY-2024-BC-001",
        "timestamp": "2024-01-01T10:00:00.000Z",
        "vendor": {
          "id": "uuid",
          "fullName": "Vendor Name"
        }
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### 9.3 Get Transaction Statistics
```
GET /financials/stats?vendorId=uuid
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Transaction stats fetched successfully",
  "data": {
    "total": 150,
    "byType": [
      { "type": "commission", "count": 100, "total": 5000 },
      { "type": "payout", "count": 10, "total": 1000 }
    ]
  }
}
```

---

### 9.4 Get Financial Statement
```
GET /financials/statement?vendorId=uuid&startDate=2024-01-01&endDate=2024-01-31
```
**Authorization:** Bearer Token (SUPER_ADMIN, VENDOR)

**Response:**
```json
{
  "success": true,
  "message": "Financial statement fetched successfully",
  "data": {
    "vendor": {
      "id": "uuid",
      "name": "Vendor Name",
      "email": "vendor@example.com",
      "currentBalance": 5000
    },
    "period": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.000Z"
    },
    "summary": {
      "totalSales": 0,
      "totalCommissions": 500,
      "totalPayouts": 100,
      "totalRefunds": 0,
      "netEarnings": 400
    },
    "transactions": []
  }
}
```

---

### 9.5 Process Payout
```
POST /financials/payout
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "vendorId": "vendor_uuid",
  "amount": 500,
  "paymentMethod": "bank_transfer",
  "description": "Monthly payout"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payout processed successfully",
  "data": {
    "transaction": {
      "id": "uuid",
      "type": "payout",
      "amount": 500
    },
    "newBalance": 4500
  }
}
```

---

## 10. Reports & Export APIs

### 10.1 Export Patient Data
```
POST /reports/patient-data
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "patientId": "patient_uuid",
  "format": "pdf",
  "includeTestHistory": true,
  "includeDiaryEntries": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Patient data export queued successfully",
  "data": {
    "exportId": "uuid",
    "status": "pending",
    "message": "Export queued for generation",
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

---

### 10.2 Export Diary Pages
```
POST /reports/diary-pages
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "patientId": "patient_uuid",
  "format": "pdf",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diary pages export queued successfully",
  "data": {
    "exportId": "uuid",
    "status": "pending",
    "message": "Export queued: 50 diary pages",
    "entriesCount": 50,
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

---

### 10.3 Export Test Summary
```
POST /reports/test-summary
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Request Body:**
```json
{
  "patientId": "patient_uuid",
  "format": "excel"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test summary export queued successfully",
  "data": {
    "exportId": "uuid",
    "status": "pending",
    "message": "Test summary export queued",
    "totalTests": 7,
    "completionPercentage": 71,
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

---

### 10.4 Get All Exports
```
GET /reports/exports?page=1&limit=20
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT, SUPER_ADMIN)

**Response:**
```json
{
  "success": true,
  "message": "Exports fetched successfully",
  "data": {
    "exports": [
      {
        "id": "uuid",
        "type": "patient-data",
        "format": "pdf",
        "downloadUrl": "/exports/patient-123.pdf",
        "fileSize": 0,
        "expiresAt": "2024-01-08T00:00:00.000Z",
        "patient": {
          "id": "uuid",
          "name": "Patient Name"
        }
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 10.5 Download Export
```
GET /reports/exports/:id/download
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT, SUPER_ADMIN)

**Response:**
```json
{
  "success": true,
  "message": "Export details fetched successfully",
  "data": {
    "id": "uuid",
    "type": "patient-data",
    "format": "pdf",
    "downloadUrl": "/exports/patient-123.pdf",
    "status": "ready"
  }
}
```

---

### 10.6 Delete Export
```
DELETE /reports/exports/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT, SUPER_ADMIN)

**Response:**
```json
{
  "success": true,
  "message": "Export deleted successfully",
  "data": {
    "message": "Export deleted successfully"
  }
}
```

---

### 10.7 Get Patient Analytics
```
GET /reports/analytics/patient/:id
```
**Authorization:** Bearer Token (DOCTOR, ASSISTANT)

**Response:**
```json
{
  "success": true,
  "message": "Patient analytics fetched successfully",
  "data": {
    "patient": {
      "id": "uuid",
      "name": "Patient Name",
      "age": 45,
      "stage": "stage-2"
    },
    "diaryStats": {
      "totalEntries": 50,
      "reviewedEntries": 45,
      "flaggedEntries": 2,
      "unreviewedEntries": 5,
      "reviewCompletionRate": 90,
      "entriesByType": []
    },
    "testProgress": {
      "totalPrescribed": 7,
      "completed": 5,
      "reportsReceived": 5,
      "completionPercentage": 71
    },
    "timeline": {
      "recentEntries": [],
      "firstEntry": null,
      "lastEntry": null
    },
    "engagement": {
      "lastDiaryScan": "2024-01-01T10:00:00.000Z",
      "lastDoctorContact": "2024-01-01T09:00:00.000Z",
      "daysSinceLastScan": 0,
      "daysSinceLastContact": 0
    }
  }
}
```

---

## 11. Doctor Management APIs

### 11.1 Get All Doctors
```
GET /doctors?page=1&limit=20&search=john
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Doctors fetched successfully",
  "data": {
    "doctors": [
      {
        "id": "uuid",
        "fullName": "Dr. John Doe",
        "email": "doctor@example.com",
        "phoneNumber": "1234567890",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "stats": {
          "totalPatients": 150,
          "totalAssistants": 3
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

### 11.2 Get Doctor by ID
```
GET /doctors/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Doctor details fetched successfully",
  "data": {
    "id": "uuid",
    "fullName": "Dr. John Doe",
    "email": "doctor@example.com",
    "phoneNumber": "1234567890",
    "stats": {
      "totalPatients": 150,
      "totalAssistants": 3,
      "totalTasks": 50
    },
    "assistants": [
      {
        "id": "uuid",
        "fullName": "Assistant Name",
        "email": "assistant@example.com"
      }
    ]
  }
}
```

---

### 11.3 Update Doctor
```
PUT /doctors/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "fullName": "Dr. John Smith",
  "email": "johnsmith@example.com",
  "phoneNumber": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Doctor updated successfully",
  "data": {
    "id": "uuid",
    "fullName": "Dr. John Smith",
    "email": "johnsmith@example.com"
  }
}
```

---

### 11.4 Delete Doctor
```
DELETE /doctors/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Doctor deleted successfully",
  "data": {
    "message": "Doctor deleted successfully"
  }
}
```

---

## 12. Assistant Management APIs

### 12.1 Get All Assistants
```
GET /assistants?page=1&limit=20&search=assistant
```
**Authorization:** Bearer Token (SUPER_ADMIN, DOCTOR)

**Response:**
```json
{
  "success": true,
  "message": "Assistants fetched successfully",
  "data": {
    "assistants": [
      {
        "id": "uuid",
        "fullName": "Assistant Name",
        "email": "assistant@example.com",
        "phoneNumber": "1234567890",
        "parentId": "doctor_id",
        "permissions": {
          "viewPatients": true,
          "callPatients": true
        },
        "parent": {
          "id": "uuid",
          "fullName": "Dr. John Doe"
        },
        "stats": {
          "totalTasks": 30,
          "pendingTasks": 5
        }
      }
    ],
    "pagination": {
      "total": 75,
      "page": 1,
      "limit": 20,
      "totalPages": 4
    }
  }
}
```

---

### 12.2 Get Assistant by ID
```
GET /assistants/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN, DOCTOR)

**Response:**
```json
{
  "success": true,
  "message": "Assistant details fetched successfully",
  "data": {
    "id": "uuid",
    "fullName": "Assistant Name",
    "email": "assistant@example.com",
    "phoneNumber": "1234567890",
    "parentId": "doctor_id",
    "permissions": {
      "viewPatients": true,
      "callPatients": true,
      "exportData": false
    },
    "parent": {
      "id": "uuid",
      "fullName": "Dr. John Doe",
      "email": "doctor@example.com"
    },
    "stats": {
      "totalTasks": 30,
      "pendingTasks": 5,
      "completedTasks": 25
    }
  }
}
```

---

### 12.3 Update Assistant
```
PUT /assistants/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN, DOCTOR)

**Request Body:**
```json
{
  "fullName": "Updated Assistant Name",
  "phoneNumber": "9876543210",
  "permissions": {
    "viewPatients": true,
    "callPatients": true,
    "exportData": true,
    "sendNotifications": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assistant updated successfully",
  "data": {
    "id": "uuid",
    "fullName": "Updated Assistant Name",
    "phoneNumber": "9876543210",
    "permissions": {
      "viewPatients": true,
      "callPatients": true,
      "exportData": true,
      "sendNotifications": true
    }
  }
}
```

---

### 12.4 Delete Assistant
```
DELETE /assistants/:id
```
**Authorization:** Bearer Token (SUPER_ADMIN, DOCTOR)

**Response:**
```json
{
  "success": true,
  "message": "Assistant deleted successfully",
  "data": {
    "message": "Assistant deleted successfully"
  }
}
```

---

## 13. Audit Logs APIs

### 13.1 Get All Audit Logs
```
GET /audit-logs?page=1&limit=50&userRole=doctor&action=login
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Query Parameters:**
- `userRole`: super_admin, doctor, vendor, assistant, patient
- `action`: Any action string (e.g., login, create, update, delete)
- `startDate`: ISO date
- `endDate`: ISO date
- `userId`: uuid

**Response:**
```json
{
  "success": true,
  "message": "Audit logs fetched successfully",
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "user_uuid",
        "userRole": "doctor",
        "action": "login",
        "details": {
          "ip": "192.168.1.1",
          "device": "Chrome Browser"
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "timestamp": "2024-01-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1000,
      "page": 1,
      "limit": 50,
      "totalPages": 20
    }
  }
}
```

---

### 13.2 Get Audit Statistics
```
GET /audit-logs/stats?startDate=2024-01-01&endDate=2024-01-31
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Audit statistics fetched successfully",
  "data": {
    "total": 5000,
    "byUserRole": [
      { "userRole": "doctor", "count": 2000 },
      { "userRole": "vendor", "count": 1500 }
    ],
    "topActions": [
      { "action": "login", "count": 1000 },
      { "action": "create_patient", "count": 500 }
    ],
    "recentActivity": [
      { "date": "2024-01-01", "count": 150 },
      { "date": "2024-01-02", "count": 180 }
    ]
  }
}
```

---

### 13.3 Search Audit Logs
```
GET /audit-logs/search?q=doctor@example.com&page=1&limit=20
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "Audit logs search completed",
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "user_uuid",
        "userRole": "doctor",
        "action": "login",
        "ipAddress": "192.168.1.1",
        "timestamp": "2024-01-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

---

### 13.4 Get User Audit Logs
```
GET /audit-logs/user/:userId?page=1&limit=20
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Response:**
```json
{
  "success": true,
  "message": "User audit logs fetched successfully",
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "user_uuid",
        "userRole": "doctor",
        "action": "update_patient",
        "details": {
          "patientId": "patient_uuid",
          "changes": {}
        },
        "ipAddress": "192.168.1.1",
        "timestamp": "2024-01-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

## 14. Existing APIs

### 14.1 Patient Login (Step 1)
```
POST /patient/login
```
**Authorization:** None

**Request Body:**
```json
{
  "phoneNumber": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "tempToken": "temp_token",
    "phoneNumber": "9876543210"
  }
}
```

---

### 14.2 Patient Verify OTP (Step 2)
```
POST /patient/verify-otp
```
**Authorization:** None

**Request Body:**
```json
{
  "tempToken": "temp_token_from_step1",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "patient_jwt_token",
    "patient": {
      "id": "uuid",
      "name": "Patient Name",
      "phoneNumber": "9876543210"
    }
  }
}
```

---

### 14.3 Submit Diary Scan
```
POST /scan/submit
```
**Authorization:** Patient Auth Token

**Request Body:**
```json
{
  "pageId": "page_1",
  "scanData": {
    "text": "Extracted text from scan",
    "imageUrl": "url_to_uploaded_image"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scan submitted successfully",
  "data": {
    "id": "uuid",
    "pageId": "page_1",
    "scannedAt": "2024-01-01T10:00:00.000Z",
    "isUpdated": false,
    "updatedCount": 0
  }
}
```

---

### 14.4 Get Scan History
```
GET /scan/history?page=1&limit=20
```
**Authorization:** Patient Auth Token

**Response:**
```json
{
  "success": true,
  "message": "Scan history retrieved successfully",
  "data": {
    "scans": [
      {
        "id": "uuid",
        "pageId": "page_1",
        "scanData": {},
        "scannedAt": "2024-01-01T10:00:00.000Z",
        "isUpdated": false
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

### 14.5 Request Edit OTP (Patient)
```
POST /patient/request-edit-otp
```
**Authorization:** Patient Auth Token

**Response:**
```json
{
  "success": true,
  "message": "Edit OTP sent successfully"
}
```

---

### 14.6 Update Patient Profile
```
POST /patient/update-profile
```
**Authorization:** Patient Auth Token

**Request Body:**
```json
{
  "otp": "123456",
  "name": "Updated Patient Name",
  "address": "New Address"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

### 14.7 Mark Reminder as Read
```
PATCH /patient/reminders/:id/read
```
**Authorization:** Patient Auth Token

**Response:**
```json
{
  "success": true,
  "message": "Reminder marked as read"
}
```

---

### 14.8 Create Doctor Staff
```
POST /admin/create-staff
```
**Authorization:** Bearer Token (SUPER_ADMIN only)

**Request Body:**
```json
{
  "fullName": "Dr. New Doctor",
  "email": "newdoctor@example.com",
  "password": "password123",
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "message": "Doctor created successfully",
  "data": {
    "id": "uuid",
    "fullName": "Dr. New Doctor",
    "role": "DOCTOR"
  }
}
```

---

### 14.9 Doctor Create Assistant
```
POST /doctor/create-assistant
```
**Authorization:** Bearer Token (DOCTOR only)

**Request Body:**
```json
{
  "fullName": "New Assistant",
  "email": "assistant@example.com",
  "password": "password123",
  "phoneNumber": "1234567890",
  "permissions": {
    "viewPatients": true,
    "callPatients": true,
    "exportData": false,
    "sendNotifications": true
  }
}
```

**Response:**
```json
{
  "message": "Assistant created successfully",
  "data": {
    "id": "uuid",
    "fullName": "New Assistant",
    "role": "ASSISTANT"
  }
}
```

---

## 📝 Testing Notes

### Authorization Header Format:
```
Authorization: Bearer <your_jwt_token>
```

### Common Response Format:
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

### Error Response Format:
```json
{
  "success": false,
  "message": "Error message"
}
```

### Pagination Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

### Date Format:
All dates should be in ISO 8601 format: `2024-01-01T00:00:00.000Z`

---

## 🧪 Postman Collection Setup

1. **Create Environment Variables:**
   - `base_url`: `http://localhost:5000/api/v1`
   - `token`: (will be set after login)
   - `super_admin_token`: (for super admin operations)
   - `doctor_token`: (for doctor operations)
   - `vendor_token`: (for vendor operations)
   - `patient_token`: (for patient operations)

2. **Auto-Set Token Script (Add to Login Tests):**
```javascript
pm.environment.set("token", pm.response.json().data.token);
```

3. **Pre-Request Script for Auth (Add to Collection):**
```javascript
pm.request.headers.add({
    key: "Authorization",
    value: "Bearer " + pm.environment.get("token")
});
```

---

**🎉 All 100 APIs are ready for testing!**

**Created:** 2024-01-01
**Last Updated:** 2024-01-01
**Version:** 1.0.0
