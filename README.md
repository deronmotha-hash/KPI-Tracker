# KPI Tracker

A lightweight KPI tracking app that runs in your browser and stores data in your own Google Sheet. Define your KPIs, log work against them, and export reports.

**Live app:** [https://deronmotha-hash.github.io/KPI-Tracker/](https://deronmotha-hash.github.io/KPI-Tracker/)

## Features

- Define custom KPIs with scope, metrics, and reporting methodology
- Log work entries against your KPIs with dates, descriptions, and evidence
- Dashboard showing entry counts and recent activity
- Filter and manage your work log
- Export a formatted HTML report
- Works on mobile, tablet, and desktop — add to your home screen for app-like access
- All data stored in your own Google Sheet (nothing stored in the browser)

## Setup (5 minutes)

Each person sets up their own Google Sheet backend. Your data stays private in your own Google Drive.

### 1. Create a Google Sheet

Go to [sheets.new](https://sheets.new) to create a blank spreadsheet.

### 2. Open the script editor

In your new sheet: **Extensions → Apps Script**

### 3. Paste the backend code

- In the script editor, select all the default code in `Code.gs` and delete it
- Open the [`backend-code.js`](backend-code.js) file from this repository
- Copy the entire contents and paste it into `Code.gs`
- Press **Ctrl+S** (or Cmd+S) to save

### 4. Run the setup

- In the toolbar, click the function dropdown (it may say `doGet`) and select **`setupSheet`**
- Click **▶ Run**
- Google will ask you to authorise — click **Review permissions → your account → Advanced → "Go to Untitled project (unsafe)" → Allow**
- You should see a popup: *"Setup complete"*
- Switch back to your spreadsheet — you'll see **KPIs** and **Entries** tabs

> The "unsafe" warning is normal. It's your own script accessing your own spreadsheet.

### 5. Deploy as a web app

Back in the script editor:

1. **Deploy → New deployment**
2. Click the ⚙ gear icon next to "Select type" → select **Web app**
3. Set **Execute as:** to **Me**
4. Set **Who has access:** to **Anyone**
5. Click **Deploy**
6. Copy the URL it gives you (starts with `https://script.google.com/macros/s/...`)

### 6. Connect the app

1. Open the [KPI Tracker app](https://yourusername.github.io/kpi-tracker/)
2. Paste your deployment URL
3. Enter your name and role (optional — used in exported reports)
4. Click **Connect**

You're done. Add your KPIs in the Framework tab, then start logging work.

### Mobile access

On your iPhone or iPad, open the app URL in Safari, tap the **Share** button, then **Add to Home Screen**. It launches full-screen like a native app.

## Updating the backend

If the backend code is updated, paste the new version into your Apps Script editor, then:

**Deploy → Manage deployments → ✏ edit → Version: New version → Deploy**

Your URL stays the same.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Anyone" option not available in deployment | Your Google account may be a Workspace/org account with restrictions. Use a personal Gmail account instead. |
| Authorisation loops or fails | Try in an incognito window logged into just one Google account. |
| "Could not reach API" in the app | Make sure you copied the **deployment** URL (ends in `/exec`), not the script editor URL. |
| Data not showing after connect | Check your Google Sheet — the KPIs and Entries tabs should have headers. If not, re-run `setupSheet`. |