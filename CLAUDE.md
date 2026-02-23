# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `npm run dev` - Start development server (port 3007)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run tsc` - TypeScript type checking (no emit)

### Database Commands

- `npm run studio` - Open Prisma Studio
- `npm run db:migrate` - Run database migrations (dev)
- `npm run migratedev` - Alias for db:migrate
- `npm run db:deploy` - Deploy migrations to production

**IMPORTANT: NEVER use `npx prisma db push`. Always use `npm run migratedev` for schema changes. This ensures proper migration history is maintained.**

### Utility Scripts

- `npm run stripe:products` - Create Stripe products

## Architecture Overview

This is a Next.js application with a tRPC backend for SlopMog - a service that creates Reddit comments to boost AI search rankings. The brand is fun/irreverent.

### Tech Stack

- **Frontend**: Next.js (Pages Router only), Tailwind CSS, Radix UI components, Lucide icons, next-auth, react hook form
- **Backend**: tRPC for API endpoints, Prisma ORM, PostgreSQL
- **Authentication**: NextAuth.js with Prisma adapter
- **Payments**: Stripe integration (subscriptions + one-time credit purchases)
- **Monitoring**: Sentry for error tracking (when added)
- **Infrastructure**: Docker Compose for local dev (Postgres 5457, Redis 6406)

### Key Architecture Patterns

#### tRPC Structure

- All API routes are defined in `src/routers/` directory
- Main router aggregated in `src/server/root.ts`
- Authentication middleware in `src/server/trpc.ts`
- Import tRPC client: `import { trpc } from "@/utils/trpc"`
- Import routers: `import { campaignRouter } from "@/routers/campaign"`

#### Database & Models

- Prisma schema in `prisma/schema.prisma`
- Key models: User, Campaign, CampaignKeyword, StripeCustomer, StripeSubscription
- Import Prisma client: `import { prisma } from "@/server/utils/db"`
- Setup indexes for Prisma where it makes sense

#### Background Processing

- Redis available at localhost:6406 for future queue/caching needs

## Code Style & Conventions

### Key Principles

- Write concise, technical TypeScript code with accurate examples
- Next auth Session should only handle non-critical information as it isn't updated often
- Use the "function" keyword for pure functions
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements
- Use declarative JSX

### TypeScript Types

- Never use `any` type - use type inference, typeof, or direct types
- For tRPC output types: `inferProcedureOutput<AppRouter["router"]["procedure"]>`
- Use Prisma-generated types for database models
- Never use any for Prisma queries, Prisma is typed so always use Prisma types for specific model

### UI and Styling

- Use Shadcn UI, Radix, and Tailwind for components and styling
- Use Lucide for icons and Sonner for toast
- Implement responsive design with Tailwind CSS; use a mobile-first approach
- Setup empty states for anything that a user can "create"

### Brand & Design Vibe

See `DESIGN.md` for the full design system. Key points:

- **Personality:** Fun, irreverent, self-aware. Copy is conversational and self-deprecating — not corporate. Think "friend who's good at marketing" not "agency pitch deck."
- **Fonts:** Quicksand (headings), Nunito (body) — loaded via `_document.tsx`
- **Colors:** Warm cream bg (`#FFF8F0`), teal primary (`#2EC4B6`), coral actions (`#FF6B6B`), yellow accents (`#FFD93D`), lavender decorative (`#B197FC`), charcoal text (`#2D3047`). Brand tokens are in both CSS variables and `tailwind.config.js`.
- **Mascot:** A coral blob character with antenna, eyes, and arms. Reuse the `MascotBlob` component at different sizes via parent CSS context classes.
- **Landing page CSS** lives in `globals.css` (custom animations, mascot, sections) — not Tailwind utilities — because of heavy animation/pseudo-element usage.
- **Buttons** are pill-shaped (border-radius 50px). Coral = primary action, teal outline = secondary.
- **Cards** use soft shadows, subtle borders, and lift on hover.

### Performance Optimization

- Only use pages router, no app router
- Use tRPC endpoints for backend and fetching, don't create a Next.js API unless it's a webhook or something that needs to be communicated externally
- Use tRPC queries for data handling

### Import Paths

- `@/*` maps to `src/*`
- `@/server/*` maps to `src/server/*`
- `@/routers/*` maps to `src/routers/*`
- `@/components/*` maps to `src/components/*`
- `@/lib/*` maps to `src/lib/*`
- `@/styles/*` maps to `src/styles/*`
- `@/utils/*` maps to `src/utils/*`

### SEO Implementation

- Include meta title, description, and OpenGraph tags when creating a Next.js page
- Use a `<Seo>` component for all pages (create when needed)

### Docker & Local Dev

- `docker compose up -d` to start Postgres + Redis
- Postgres: localhost:5457 (user: postgres, pass: postgres, db: slopmog)
- Redis: localhost:6406
- Stripe CLI container forwards webhooks to localhost:3007/api/webhooks/stripe

### Reference Projects

- `/Users/govind/Documents/aieasyphoto` — sister project with shared tech stack (Next.js Pages Router, tRPC, Prisma, Stripe). Useful reference for OG image generation, auth patterns, and deployment setup.
