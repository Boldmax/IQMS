# IQMS v3.0 — SaaS Edition

Full-stack, multi-tenant quality management platform for oil & gas, fabrication, NDT inspection, and asset integrity environments — now architected for commercial SaaS deployment.

---

## What changed from v2 → v3 (SaaS transformation)

| Concern | v2 (Single-tenant) | v3 (SaaS) |
|---|---|---|
| **Data isolation** | Shared schema, no tenant boundary | `tenant_id` column on every table; all queries scoped |
| **Auth** | JWT with user + role | JWT includes `tenant_id`; middleware loads tenant on every request |
| **Signup** | Manual seed / admin creates users | `POST /api/onboard` — self-serve org + owner in one call |
| **User invites** | Admin creates users directly | Token-based invite email flow; `/accept-invite` activates account |
| **Plans** | No concept | `trial` → `starter` → `pro` → `enterprise` with enforced limits |
| **Feature gates** | All features always on | `requireFeature()` middleware blocks locked features at API layer |
| **UI gates** | None | `<FeatureGate>` component shows upgrade prompt for locked pages |
| **Trial** | No concept | 14-day trial with `TrialBanner` and expiry enforcement |
| **Billing** | None | `/billing` page with plan cards and upgrade flow (Stripe-ready) |
| **Rate limiting** | 500 req/15min global | Same global + tighter `authLimiter` (20/15min) on auth endpoints |
| **Project numbers** | Global sequence | Per-tenant sequence (each org starts at PRJ-001) |
| **Email uniqueness** | Global | Unique per tenant (same email can exist in two orgs) |
| **Seed data** | Single org | Two demo tenants: Chevron Nigeria (Pro), StartupNDT (Trial) |

---

## Architecture overview

```
POST /api/onboard          → Creates Tenant + owner User in one transaction
POST /api/auth/login       → Returns JWT + tenant context
─────────────────────────────────────────────────────
protect middleware         → Validates JWT, loads User + Tenant into req
tenantScope middleware     → Injects req.tenantScope / req.tenantCreate
requireFeature('welders')  → 402 if feature not in tenant.features
hasPermission('ncr','create') → 403 if user role lacks permission
─────────────────────────────────────────────────────
Controllers                → All queries include WHERE tenant_id = req.tenant.id
```

**Key security property:** A correctly-written controller that uses `req.tenantScope` in its WHERE clause cannot leak data across tenants, even if the JWT is valid. The middleware enforces the boundary at the framework layer, not the business logic layer.

---

## Plan feature matrix

| Feature | Trial | Starter | Pro | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Inspections, NCR, ITP, Punch List | ✓ | ✓ | ✓ | ✓ |
| Materials & Document control | — | ✓ | ✓ | ✓ |
| Audit trail | — | ✓ | ✓ | ✓ |
| Welder qualification | — | — | ✓ | ✓ |
| Equipment calibration | — | — | ✓ | ✓ |
| SPC charts | — | — | ✓ | ✓ |
| REST API access | — | — | — | ✓ |
| White-label branding | — | — | — | ✓ |
| SSO / SAML | — | — | — | ✓ |
| Max users | 5 | 10 | 25 | Unlimited |
| Max projects | 3 | 5 | Unlimited | Unlimited |

---

## Quick start

### 1. Install

```bash
cd iqms-saas
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Configure

```bash
cd server
cp .env.example .env
# Set DB_PASSWORD and JWT_SECRET
```

### 3. Create database

```bash
createdb iqms_saas_db
```

### 4. Seed

```bash
cd server
node seeds/seed.js
```

### 5. Run

```bash
cd ..
npm run dev
```

---

## Key new endpoints

### Public (no auth)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/onboard` | Create tenant + owner account (signup) |
| `POST` | `/api/accept-invite` | Accept invite token, set password |

### Tenant management (owner only)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tenant/me` | Tenant info, plan, usage stats |
| `PATCH` | `/api/tenant/settings` | Update name, timezone, branding |
| `POST` | `/api/tenant/invite` | Invite a user by email |
| `POST` | `/api/tenant/upgrade` | Upgrade plan (Stripe webhook in prod) |

---

## Demo credentials

### Chevron Nigeria (Pro plan — full features)
| Name | Email | Password | Role |
|---|---|---|---|
| Olabode Fasanya | o.fasanya@chevron-ng.demo | Demo1234! | Quality Manager |
| Chukwuma Eze | c.eze@chevron-ng.demo | Demo1234! | Welding Inspector |
| Amara Okonkwo | a.okonkwo@chevron-ng.demo | Demo1234! | QC Inspector |
| Balogun Adeyemi | b.adeyemi@chevron-ng.demo | Demo1234! | NDT Technician |
| Ngozi Adaora | n.adaora@chevron-ng.demo | Demo1234! | Document Controller |

### StartupNDT (Trial — 8 days left)
| Name | Email | Password | Role |
|---|---|---|---|
| Fatima Al-Hassan | admin@startupndt.demo | Demo1234! | Quality Manager |

---

## Production checklist

- [ ] Set `JWT_SECRET` to 32+ random characters
- [ ] Set strong `DB_PASSWORD`
- [ ] Configure `CLIENT_URL` to your domain
- [ ] Set up Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Configure SMTP for invite emails
- [ ] Set up S3 for document file uploads
- [ ] Add HTTPS / SSL certificate (nginx config already included)
- [ ] Set up a background job to send trial expiry reminder emails (3 days before)
- [ ] Enable PostgreSQL connection pooling (PgBouncer) for production load

---

## Phase 4 roadmap (next steps)

- **Stripe webhooks** — `customer.subscription.updated` / `invoice.payment_failed` to update `plan_status`
- **Email service** — Invite emails, trial reminders, NCR notifications via SendGrid/Resend
- **S3 document storage** — Replace local `/uploads` with signed S3 URLs
- **Usage metering** — Track API calls per tenant for enterprise billing
- **Admin panel** — Internal ops dashboard to view all tenants, MRR, churn
- **SSO** — Passport.js + `passport-saml` for enterprise Azure AD / Okta
# IQMS
