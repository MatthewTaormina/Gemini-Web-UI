# Installation & Setup

Follow these steps to get the Gemini Web UI running on your local machine or server.

## 1. Prerequisites
- **Node.js** (v18+)
- **PostgreSQL** (v14+)
- **NPM** or **Yarn**

---

## 2. Configuration

1.  **Environment Variables**: Create a `.env` file in the root directory (use `.env.example` as a template).
    ```bash
    DATABASE_URL=postgres://user:password@localhost:5432/gemini_ui
    PORT=3001
    STORAGE_PATH=./storage_data
    ```
2.  **Database Connection**: Ensure the PostgreSQL service is running and the database specified in `DATABASE_URL` exists.

---

## 3. Database Initialization

Run the following command to create the initial tables, triggers, and seed data (roles and permissions):
```bash
npm run db:setup
```
*Note: This will not overwrite existing data unless specified.*

---

## 4. Initial Root Setup

1.  **Start the System**:
    ```bash
    npm run dev
    ```
2.  **Open in Browser**: Navigate to `http://localhost:3000`.
3.  **Setup Mode**: The system will automatically detect if no users exist and redirect you to the **Initial Setup** page.
4.  **Create Root Account**: Enter a username and a strong password (minimum 8 characters, one number, and one special character).
5.  **Success**: Upon successful creation, you will be redirected to the login page.

---

## 5. Deployment

1.  **Build**:
    ```bash
    npm run build
    ```
2.  **Start Production**:
    ```bash
    npm start
    ```
3.  **Proxy Configuration**: Ensure your web server (Nginx/Apache) correctly proxies requests from the frontend to the backend API at `/api`.
