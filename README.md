# 1. Initialize local Git repository
git init

# 2. Stage and commit files
git add .
git commit -m "feat: real-time obstacle detection with sensory calibration overlays"

# 3. Create 'main' branch and link your GitHub remote
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 4. Push to origin
git push -u origin main
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d8985470-b34a-4207-85d8-c530d13aab07

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
