# 🔄 Brightloop — Subscription Management System

A modern, full-stack Subscription Management System built for seamless handling of recurring billing, user roles, customer subscriptions, and business operations.

---

## ✨ Features

- **🔐 Multi-Role Authentication & Authorization**
  - **Admin**: Full control over users, subscriptions, billing, and system metrics.
  - **Staff**: Operational access for customer management and subscription processing.
  - **Customer**: Self-service portal to browse plans, manage active subscriptions, and view invoices.
- **🛡️ Secure JWT Authentication**
  - Access tokens (short-lived) & Refresh tokens (stored securely).
  - Rate limiting on sensitive endpoints (login, register, forgot-password).
  - Password hashing with bcrypt.
- **⚡ Single Page Application (SPA)**
  - Fast, reactive client-side router without heavy external frameworks.
  - Reusable UI component library (modals, tables, toast notifications, loading spinners).
  - Fully responsive design with modern CSS variables.
- **📦 Reliable Data Persistence**
  - Fast embedded SQLite database using `better-sqlite3` with WAL (Write-Ahead Logging) enabled.
  - Automatic migration and seeding utilities.
- **📧 Email Notifications**
  - Integrated mailer service for password reset links and account notifications (with development fallback).

---

## 🏗️ Architecture & Project Structure

```
Subscription Management System/
├── backend/
│   ├── config/
│   │   └── database.js          # SQLite connection and schema setup
│   ├── controllers/
│   │   ├── authController.js    # Authentication & token logic
│   │   └── userController.js    # User CRUD & profile operations
│   ├── middleware/
│   │   ├── auth.js              # JWT validation & role guards
│   │   └── validation.js        # Request input sanitization & checks
│   ├── routes/
│   │   ├── auth.js              # Auth endpoints (/api/auth)
│   │   └── users.js             # User endpoints (/api/users)
│   ├── utils/
│   │   └── email.js             # Nodemailer integration
│   ├── seed.js                  # Database seeder script
│   ├── server.js                # Express app entry & static file server
│   ├── package.json             # Backend dependencies & npm scripts
│   └── .env.example             # Environment variable templates
├── frontend/
│   ├── css/
│   │   └── styles.css           # Global stylesheet & design system
│   ├── js/
│   │   ├── api.js               # Centralized fetch wrapper & HTTP client
│   │   ├── app.js               # Frontend bootstrap entry point
│   │   ├── auth.js              # Client auth state & token storage
│   │   ├── components.js        # UI components (Toast, Modal, StatCard, Table)
│   │   ├── config.js            # Frontend environment configuration
│   │   ├── dashboards.js        # Admin, Staff, and Customer dashboard views
│   │   ├── pages.js             # Auth pages (Login, Register, Forgot Password)
│   │   └── router.js            # Client-side hash/path router
│   └── index.html               # Main HTML entry
├── .gitignore                   # Ignored files (node_modules, .env, DBs)
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18 or higher
- **npm** v9 or higher

### 2. Installation
Navigate into the backend directory and install dependencies:
```bash
cd backend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Seed the Database
Initialize tables and create the default admin account:
```bash
npm run seed
```

### 5. Run the Server
```bash
# Start server in production mode
npm start

# Or start in development mode with auto-reload
npm run dev
```

### 6. Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🔑 Default Credentials

| Role | Email | Password |
|---|---|---|
| **System Admin** | `admin@brightloop.com` | `Admin@123!` |

*(Recommended: Change password immediately upon first login)*

---

## 📡 API Reference Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new customer account | No |
| `POST` | `/api/auth/login` | Login and obtain JWT tokens | No |
| `POST` | `/api/auth/refresh` | Refresh expired access token | No |
| `POST` | `/api/auth/logout` | Revoke active refresh token | Yes |
| `POST` | `/api/auth/forgot-password` | Request password reset email | No |
| `POST` | `/api/auth/reset-password` | Set new password with token | No |
| `GET` | `/api/users/me` | Fetch authenticated user profile | Yes |
| `GET` | `/api/users` | List all users with pagination | Yes (Admin/Staff) |
| `PUT` | `/api/users/:id/role` | Update user role | Yes (Admin) |
| `DELETE`| `/api/users/:id` | Deactivate/delete user account | Yes (Admin) |
| `GET` | `/api/health` | Service health status | No |

---

## 📄 License
This project is licensed under the MIT License.
