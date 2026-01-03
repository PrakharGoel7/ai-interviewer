## Deploying the Flask API + interviewer pages (Render setup)

1. **Connect the repo**
   - Push this repository to GitHub (or GitLab) if it is not there already.
   - In Render, click **New → Web Service** and pick this repo/branch.

2. **Render detects the config**
   - `render.yaml` and `Procfile` already describe the service (Python 3.11, `pip install -r requirements.txt`, `gunicorn web_server:app`).
   - If Render ignores the manifest you can enter the same commands manually.

3. **Environment variables**
   - In the Render dashboard, add the following keys (the manifest marks them as `sync:false` so you can fill them securely):
     - `OPENAI_API_KEY`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_ANON_KEY`
     - Optional tweaks: `MODEL`, `STT_MODEL`, `TTS_MODEL`, etc.

4. **Static interviewer pages**
   - `Flask(__name__, static_folder="frontend", static_url_path="")` already serves the landing page (`/`), `interview.html`, `ib_interview.html`, `report.html`, and related assets.
   - The same Render service therefore hosts both the API (`/api/*`) and these HTML pages.

5. **Deploy**
   - Click **Create Web Service**. Render will install dependencies (including `gunicorn` added to `requirements.txt`) and boot the app.
   - Once live, visit the Render URL to confirm `/, /interview.html, /ib_interview.html` all work and the `/api/*` endpoints respond.

6. **Custom domain (optional)**
   - Add your domain under the Render service’s **Settings → Custom Domains**, then update your DNS records as instructed.

With Part A deployed you can now point the React dashboard (Netlify/Vercel) at the Render base URL for all `/api/...` calls.
