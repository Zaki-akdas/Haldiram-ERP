# Haldiram ERP

AI-powered sales order distribution, delivery, and cash settlement management system.

## Production

**Live URL:** https://haldiram-erp.vercel.app

## Repository

**GitHub:** https://github.com/Zaki-akdas/Haldiram-ERP

## Tech Stack

- **Framework:** Next.js 16 with Turbopack
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Session-based auth
- **Deployment:** Vercel

## Features

- Admin, Manager, and Salesperson roles
- Dashboard with real-time stats
- Sales Orders management
- Customer management with assignment
- Inventory management
- AI-powered invoice extraction
- Field bill punching
- Collections and settlements
- Reports and analytics
- Activity logs

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

Required for production:

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_JWKS_URL=...
```

## License

Copyright © 2026 Zaki
