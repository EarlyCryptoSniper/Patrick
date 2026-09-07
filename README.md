# LockIn — Phase 1

Habit commitment tool. Geen kansspel. Geen pot, geen odds, geen winst van anderen.
V1 schrijft geen geld af.

Herbouwd vanaf nul; ontwerp is gerouteerd via de skills in `.claude/skills`
(zie onderaan "Ontwerpaantekeningen").

## Stack

- React + TypeScript + Vite + Tailwind
- Supabase: Auth (email magic-link), Postgres, RLS, Storage
- Schrijven alleen via RPC's — de tabel heeft geen insert/update/delete-grant
  voor `authenticated`, en RLS staat aan zonder write-policy. Zie
  `supabase/migrations/20260907000000_phase1_foundation.sql`.

## Lokaal starten

```bash
cp .env.example .env.local
# vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Gebruik **alleen** de anon/publishable key. Nooit de service-role key in deze app.

## Supabase — handmatige stappen

1. Nieuw project op https://supabase.com
2. Authentication → Providers: Email aan
3. Authentication → URL configuration:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`
4. SQL Editor: plak en run
   `supabase/migrations/20260907000000_phase1_foundation.sql`
5. Database → Extensions: zet `pg_cron` aan als je automatische expiry wilt
   (roept dan `expire_due_commitments()` als privileged role aan, buiten
   een user-sessie om, dus globaal in plaats van per gebruiker).
   Zonder cron expire't de app nog steeds als iemand het dashboard opent —
   `useCommitments` roept de RPC self-heal aan op elke load.
6. Storage: bucket `commitment-proofs` wordt door de migratie aangemaakt
   (privé). Upload-UI volgt in Phase 2.

## Statusmachine

```
draft --lock--> locked --foto op tijd--> completed
                     \--deadline--> failed
```

Geen `charged`. Geen terug-transities. Client-side guards in
`src/features/commitments/stateMachine.ts` spiegelen deze regels voor de UI
(knoppen uit/aan); de RPC's in de migratie zijn de bron van waarheid en
controleren elke transitie zelf opnieuw.

## RPC's

| Functie | Doel |
|---|---|
| `create_commitment_draft` | Rij aanmaken, status draft |
| `lock_commitment` | Tekenen, `signed_at = now()` |
| `finalize_proof` | Foto-pad vastleggen, completed (backend klaar, geen UI in Phase 1) |
| `delete_draft` | Alleen eigen draft weg |
| `expire_due_commitments` | locked + deadline voorbij → failed; self-scoped bij een user-sessie, globaal zonder |

## Checks

```bash
npm run check        # typecheck + write-boundary lint + vitest
```

Er is geen live Supabase-project gekoppeld aan deze checkout, dus de RPC's
zelf zijn niet end-to-end getest tegen een echte database — dat kan pas
zodra je stap 1–6 hierboven hebt doorlopen. Wat lokaal wél gecontroleerd is:

- `npm run typecheck` — strict TypeScript, hele app
- `npm run check:boundaries` — een klein scriptje (`scripts/check-write-boundary.mjs`)
  dat faalt zodra ergens buiten `api.ts` een `.insert(/.update(/.delete(/.upsert(`
  op de tabel opduikt, zodat de "alleen via RPC"-regel niet per ongeluk lekt
- `npm run test` — vitest op de pure guard-functies in `stateMachine.ts`
- `npm run build` — productie-build via Vite

## Phase 1 bewust niet gebouwd

- Commitment-wizard
- Foto-upload UI (RPC-contract en storage-bucket staan er al wel)
- Stripe / Mollie
- Video, GPS, timelapse
- Landing-wow pagina

## Phase 2

Wizard: €5/€10 → taak → deadline → samenvatting → tekenen → Vastgezet.
Daarna foto-upload naar `{user_id}/{commitment_id}/{uuid}.jpg`, met
`finalize_proof` als afsluitende RPC.

## Ontwerpaantekeningen

Gerouteerd als **ADAPTIVE** (meerdere skills, geen volledige requirements-
grafiek nodig — de scope kwam al scherp binnen):

- **functionality-complexity-tradeoff** — snelle necessity-check op de
  RPC-set en de Phase 1-uitsluitingen; de gegeven scope was al goed
  getrimd, geen wijzigingen nodig.
- **evolutionary-database-design** — schema/RLS/RPC-ontwerp: dubbele
  handhaving van "alleen schrijven via RPC" (geen grant + RLS zonder
  write-policy), `SECURITY DEFINER`-functies met vastgezet `search_path`,
  self-healing expiry die zowel client- als cron-aanroep dekt.
- **architecture-guidelines** — module-grenzen: `lib/` (client, types),
  `features/auth/`, `features/commitments/` (api/hook/state-machine/UI
  gescheiden); geen router, geen extra abstractielaag voor een app met één
  geauthenticeerde view.
- **structural-simplification** — bewust géén `eslint-plugin-boundaries`-
  machinerie voor een pakket van deze omvang; in plaats daarvan één
  goedkoop script dat de kern-invariant (schrijven alleen via `api.ts`)
  hard afdwingt.
- **defect-shift-left** — de belangrijkste checks liggen zo vroeg mogelijk:
  schema-constraints en RLS in de migratie zelf, TypeScript strict +
  write-boundary-script bij elke `npm run check`, in plaats van pas bij
  een latere security-review.

Bewust overgeslagen: **requirements-grounding/-topology/-implementation-
readiness** (scope was al eenduidig, geen graf nodig), **morphogenetic-
architecture** in volle vorm (één app, geen multi-service topologie om te
plaatsen), **architecture-as-code** enforcement-tooling (te zwaar voor dit
formaat), **system-optimization** (iteratie-2-gate, dit is iteratie 1).
