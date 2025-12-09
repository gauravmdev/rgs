# RGSDA -  App

A comprehensive delivery management system comprising a backend API, real-time socket services, and three distinct frontend applications for Admins, Managers, and Delivery Staff.

## 🚀 Tech Stack

### Backend (`/backend`)
*   **Runtime:** [Bun](https://bun.sh) / Node.js
*   **Framework:** [Hono](https://hono.dev)
*   **Database:** PostgreSQL
*   **ORM:** [Drizzle ORM](https://orm.drizzle.team)
*   **Real-time:** [Socket.IO](https://socket.io) with Redis Adapter
*   **Caching:** Redis

### Frontends
Built with [React](https://react.dev), [Vite](https://vitejs.dev), and [Tailwind CSS](https://tailwindcss.com).
*   **Admin Dashboard** (`/admin-dashboard`): Analytics, User Management, Master Data.
*   **Manager Portal** (`/manager-portal`): Order Processing, Customer Management.
*   **Delivery Boy App** (`/delivery-boy-app`): Order Assignments, Delivery Status.

## 🛠 Prerequisites

*   **Runtime:** [Bun](https://bun.sh) (Recommended) or Node.js v18+
*   **Database:** PostgreSQL
*   **Cache:** Redis

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd rgsda
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    bun install
    ```
    *   Create a `.env` file in `backend/` based on `.env.example` (if available) or ensure the following variables are set:
        ```env
        DATABASE_URL=postgresql://user:password@localhost:5432/rgsda
        REDIS_URL=redis://localhost:6379
        PORT=3000
        JWT_SECRET=your_jwt_secret
        ```
    *   **Database Migration & Seeding:**
        ```bash
        # Push schema to database
        bun run db:push

        # Seed initial data
        bun run db:seed
        ```

3.  **Frontend Setup:**
    Repeat for each frontend directory (`admin-dashboard`, `manager-portal`, `delivery-boy-app`):
    ```bash
    cd <directory-name>
    bun install
    ```

## 🏃‍♂️ Running the Applications

### Backend
Start the development server:
```bash
cd backend
bun run dev
```
*Server runs on `http://localhost:3000`*

### Frontends
Run each frontend in a separate terminal:

*   **Admin Dashboard:**
    ```bash
    cd admin-dashboard
    bun run dev
    ```
*   **Manager Portal:**
    ```bash
    cd manager-portal
    bun run dev
    ```
*   **Delivery Boy App:**
    ```bash
    cd delivery-boy-app
    bun run dev
    ```

*Vite will typically assign ports starting from `5173` (e.g., 5173, 5174, 5175).*

## 📂 Project Structure

```
rgsda/
├── backend/                # Hono API & WebSocket Server
│   ├── src/
│   │   ├── db/             # Drizzle Schema & Migrations
│   │   ├── routes/         # API Routes
│   │   ├── config/         # Redis & App Config
│   │   └── index.ts        # Entry Point
├── admin-dashboard/        # React Admin App
├── manager-portal/         # React Manager App
├── delivery-boy-app/       # React Delivery Staff App
└── nginx.conf              # Nginx Configuration for serving static builds
```

## 🔒 Environment Variables

Ensure all `.env` files are properly configured before running the application. The backend relies heavily on `DATABASE_URL` and `REDIS_URL`. Frontends may require `VITE_API_URL` if not proxying requests.

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.
