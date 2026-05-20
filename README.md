PhishGuard

A multi-tenant phishing simulation and security awareness training platform. Organizations run simulated phishing campaigns against their own employees, track who clicks, and assign security quizzes — all from a single self-hosted web application.

Features

Admin Portal
- Phishing Campaigns — compose email templates with a `{{trackUrl}}` placeholder, add employee targets, configure per-campaign Gmail SMTP credentials, send immediately or schedule for future delivery, and monitor real-time click counts and rates
- Quiz Management — create and publish multiple-choice quizzes with per-question explanations and an optional passing score threshold
- Bulk Assignments — assign any published quiz to one or more employees at once using a checkbox picker with Select All / Deselect All
- User Management — create employee accounts, deactivate or reactivate users
- Attempt Review — inspect per-question results for any completed quiz attempt

Employee Portal
- Dashboard — KPI cards (assigned, completed, average score, phishing clicks), upcoming assignments with color-coded due-date badges, recent quiz results, and a daily security tip
- Quiz Taking — question-by-question interface with draft saving, submission, and instant per-question feedback with explanations

Phishing Engine
- Each target receives a uniquely tokenized email link
- Clicking the link records the event in the database and returns a branded awareness page — no frontend redirect required, works with a single external tunnel
- Campaigns can be scheduled; a cron job dispatches due campaigns automatically every minute


Tech Stack

Frontend - React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6, Axios |
Backend - NestJS, TypeScript, Prisma ORM, PostgreSQL |
Auth - JWT access tokens (15 min) + rotating refresh tokens (7 days, httpOnly cookie) |
Email - Nodemailer with per-campaign Gmail App Passwords |
Scheduling - `@nestjs/schedule` cron (runs every minute) |

Getting Started

Prerequisites
- Node.js 20+
- Docker + Docker Compose (for PostgreSQL)
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) for each phishing campaign

1. Start the database

```bash
docker-compose up -d db
2. Configure environment
backend/.env

PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/phishing-training?schema=public

JWT_ACCESS_SECRET="change-me-in-production"
JWT_REFRESH_SECRET="change-me-in-production-too"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_DOMAIN=localhost

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM="PhishGuard" <your-gmail@gmail.com>

# Public URL of this backend — used to build tracking links in phishing emails
# For local dev with ngrok: set this to your ngrok URL (e.g. https://abc123.ngrok-free.app)
APP_URL=http://localhost:3000
frontend/.env

# Backend URL — use your ngrok URL here when testing from external devices
VITE_API_URL=http://localhost:3000
3. Install and migrate (backend)
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run start:dev
Backend runs at http://localhost:3000. Health check: GET /api/health

4. Install and run (frontend)
cd frontend
npm install
npm run dev
Frontend runs at http://localhost:5173.

External Access (ngrok)
To send real phishing emails with working tracking links, the backend must be publicly reachable. With a free ngrok account you get one tunnel at a time:

ngrok http 3000
Copy the generated URL (e.g. https://abc123.ngrok-free.app) and set it in both env files:

# backend/.env
APP_URL=https://abc123.ngrok-free.app

# frontend/.env
VITE_API_URL=https://abc123.ngrok-free.app
Also add the ngrok hostname to frontend/vite.config.ts:

server: {
  allowedHosts: ['abc123.ngrok-free.app'],
}
Restart both servers after any env change. Note: the free ngrok tier generates a new URL on each restart — update all three locations when that happens.

Authentication Flow
Step	Endpoint	Notes
Register	POST /api/auth/register	Creates org + admin account, sends verification email
Verify email	POST /api/auth/verify	Submits the 6-digit code, activates account
Login	POST /api/auth/login	Returns access token in body, refresh token in httpOnly cookie
Refresh	POST /api/auth/refresh	Exchanges cookie for a new access token; rotates refresh token
Logout	POST /api/auth/logout	Revokes refresh token, clears cookie
Role-based routing: admins land on /admin, employees land on /employee.

Phishing Campaign Workflow
Create a campaign — give it a name, sender display name (e.g. IT Help Desk), subject, and HTML body using {{trackUrl}} where the link should appear
Add targets — select employees from your org's user list
Configure SMTP — enter a Gmail address and its App Password under the campaign's settings
Send or schedule — emails are dispatched immediately, or at the scheduled time via cron
Monitor — the campaign detail page shows per-target email sent and click timestamps, plus an overall click rate
When a target clicks the link they receive a PhishGuard-branded awareness page explaining the simulation.