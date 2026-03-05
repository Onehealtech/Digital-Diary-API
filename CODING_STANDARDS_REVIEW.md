# Digital Diary API — Coding Standards Review

**Reviewed by:** Tushar Rupani
**Date:** March 4, 2026
**Project:** Digital Diary API (Node.js / TypeScript / Express / Sequelize)

---

## Current Strengths

Before diving into improvements, here's what we're already doing well:

- **Clear layered architecture** — Controllers, Services, and Models are properly separated
- **TypeScript with strict mode** — Type safety across the codebase with Sequelize decorators
- **JWT + 2FA authentication** — Proper bcrypt hashing and two-step verification flows
- **Role-based access control** — Middleware-driven RBAC for Super Admin, Vendor, Doctor, and Assistant roles
- **Decimal.js for financial math** — Avoids floating-point bugs in wallet and payment calculations
- **Consistent API response format** — Standardized `{ success, message, data }` structure
- **Audit logging** — AuditLog and WebhookLog models for tracking critical operations

---

## Issues Identified

### 1. No Repository Layer — DB Access Scattered Across Services

**Problem:**
All database queries (Sequelize `findAll`, `findOne`, `create`, `update`, `destroy`) are called directly inside service files. This tightly couples business logic to the ORM, making it harder to:

- Swap or upgrade the ORM in the future
- Reuse queries across multiple services
- Unit test services without hitting the database
- Maintain consistency in how we query the same model from different places

**Current state (services calling DB directly):**
```typescript
// Inside patient.service.ts
const patient = await Patient.findOne({
  where: { id: patientId, doctorId },
  include: [{ model: Diary, as: 'diary' }]
});
```

**Target state (repository pattern):**
```
Controller → Service (business logic only) → Repository (all DB access)
```

```typescript
// patient.repository.ts
export class PatientRepository {
  async findByIdForDoctor(patientId: string, doctorId: string) {
    return Patient.findOne({
      where: { id: patientId, doctorId },
      include: [{ model: Diary, as: 'diary' }]
    });
  }

  async findActiveByDoctor(doctorId: string, limit: number, offset: number) {
    return Patient.findAndCountAll({
      where: { doctorId, status: 'ACTIVE' },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
  }
}

// patient.service.ts — now only contains business logic
export class PatientService {
  constructor(private patientRepo: PatientRepository) {}

  async getPatient(patientId: string, doctorId: string) {
    const patient = await this.patientRepo.findByIdForDoctor(patientId, doctorId);
    if (!patient) throw new NotFoundError('Patient');
    return patient;
  }
}
```

**Action items:**
- Create a `src/repositories/` directory
- Create a repository file for each model (e.g., `patient.repository.ts`, `wallet.repository.ts`, `diary.repository.ts`)
- Move all Sequelize queries out of services and into repositories
- Services should depend on repositories, never call Sequelize models directly
- Priority models to migrate first: `Patient`, `Wallet`, `ScanLog`, `Diary`, `Order` (highest query volume)

---

### 2. No Input Validation Library

**Problem:**
Every controller does manual `if (!field)` checks inline. This is inconsistent, doesn't validate types or formats, and is easy to miss fields.

**Current state:**
```typescript
// Scattered across every controller
if (!assignedTo || !title || !taskType) {
  return sendError(res, "assignedTo, title, and taskType are required", 400);
}
```

**Recommendation:**
- Add `zod` for schema-based validation
- Create validation schemas per endpoint in a `src/validators/` directory
- Apply validation as middleware before the controller runs

```typescript
// src/validators/task.validator.ts
import { z } from 'zod';

export const createTaskSchema = z.object({
  assignedTo: z.string().uuid(),
  title: z.string().min(1).max(200),
  taskType: z.enum(['review-entries', 'call-patients', 'send-reminders', 'follow-up', 'export-data', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  relatedPatientIds: z.array(z.string().uuid()).optional(),
});
```

---

### 3. No ESLint or Prettier Configuration

**Problem:**
With 70+ source files and no linting or formatting config, code style is inconsistent and there's no automated check for common mistakes.

**Recommendation:**
- Add `eslint` + `@typescript-eslint/eslint-plugin` + `prettier`
- Add `lint` and `format` scripts to `package.json`
- Add a pre-commit hook via `husky` + `lint-staged` to enforce on every commit

---

### 4. Database `sync({ alter: true })` in Production

**Problem:**
`Dbconnetion.ts` calls `sequelize.sync({ alter: true })` on every server restart. This auto-modifies table schemas, which is dangerous with real patient and financial data in production.

**Recommendation:**
- Use Sequelize CLI migrations for all schema changes going forward
- Guard `sync({ alter: true })` behind `NODE_ENV === 'development'` immediately
- Remove it entirely once migrations are in place

---

### 5. `rejectUnauthorized: false` in SSL Config

**Problem:**
The database SSL configuration disables certificate verification. This makes the PostgreSQL connection vulnerable to man-in-the-middle attacks.

**Recommendation:**
- Use proper CA certificates in production (GCP Cloud SQL provides these)
- Only allow `rejectUnauthorized: false` in development behind an env check

---

### 6. No Structured Logging

**Problem:**
We're using `console.log()` and `console.error()` with emoji prefixes throughout the codebase. These aren't searchable, don't have log levels, and don't include request context.

**Recommendation:**
- Adopt `pino` (fastest Node.js logger) or `winston`
- Log levels: `error`, `warn`, `info`, `debug`
- Include request ID, user ID, and timestamp in every log entry
- JSON output in production, pretty-print in development
- Add `pino-http` for automatic HTTP request/response logging

---

### 7. No Global Error Handler — Repetitive Try-Catch in Controllers

**Problem:**
Every controller has its own try-catch block with slightly different error formatting. This leads to inconsistent error responses and duplicated code.

**Recommendation:**
- Create custom error classes in `src/errors/`:

```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}
```

- Add a single global error middleware in Express:

```typescript
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  // Unexpected errors — log full details, return generic message
  logger.error(err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});
```

- Services throw typed errors, controllers don't need try-catch anymore

---

### 8. Large Service Files Need Splitting

**Problem:**
Several services have grown too large:
- `wallet.service.ts` — 32 KB
- `bubbleScan.service.ts` — 19 KB
- `order.service.ts` — 16 KB
- `diary.service.ts` — 14 KB

Large files are harder to navigate, review, and maintain.

**Recommendation:**
- Split `wallet.service.ts` → `wallet-balance.service.ts`, `wallet-transaction.service.ts`, `payout.service.ts`
- Extract payment orchestration from `order.service.ts` into `payment.service.ts`
- Split `bubbleScan.service.ts` by processing stage (parsing, scoring, result storage)

---

### 9. No Rate Limiting on Auth Endpoints

**Problem:**
Endpoints like `/auth/login`, `/auth/verify-2fa`, and `/patient/verify-otp` have no rate limiting. This is a brute-force vulnerability — especially critical for OTP verification.

**Recommendation:**
- Add `express-rate-limit`
- Auth routes: 5 attempts per 15 minutes per IP
- General API: 100 requests per minute per user
- OTP verification: 3 attempts per OTP session

---

### 10. Overloaded Response Utility Functions

**Problem:**
`response.ts` has multiple overloaded signatures for `sendResponse` and `sendError` where the parameter order changes (data-first vs status-first). This is confusing and invites bugs.

**Recommendation:**
- Standardize to one signature per function:

```typescript
sendResponse(res: Response, statusCode: number, message: string, data?: any)
sendError(res: Response, statusCode: number, message: string, error?: any)
```

- Deprecate `responseMiddleware` and the alternate signatures
- Update all call sites to use the single standard

---

### 11. No Rate Limiting, Health Check, or Request Logging Middleware

**Problem:**
Missing standard production middleware that every API should have.

**Recommendation:**

| Middleware | Purpose | Package |
|-----------|---------|---------|
| Rate limiting | Prevent abuse | `express-rate-limit` |
| Request logging | HTTP access logs | `pino-http` or `morgan` |
| Health check | `GET /health` endpoint | Custom (check DB connection) |
| Helmet | Security headers | `helmet` |
| Request ID | Trace requests across logs | `uuid` + custom middleware |

---

### 12. No Environment Variable Validation at Startup

**Problem:**
If a required env var like `JWT_SECRET` or `DATABASE_HOST` is missing, the app starts but fails at runtime when that variable is first used. This makes debugging deployment issues harder.

**Recommendation:**
- Validate all required environment variables on application boot
- Fail fast with a clear error message listing what's missing

```typescript
const requiredEnvVars = [
  'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD',
  'JWT_SECRET', 'SMTP_USER', 'SMTP_PASSWORD',
  'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'
];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

---

### 13. No Docker or CI/CD Configuration

**Problem:**
No `Dockerfile`, `docker-compose.yml`, or GitHub Actions workflow. This means inconsistent dev environments across the team and manual deployments.

**Recommendation:**
- Add a `Dockerfile` for containerized builds
- Add `docker-compose.yml` for local development (API + PostgreSQL)
- Add GitHub Actions pipeline: lint → build → deploy

---

### 14. Internal Error Details Exposed to Clients

**Problem:**
Some error responses pass `error.message` directly to the client. In production, this can leak stack traces, SQL errors, or internal system details.

**Recommendation:**
- In production, always return generic error messages for 500 errors
- Log the full error server-side
- Only include detailed error info in development mode

---

### 15. No Database Transactions for Multi-Step Operations

**Problem:**
Operations like wallet top-up + transaction creation + balance update involve multiple DB writes but aren't wrapped in a transaction. If one step fails, data can end up in an inconsistent state.

**Recommendation:**
- Wrap all multi-step write operations in `sequelize.transaction()`
- Critical flows: wallet operations, order creation with split payments, diary activation

---

### 16. TypeScript Version Outdated

**Problem:**
Currently on TypeScript 4.9.5. We're missing performance improvements, better type inference, and decorator metadata support from TypeScript 5.x.

**Recommendation:**
- Upgrade to TypeScript 5.x
- Update `tsconfig.json` if needed for new compiler options

---

## Implementation Priority

| Priority | Task | Impact |
|----------|------|--------|
| P0 | Fix `sync({ alter: true })` — guard behind `NODE_ENV` | Data safety |
| P0 | Fix `rejectUnauthorized: false` in production SSL | Security |
| P1 | Add Repository pattern — separate DB access from services | Architecture |
| P1 | Add `zod` input validation | Security / Reliability |
| P1 | Add rate limiting on auth endpoints | Security |
| P1 | Custom error classes + global error handler | Code quality |
| P2 | ESLint + Prettier setup | Consistency |
| P2 | Structured logging with `pino` | Observability |
| P2 | Standardize response utilities | Code quality |
| P2 | Environment variable validation on startup | Reliability |
| P2 | Wrap multi-step DB operations in transactions | Data integrity |
| P3 | Split large service files | Maintainability |
| P3 | Add Docker + CI/CD | DevOps |
| P3 | Upgrade TypeScript to 5.x | DX / Performance |
| P3 | Add health check + request logging middleware | Observability |
| P3 | Stop exposing internal errors to clients | Security |

---

## Target Architecture After Changes

```
src/
├── config/            # DB, payment gateway, env validation
├── controllers/       # HTTP layer only — parse request, call service, send response
├── errors/            # Custom error classes (AppError, NotFoundError, etc.)
├── middleware/        # Auth, ownership, rate-limit, validation, error handler
├── models/            # Sequelize model definitions (no business logic)
├── repositories/      # All database queries live here
├── routes/            # Route definitions with validation middleware
├── services/          # Business logic only — depends on repositories
├── validators/        # Zod schemas per endpoint
├── utils/             # Helpers, constants, logger setup
├── scripts/           # DB scripts, seeders
└── index.ts           # App bootstrap with env validation
```

**Data flow:**
```
Request → Route → Validation Middleware → Auth Middleware → Controller → Service → Repository → Database
```
