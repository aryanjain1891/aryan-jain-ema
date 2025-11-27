# Deployment Instructions

To deploy this application to Vercel, run the following command in your terminal:

```bash
npx vercel
```

**Steps:**
1.  **Login**: The command will ask you to log in. It will open your browser.
2.  **Setup**:
    -   "Set up and deploy?" -> **Yes** (`y`)
    -   "Which scope?" -> Select your account.
    -   "Link to existing project?" -> **No** (`n`)
    -   "Project Name" -> Press Enter (default) or type a name.
    -   "In which directory?" -> Press Enter (default `./`).
3.  **Build Settings**:
    -   Vercel should automatically detect **Vite**.
    -   If asked to override settings, you can usually say **No** (`n`) as the defaults are correct for Vite (`npm run build` and `dist`).

Once finished, it will give you a **Production** URL.
