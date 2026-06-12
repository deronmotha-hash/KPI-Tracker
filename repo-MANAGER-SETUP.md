# KPI Tracker — Manager Setup

The manager app lets you view your team's KPI trackers (read-only), add review scores and notes, assign appraisal tasks, and export review reports.

**Manager app:** [https://deronmotha-hash.github.io/KPI-Tracker/manager-app.html](https://deronmotha-hash.github.io/KPI-Tracker/manager-app.html)

## How it works

- You have your own Google Sheet backend storing your **employee register** and your **reviews** (scores/notes). Nobody else can access it.
- Employee KPI data is read directly from each employee's own tracker via their deployment URL. The manager app never modifies their entries or KPIs.
- Appraisal tasks you assign are written into each employee's sheet, where they respond from their own app.

## Setup (5 minutes)

### 1. Create your manager Google Sheet

Go to [sheets.new](https://sheets.new). This sheet will hold your employee register and reviews — keep it separate from any personal KPI tracker sheet.

### 2. Open the script editor

**Extensions → Apps Script**

### 3. Paste the manager backend code

- Delete the default contents of `Code.gs`
- Copy everything from [`manager-backend.js`](manager-backend.js) in this repository and paste it in
- Press **Ctrl+S** to save

### 4. Run the setup

- Function dropdown → select **`setupSheet`** → click **▶ Run**
- Authorise when prompted (Review permissions → your account → Advanced → "Go to … (unsafe)" → Allow)
- You should see *"Manager backend setup complete"* and Employees + Reviews tabs in your sheet

### 5. Deploy as a web app

- **Deploy → New deployment** → gear icon → **Web app**
- Execute as: **Me**
- Who has access: **Anyone**
- **Deploy**, then copy the URL

### 6. Connect the manager app

Open the manager app link above, paste your deployment URL, add your name (used on exported reports), and **Connect**.

### 7. Add your team

Go to the **Employees** tab → **+ Add Employee**. For each person you need:
- Their name and job title
- **Their tracker deployment URL** — ask each employee to send you the Apps Script deployment URL from their own KPI tracker setup (the same URL they pasted into their own app settings)

Once added, select them in the dropdown on any page to view their data.

## Day-to-day use

| Task | Where |
|------|-------|
| View an employee's KPI progress | Dashboard — select employee, click KPI cards to expand |
| Score a KPI / add notes | Expand a KPI card (Dashboard or Framework) → Add review |
| Browse their full work log | Work Log tab (read-only) |
| Assign appraisal sections | Appraisal tab → + Assign Task → pick template → tick employees |
| Read appraisal responses | Dashboard (below KPI cards) or Appraisal tab |
| Export a review report | Select employee → Export ↓ (includes your scores, notes, and their appraisal responses) |

## Notes

- **Updating the backend later:** paste new code into Apps Script, then Deploy → Manage deployments → ✏ → New version → Deploy. Never rerun `setupSheet` on a live sheet — it clears the tabs.
- Employees must be running the current backend version to receive appraisal tasks. If assignment fails for someone, ask them to update their backend code from this repo and redeploy.
- Your reviews and the employee register live only in your sheet. Removing an employee deletes your reviews of them but never touches their own tracker.
