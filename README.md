# Church Pantry

Inventory management app for church food pantries. Track items, scan barcodes, manage donors, pack smart Bag & Go bags, and collaborate with your team.

## Quick Deploy (30 minutes)

### Step 1: Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `church-pantry` (or whatever you like)
3. Set it to **Public** or **Private** — either works
4. Do NOT check "Add a README" (we already have one)
5. Click **Create repository**

### Step 2: Push this code to GitHub

Open a terminal (or use the GitHub Desktop app) and run:

```bash
cd church-pantry
git init
git add .
git commit -m "Initial commit - Church Pantry app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/church-pantry.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

**If you prefer GitHub Desktop:**
1. Open GitHub Desktop
2. File → Add Local Repository → select this folder
3. Commit all files with message "Initial commit"
4. Publish repository

### Step 3: Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `church-pantry` repo
3. Leave all settings as default (Vercel auto-detects Next.js)
4. Click **Deploy**
5. Wait ~60 seconds — done!

You'll get a URL like `church-pantry.vercel.app` — that's your live app.

### Step 4: Open on your iPad

1. Open Safari on your iPad
2. Go to your Vercel URL
3. Tap the **Share** button (square with arrow)
4. Tap **Add to Home Screen**
5. Now it launches full-screen like a native app!

## Features

- **Inventory Management** — Track items with UPC codes, pricing, quantities, expiry dates, categories, and storage locations
- **Bulk Add / Bulk Edit** — Import many items at once or edit multiple items simultaneously
- **Barcode Scanner** — Scan UPC codes via phone camera (simulated for now, real scanning in Phase 2)
- **Bag & Go** — Smart packing suggestions based on family size, dietary needs, and FIFO rotation
- **Donor Tracking** — Record donors, donation history, and generate tax receipts
- **Recipient Management** — Track families served with dietary notes and visit history
- **Discussion Board** — Threaded conversations for pantry managers and volunteers
- **Expiration Alerts** — Notifications for items expiring soon or running low
- **Analytics Dashboard** — Visual breakdown of inventory, categories, and donor activity
- **Shared Access** — Invite team members with role-based permissions (Manager, Volunteer, Viewer)
- **Email Reports** — Configurable bi-weekly or monthly pantry summaries
- **Cloud Sync** — Real-time sync between web and mobile (requires backend in Phase 2)

## What's Next

This is Phase 1 — a fully working frontend. Data currently lives in the browser.

**Phase 2: Add a Backend**
- Set up Supabase (free) for database + user authentication
- Real cloud sync between all devices
- Shared access with actual login accounts
- Email report delivery

**Phase 3: Native Mobile App**
- Wrap with Capacitor for iOS/Android app store deployment
- Real camera-based barcode scanning
- Push notifications for expiration alerts

## Tech Stack

- **Next.js 14** — React framework
- **React 18** — UI library
- **Vercel** — Hosting (free tier)
- **PWA** — Installable on mobile devices
