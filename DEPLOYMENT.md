# 🚀 Polar-Ops Cloud Deployment Guide

This repository is fully configured for multi-cloud deployment. You can deploy it to **Render**, **Railway**, **Vercel**, or any **Docker VPS**.

---

## 🌟 Option 1: 1-Click Deployment on Render (Recommended)

Render offers a free tier and supports **Blueprints** (`render.yaml`) which deploys both the backend API and frontend Next.js application automatically with a single click.

### Steps:
1. **Push your code to GitHub:**
   ```bash
   # Create a new repository on https://github.com/new
   git remote add origin https://github.com/<your-username>/polar-ops.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** in the top navigation and select **Blueprint**.
   - Connect your GitHub repository.
   - Render will detect [`render.yaml`](file:///c:/Users/ABHISHEK/OneDrive/Desktop/SIH26062/polar-ops/render.yaml) automatically.
   - Click **Apply**.

3. **Database (Zero-Config or Atlas):**
   - **Zero Config (Default):** If `MONGODB_URI` is left unset, the backend API will automatically run the built-in embedded in-memory database and seed the 47th Antarctic Season world instantly!
   - **Persistent Cloud Database (Optional):** Create a free database on [MongoDB Atlas](https://www.mongodb.com/atlas/database) and paste your connection string into `MONGODB_URI` under `polar-ops-api` environment variables.

---

## 🚂 Option 2: Railway Deployment

Railway automatically deploys monorepos and provides integrated MongoDB.

### Steps:
1. Go to [railway.app](https://railway.app) and click **New Project** → **Deploy from GitHub repo**.
2. Select your repository.
3. Add a **MongoDB plugin** (New → Database → MongoDB).
4. Configure two services:
   - **API Service:**
     - Root Directory: `/`
     - Build Command: `npm install && npm run build:api`
     - Start Command: `npm run start:api`
     - Variable: `MONGODB_URI = ${{Mongo.MONGO_URL}}`
     - Variable: `PORT = 4000`
   - **Web Service:**
     - Root Directory: `/`
     - Build Command: `npm install && npm run build:web`
     - Start Command: `npm run start:web`
     - Variable: `NEXT_PUBLIC_API_URL = https://<your-api-service>.up.railway.app/api/v1`

---

## ▲ Option 3: Vercel (Frontend) + Render/Railway (Backend)

For the fastest Next.js edge performance:
1. Deploy the backend API to Render or Railway using the steps above. Note your backend URL (e.g. `https://polar-ops-api.onrender.com`).
2. Go to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
3. Import your GitHub repository.
4. Set:
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm run build:shared && next build`
   - **Environment Variable:**
     - `NEXT_PUBLIC_API_URL`: `https://polar-ops-api.onrender.com/api/v1`
5. Click **Deploy**.

---

## 🐳 Option 4: Deploy on Any VPS / Server with Docker Compose

If you have a Linux VPS (AWS EC2, DigitalOcean, Hetzner, etc.):

```bash
# Clone the repository
git clone https://github.com/<your-username>/polar-ops.git
cd polar-ops

# Start all services (MongoDB + API + Web) in the background
docker compose up -d --build
```
Your app will be live at:
- Web Console: `http://<your-vps-ip>:3000`
- API Backend: `http://<your-vps-ip>:4000/api/v1`
