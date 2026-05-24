# 🚀 Deploying to Netlify

This application is fully prepared and optimized for deploying as a serverless full-stack app on **Netlify**. 

The frontend built assets (Vite Single Page Application) are served statically with SPA history Routing support, and all server-side endpoints (Express backend) are automatically deployed as secure, scalable **Netlify Serverless Functions**.

---

## 🛠️ Zero-Config Deploy with `netlify.toml`

Everything Netlify needs is pre-configured in the included `netlify.toml` file.

- **Frontend Build Directory**: `dist`
- **Build Command**: `npm run build`
- **Serverless API Rewrites**: `/api/*` requests are seamlessly channeled to Netlify Functions.

---

## 📋 Simple Deployment Guide

### Option A: Via GitHub Connection (Recommended)
1. **Push your code** to a GitHub repository.
2. Go to [Netlify App](https://app.netlify.com/) and click **Add New Site** -> **Import an existing project**.
3. Choose **GitHub** and select this repository.
4. Netlify will automatically detect the settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy Site**.

### Option B: Via Netlify CLI
1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```
2. Log in to your Netlify account:
   ```bash
   netlify login
   ```
3. Initialize the deployment link:
   ```bash
   netlify init
   ```
4. Build and deploy:
   ```bash
   netlify deploy --build --prod
   ```

---

## 🔐 Required Environment Variables

To allow the AI Advisor, Admin report generation, and Firestore data updates to work correctly, configure these variables in your **Netlify Dashboard** (under *Site settings > Environment variables*):

| Variable Name | Description | Example / Location |
|---|---|---|
| **`GEMINI_API_KEY`** | Google Gemini API key used for the AI registration advisor & reports. | Get yours from [Google AI Studio](https://aistudio.google.com/) |
| **`FIREBASE_APPLET_CONFIG`** | The complete raw JSON string of your Firebase connection. | Copy the full contents of `./firebase-applet-config.json` |
| **`ADMIN_PASSWORD`** | Admin panel access password (optional). | Default: `Nahom@110108` if not provided |

> 💡 *Note: The application has robust fallbacks so that if the Firebase configuration is not present during build-time (e.g., CI/CD phase), compilation still completes flawlessly!*
