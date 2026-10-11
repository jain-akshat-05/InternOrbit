# InternOrbit

InternOrbit is a MERN internship portal with separate student, recruiter, and administrator workflows. Students can search active postings, apply, and track status changes. Recruiters can manage their postings and review applications. Administrators can view platform statistics.

## Implemented Features

- Student and recruiter registration and login with bcrypt password hashing and seven-day JWTs.
- Student profile editing, profile-completion calculation, and private PDF resume upload, replacement, download, and guarded deletion.
- Public internship browsing/search, detail review, and recruiter-configured application questions.
- Resume-backed applications with required answers, duplicate prevention, status history, detail view, and controlled withdrawal.
- Recruiter posting create, list, edit, archive, and reactivate operations, with ownership checks. Archived postings retain applications and history.
- Recruiter application review, filters, candidate profile/resume access, forward-only status updates, and hiring-round management.
- Scheduled rounds, candidate assignments, private recruiter feedback, and separately published student-visible outcomes.
- Admin-only platform counts, application status breakdown, and recruiter posting statistics.
- Persistent, user-scoped notifications with Socket.IO delivery for applications, status changes, and round updates.
- Protected frontend routes and role-aware navigation.

Admin user-management is not implemented. Admin accounts must be provisioned outside public registration; registration only creates student or recruiter accounts. There is no online exam engine, automated grading, or video interview service; round links and outcomes are managed by recruiters.

## Stack and Architecture

- Frontend: React 18, React Router 6, Axios, Vite, and Socket.IO client.
- Backend: Node.js, Express 4, Mongoose 8, JWT, bcryptjs, and Socket.IO.
- Database: MongoDB.

The React app calls the Express API through Axios. The request interceptor adds the bearer token stored for the current user. Express verifies tokens and loads the current user from MongoDB before role checks. Mongoose schemas define users, internships, applications, resumes, hiring rounds, round assignments, and notifications; a unique `(internship, student)` index prevents duplicate applications. Resume bytes are stored under random filenames outside public static directories; MongoDB stores ownership and metadata. Socket.IO derives private rooms from verified JWT identities.

```text
backend/
	config/       db.js, env.js
	middleware/   auth.js, socketAuth.js
	models/       User.js, Internship.js, Application.js, Resume.js, HiringRound.js, RoundAssignment.js, Notification.js
	routes/       authRoutes.js, profileRoutes.js, internshipRoutes.js, applicationRoutes.js, roundRoutes.js, notificationRoutes.js, adminRoutes.js
	test/         Node built-in route/security test files
	utils/        apiErrors.js, notifications.js, resumeStorage.js
	storage/      private local resume files (ignored by Git)
	server.js
frontend/
	src/api/      Axios client
	src/components/ Navbar and ProtectedRoute
	src/context/  AuthContext
	src/pages/    student, recruiter, login/register, and admin screens
	src/socket.js Socket.IO client
```

## Prerequisites and Setup

Install Node.js and npm, and have a MongoDB instance available locally or remotely. From the repository root:

```bash
cd backend
npm ci
```

Create `backend/.env` with the following values. Replace the JWT placeholder with a randomly generated secret of at least 32 characters; do not use the placeholder in a deployed environment.

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/internorbit
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
PORT=5000
CLIENT_URL=http://localhost:5173
RESUME_MAX_BYTES=5242880
# Optional; defaults to backend/storage/resumes
# RESUME_STORAGE_DIR=D:/internorbit-private/resumes
```

Run the backend in development mode with `npm run dev` or start it with `npm start` from `backend/`. It validates required configuration and connects to MongoDB before opening the HTTP port. `CLIENT_URL` is the one allowed browser origin; if omitted, the development default is `http://localhost:5173`.

Resume uploads are PDF-only and default to a 5 MiB maximum. Files are stored outside public static directories. For production or multiple backend instances, configure a durable private volume or replace the local storage adapter with private object storage; keep downloads behind authenticated routes.

In a second terminal, install and run the frontend:

```bash
cd frontend
npm ci
npm run dev
```

The frontend defaults to `http://localhost:5000/api` for REST and `http://localhost:5000` for Socket.IO. Override these with `VITE_API_URL` and `VITE_SOCKET_URL` in the frontend environment when deploying.

## API

Protected HTTP endpoints use `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register as student or recruiter |
| POST | `/api/auth/login` | Public | Authenticate and receive a JWT |
| GET | `/api/auth/me` | Authenticated | Return the current user without the password |
| GET | `/api/profile/me` | Authenticated | Read the caller's profile and completion percentage |
| PUT | `/api/profile/me` | Student or recruiter | Update allowlisted profile/company fields |
| PUT | `/api/profile/me/resume` | Student | Upload/replace a PDF resume as an `application/pdf` raw body |
| GET | `/api/profile/me/resume` | Student | Download current resume |
| DELETE | `/api/profile/me/resume` | Student | Delete current resume only if no application references it |
| GET | `/api/profile/me/resumes/:resumeId/download` | Owning student | Download a previously submitted resume |
| GET | `/api/internships?search=&location=` | Public | Search active postings |
| GET | `/api/internships/:id` | Public | Read an active posting |
| POST | `/api/internships` | Recruiter or admin | Create a posting |
| GET | `/api/internships/recruiter/mine` | Recruiter or admin | List the current user's postings |
| PUT | `/api/internships/:id` | Owner recruiter or admin | Update an allowlisted set of posting fields |
| DELETE | `/api/internships/:id` | Owner recruiter or admin | Archive a posting while preserving applications |
| POST | `/api/applications` | Student | Apply to an active posting |
| GET | `/api/applications/mine` | Student | List the current user's applications |
| GET | `/api/applications/:id` | Applicant, posting recruiter, or admin | Read authorized application details and published round information |
| GET | `/api/applications/:id/resume` | Applicant, posting recruiter, or admin | Download the resume attached at submission |
| PATCH | `/api/applications/:id/withdraw` | Applicant | Withdraw before a terminal state |
| GET | `/api/applications/received` | Recruiter or admin | List applications for the current user's postings |
| PUT | `/api/applications/:id/status` | Owning recruiter or admin | Advance through allowed application states |
| GET | `/api/rounds/internship/:internshipId` | Owner recruiter or admin | List rounds for a posting |
| GET | `/api/rounds/upcoming/recruiter` | Recruiter or admin | List caller's published upcoming rounds |
| POST | `/api/rounds` | Owner recruiter or admin | Create a round |
| PUT | `/api/rounds/:id` | Owner recruiter or admin | Edit, schedule, and publish a round |
| DELETE | `/api/rounds/:id` | Owner recruiter or admin | Remove only before candidate assignments exist |
| GET | `/api/rounds/:id/assignments` | Owner recruiter or admin | Review assigned candidates and private feedback |
| POST | `/api/rounds/:id/assign` | Owner recruiter or admin | Assign eligible applicants |
| PUT | `/api/rounds/:id/results/:applicationId` | Owner recruiter or admin | Set outcome and control result publication |
| GET | `/api/notifications` | Authenticated | List the caller's persisted notifications |
| PATCH | `/api/notifications/:id/read` | Notification owner | Mark one notification as read |
| GET | `/api/admin/stats` | Admin | Read platform aggregate statistics |

Socket events include `new_application`, `application_status_update`, and `notification`. Clients cannot select a room identity; the server derives it from the verified JWT. Persisted notification and REST data remain the source of truth.

## Authorization and Security Notes

Public registration only accepts the student and recruiter roles. The administrator role is not assignable through that endpoint. Recruiter posting and round writes verify posting ownership. Candidate assignment validates every application against the round's internship. Student profile/application/resume operations are scoped to the authenticated student; recruiters can access candidates only for their own postings. Round notes remain private; student responses omit them and hide outcomes until published. Application status transitions are validated server-side.

JWTs are stored in browser local storage in this implementation. That keeps the setup simple but means an XSS vulnerability could expose a token; a production deployment should assess an HTTP-only cookie/session design, rate limiting, and token revocation. Do not commit `.env` files or use development secrets in production.

## Verification

From `backend/`, run `npm test` for the Node built-in test suite. From `frontend/`, run `npm run build` for the production build. Tests cover config, auth/roles, application validation/transitions, route ownership/order, resume validation/path safety, round permissions/result privacy, and socket identity. These are deterministic unit/route-handler tests; a full database-backed HTTP integration suite has not been run.

## Known Limitations

- MongoDB-backed routes and real-time delivery require a reachable MongoDB instance; full live-database integration tests have not been run.
- Local resume storage is for development. Production requires a durable private volume or private object-storage adapter and backups.
- Existing databases should be reviewed for legacy profile fields and indexes before deployment; no automated production migration runner is included.
- There is no pagination, password reset, email verification, or admin account-management workflow.
- No online examination engine, automated grading, or video interview integration is included.
- Authenticated workflows still need manual browser verification using student, recruiter, and admin accounts.

## Interview Guide

Use these as code-grounded study notes; explain the flow in your own words and distinguish current behavior from possible improvements.

**How does a request move through the system?** React pages call the Express API through Axios. Express middleware verifies the JWT and loads the user where authentication is required. A route applies role and ownership rules, Mongoose reads or writes MongoDB, and the JSON response updates React state.

**Why use React context and component state?** `AuthContext` shares the signed-in user's identity across navigation and configures the socket connection. Page-level state holds forms, results, loading, and error feedback, so a successful request can update the relevant view without reloading the application.

**What do Express middleware and route handlers do?** Middleware handles cross-cutting work such as authentication and role checks. Route handlers validate request data, enforce resource ownership, call Mongoose, and return an HTTP status and JSON body. Unexpected errors are mapped to a generic response rather than exposing database messages.

**What does Mongoose add, and how are duplicate applications prevented?** Mongoose defines typed schemas, required fields, enums, references, timestamps, and model operations. A unique compound index on `(internship, student)` makes duplicate prevention a database constraint, including concurrent submissions.

**How does JWT authentication work here?** Login verifies the submitted password with bcrypt and signs a seven-day token. Protected HTTP requests send it as a bearer token; middleware verifies it and reloads the user so authorization uses the current database role. The same signed identity authenticates Socket.IO.

**What is the difference between authentication, role authorization, and ownership?** Authentication establishes which user is making a request. `authorize` restricts broad roles, such as recruiter or admin. A further route check compares the posting or application's recruiter ID with the authenticated user's ID to enforce per-resource ownership.

**How are real-time updates scoped?** The client includes its JWT in the Socket.IO handshake. Server middleware verifies the token and assigns the signed user ID to socket data; the connection joins only that user's room. Route handlers emit new-application or status-update events to the corresponding room.

**How would you debug a missing recruiter posting?** Follow the browser request through the Axios base URL, Express route registration order, auth/role middleware, and Mongoose query. Static routes must be registered before a dynamic `/:id` route; a regression test now guards this specific case.

**What trade-offs and limitations should be discussed?** JWTs in local storage simplify browser requests but are exposed if an XSS bug exists. The project has no refresh/revocation, rate limiting, pagination, or database-backed end-to-end tests. Status notifications use Socket.IO, while MongoDB remains the source of persisted state.

## Author

Akshat Jain

GitHub: https://github.com/jain-akshat-05

