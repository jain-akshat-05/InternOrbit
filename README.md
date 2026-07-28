# InternOrbit

A full-stack MERN internship portal — students browse/apply to internships,
recruiters post roles and manage applicants, admins see platform analytics.
Application status updates push live via Socket.io (no refresh needed).

## Stack
React (Vite) · Node.js · Express · MongoDB (Mongoose) · JWT auth · Socket.io

## Folder structure
```
internorbit/
  backend/     Express API, MongoDB models, JWT auth, Socket.io server
  frontend/    React app (Vite), pages for student/recruiter/admin
```

## Your 3–4 hour build plan

### Hour 1 — Get it running locally (30–45 min)
1. Install MongoDB locally, OR create a free cluster at mongodb.com/atlas
   and copy the connection string.
2. Backend:
   ```
   cd backend
   npm install
   cp .env.example .env      # then edit MONGO_URI and JWT_SECRET
   npm run dev                # or: npm start
   ```
   You should see "InternOrbit backend running on port 5000" and
   "MongoDB connected".
3. Frontend (new terminal):
   ```
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```
   Open http://localhost:5173

### Hour 1–2 — Verify the core flow works
1. Register a **recruiter** account (select role = Recruiter, add a company name).
2. Post an internship from the Recruiter Dashboard.
3. Log out, register a **student** account.
4. On the home page, apply to the internship you posted.
5. Log back in as the recruiter → open Recruiter Dashboard → change the
   application status. Switch back to the student tab (keep both logged in
   in separate browsers/incognito windows) and watch the status update
   live without refreshing — that's Socket.io working.
6. To test the admin dashboard, manually set a user's `role` field to
   `"admin"` in MongoDB (Compass or `mongosh`), then log in as them and
   visit `/admin`.

### Hour 2–3 — Customize / extend
Ideas if you have time left, roughly in order of impact for a demo:
- Add a resume upload field (even just a URL text field is fine — already
  scaffolded on the User model as `resumeUrl`).
- Add pagination or filters (e.g. stipend range) to the internship list.
- Add a "delete/edit posting" button to the recruiter dashboard (the
  backend routes for PUT/DELETE `/api/internships/:id` already exist).
- Polish the UI with better spacing/branding in `index.css`.
- Add form validation messages.

### Hour 3–4 — Deploy
- **Backend** → Render or Railway:
  - New Web Service, root directory `backend`, build command `npm install`,
    start command `npm start`.
  - Set env vars: `MONGO_URI` (use MongoDB Atlas, not local), `JWT_SECRET`,
    `CLIENT_URL` (your deployed frontend URL).
- **Frontend** → Vercel:
  - Root directory `frontend`, framework preset Vite.
  - Set env vars: `VITE_API_URL` (your deployed backend URL + `/api`),
    `VITE_SOCKET_URL` (your deployed backend URL).
- Update `CLIENT_URL` on the backend once you know the final Vercel URL,
  and redeploy the backend so CORS/Socket.io allow it.

## API quick reference
| Method | Route | Access |
|---|---|---|
| POST | /api/auth/register | public |
| POST | /api/auth/login | public |
| GET | /api/internships | public |
| POST | /api/internships | recruiter/admin |
| PUT/DELETE | /api/internships/:id | owning recruiter/admin |
| GET | /api/internships/recruiter/mine | recruiter/admin |
| POST | /api/applications | student |
| GET | /api/applications/mine | student |
| GET | /api/applications/received | recruiter/admin |
| PUT | /api/applications/:id/status | recruiter/admin |
| GET | /api/admin/stats | admin |

## Notes for your resume/interview talking points
- Role-based access control is enforced server-side via an `authorize()`
  middleware, not just hidden UI — a student token literally cannot hit
  the recruiter-only routes.
- Real-time status tracking uses per-user Socket.io rooms (`user:<id>`),
  so updates are pushed only to the relevant student/recruiter, not
  broadcast to everyone.
- Admin analytics use MongoDB aggregation pipelines (`$group`, `$lookup`)
  rather than pulling all documents and computing in JS.
