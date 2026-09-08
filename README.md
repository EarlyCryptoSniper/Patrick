# LockIn

Habit commitment tool. Geen kansspel. Geen pot, geen odds, geen winst van anderen.
Er wordt nog altijd geen geld afgeschreven — Phase 2's inzet-stap is UI-only,
zie "Phase 2" hieronder.

Herbouwd vanaf nul; ontwerp is gerouteerd via de skills in `.claude/skills`
(zie onderaan "Ontwerpaantekeningen").

**Status: Phase 1 compleet, Phase 2 gedeeltelijk** (wizard + foto-upload
gebouwd, betaling nog niet aangesloten).

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

## Supabase — instellen

1. Nieuw project op https://supabase.com
2. Authentication → Providers: Email aan
3. Authentication → URL configuration:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`
4. Migraties toepassen — twee routes:
   - **CLI (aanbevolen, houdt bij welke migraties al gedraaid zijn):**
     ```bash
     npx supabase login
     npx supabase link --project-ref <jouw-project-ref>
     npx supabase db push
     ```
   - **Handmatig:** SQL Editor → plak en run, in deze volgorde
     `supabase/migrations/20260907000000_phase1_foundation.sql`
     `supabase/migrations/20260908000000_phase2_stake.sql`

     Ben je later overgestapt naar de CLI nadat je hier handmatig migraties
     draaide? Dan moet je die eerst als "al toegepast" markeren, anders
     probeert `db push` ze opnieuw te draaien en knalt op bestaande
     policies/functies:
     ```bash
     npx supabase migration repair --status applied <versie-timestamp>
     ```
5. Database → Extensions: zet `pg_cron` aan als je automatische expiry wilt
   (roept dan `expire_due_commitments()` als privileged role aan, buiten
   een user-sessie om, dus globaal in plaats van per gebruiker).
   Zonder cron expire't de app nog steeds als iemand het dashboard opent —
   `useCommitments` roept de RPC self-heal aan op elke load.
6. Storage: bucket `commitment-proofs` wordt door de migratie aangemaakt
   (privé). Upload-UI staat er nu (Phase 2).
7. AI-scheidsrechter: zet je OpenAI API-key als Edge Function-secret en
   deploy de functie:
   ```bash
   npx supabase secrets set OPENAI_API_KEY=sk-...
   npx supabase functions deploy verify-proof
   ```
   Zonder deze stap faalt elke foto-upload met `referee_unavailable` — de
   functie is de enige weg naar `completed` sinds migratie 3 het directe
   `finalize_proof`-pad afsloot.

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
| `create_commitment_draft(title, deadline, stake_cents=0)` | Rij aanmaken, status draft. `stake_cents` moet 0, 500 of 1000 zijn — afgedwongen in de RPC én als kolom-`check`. |
| `lock_commitment` | Tekenen, `signed_at = now()` |
| `finalize_proof` | Foto-pad vastleggen, completed |
| `delete_draft` | Alleen eigen draft weg |
| `expire_due_commitments` | locked + deadline voorbij → failed; self-scoped bij een user-sessie, globaal zonder |

`create_commitment_draft` kreeg met de Phase 2-migratie een derde,
gedefaulte parameter. De migratie dropt en herschept 'm expliciet zodat er
nooit twee overloads naast elkaar bestaan (PostgREST zou daar last van
kunnen hebben) — zie
`supabase/migrations/20260908000000_phase2_stake.sql`.

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
- `npm run test` — vitest op de pure guard-functies in `stateMachine.ts` en
  op `proofPath.ts` (bestandspad-opbouw voor de storage-upload)
- `npm run build` — productie-build via Vite

## Phase 1 bewust niet gebouwd

- Stripe / Mollie
- Video, GPS, timelapse
- Landing-wow pagina

## Phase 2 — status

Gebouwd (niet-financieel deel):

- **Wizard** (`CommitmentWizard.tsx`, verving `NewCommitmentForm.tsx`):
  taak → deadline → inzet → samenvatting → tekenen. Niets wordt
  weggeschreven vóór de laatste stap — de tussenstappen leven alleen in
  lokale component-state, dus "Annuleren" is triviaal veilig en er is geen
  aparte `update_draft`-RPC nodig. De laatste stap roept
  `create_commitment_draft` en meteen `lock_commitment` aan: de wizard
  eindigt altijd in Vastgezet, zoals de spec beschrijft.
- **Inzet (€5/€10)**: gekozen bedrag wordt getoond en opgeslagen
  (`stake_cents`), maar **niet afgeschreven** — er is geen
  betalingsprovider-aanroep. De samenvattingsstap zegt dat expliciet.
- **Foto-upload** (`ProofUpload.tsx`): verschijnt op een vastgezette
  commitment zolang de deadline niet voorbij is (`canFinalizeProof`).
  Upload gaat naar `commitment-proofs/{user_id}/{commitment_id}/{uuid}.ext`
  (bestandsextensie uit de meegegeven file, `proofPath.ts`, puur
  functie/los getest), gevolgd door AI-verificatie (zie hieronder).
- **AI-scheidsrechter** (`supabase/functions/verify-proof`): tot dit punt
  accepteerde `finalize_proof` elk bestand zonder controle — gevonden
  tijdens live testen ("er is nog geen scheidsrechter"). Nu belt de
  client na de upload een Edge Function, die de foto tegen de
  taakomschrijving laat beoordelen door OpenAI (`gpt-4o-mini`, vision) en
  alleen bij een `pass`-verdict zelf `finalize_proof` aanroept — met de
  service-role key, want `finalize_proof`'s `authenticated`-grant is
  ingetrokken (migratie `20260908010000_phase2_ai_referee.sql`). Bij een
  `fail` blijft de commitment gewoon `locked` (geen nieuwe status, geen
  terug-transitie) en wordt de afgekeurde upload verwijderd; de gebruiker
  kan een andere foto proberen zolang de deadline niet voorbij is.
  Vereist een OpenAI API-key als Edge Function-secret (`OPENAI_API_KEY`).
  Live: OpenAI-key gezet, functie gedeployed, geverifieerd tegen de echte
  database (zowel een `fail`- als een geslaagde upload getest).
- **Geen oude foto's.** `ProofUpload.tsx` heeft geen `<input type="file">`
  meer — dat liet iedereen gewoon een bestaande foto uit de galerij kiezen
  (`capture="environment"` is slechts een browser-hint, geen afdwinging).
  In plaats daarvan opent de knop een live camera (`getUserMedia`) en gaat
  alleen een net-getrokken frame (canvas → blob) naar de upload. Geen
  bestandskeuze in de UI, dus geen weg om een oud bestand te uploaden.

Nog niet gebouwd (bewust, wacht op een providerkeuze mét de gebruiker
erbij): echte betaling via Stripe of Mollie — dat vraagt een account en
API-key, en verandert de "V1 schrijft geen geld af"-belofte fundamenteel
zodra het aangesloten wordt.

## Backlog

- **Custom SMTP (functioneel, niet alleen cosmetisch).** De ingebouwde
  Supabase-mailer komt van `noreply@mail.app.supabase.io` ("Supabase
  Auth") én heeft een zeer laag verzendlimiet (enkele mails per uur,
  puur bedoeld om even te testen) — tijdens live testen al geraakt
  ("email rate limit exceeded"). Oplossing: custom SMTP instellen
  (Supabase → Project Settings → Auth → SMTP Settings) met een provider
  als Resend, wat zowel het afzenderadres als het limiet oplost. Kan
  volledig via de Supabase Management API (`PATCH
  /v1/projects/{ref}/config/auth`, velden `smtp_host`/`smtp_port`/
  `smtp_user`/`smtp_pass`/`smtp_sender_name`/`smtp_admin_email`) zodra er
  een Resend API-key beschikbaar is — nog niet aangeleverd.
- **Gebrande e-mailtemplates.** "Confirm signup" en "Magic Link" staan nog
  op de Engelse Supabase-default-tekst. Supabase weigert
  templatewijzigingen op de gratis tier zolang custom SMTP niet actief is
  (geverifieerd: API gaf `400 Email template modification is not
  available for free tier projects using the default email provider`) —
  hangt dus vast aan bovenstaand punt. Kant-en-klare NL-teksten staan al
  klaar (zie git-historie van dit bestand / eerdere sessie-aantekeningen).
- **`site_url` / redirect allow-list** stond nog op de Supabase-default
  (`http://localhost:3000`, lege allow-list) — dit is al gefixt naar
  `http://localhost:5173` + `http://localhost:5173/**` via de Management
  API, geen actie meer nodig.

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

### Phase 2 (wizard + foto-upload)

Lichtere **ADAPTIVE**-route dan Phase 1 — dit breidt een al ontworpen
architectuur uit, geen greenfield-beslissingen meer nodig:

- **functionality-complexity-tradeoff** — geen `update_draft`-RPC
  toegevoegd: de wizard houdt tussenstappen client-side vast en schrijft
  pas op de laatste stap, dus er is geen mutable-draft-endpoint nodig.
  Ook: geen vrije-invoer-bedrag, alleen de twee spec-waarden (€5/€10) plus
  "geen inzet" — minder oppervlak, minder validatie.
- **evolutionary-database-design** — `stake_cents` als expand-only kolom
  (`not null default 0`, dus bestaande rijen blijven geldig) in een
  *nieuwe* migratiebestand, niet een edit van de Phase 1-migratie.
  `create_commitment_draft` wordt met `drop function` + opnieuw aangemaakt
  vervangen (niet gewoon een `create or replace` met extra parameter) om
  een stille PostgREST-overload te voorkomen. Toegestane bedragen (0, 500,
  1000) zitten dubbel: als RPC-check én als kolom-`check`-constraint —
  zelfde dubbele-handhaving-patroon als de Phase 1 write-boundary.
- **architecture-guidelines** — `ProofUpload`/`CommitmentWizard` blijven in
  `features/commitments/`, geen nieuwe featuremap voor twee bestanden.
  Storage-writes gaan net als RPC's alleen via `api.ts` — UI-componenten
  raken de Supabase-client zelf nooit aan, ook niet voor Storage.
- **defect-shift-left** — bestandspad-opbouw (`buildProofPath`) is een pure
  functie in een los bestand, getest zonder netwerk/DB (4 nieuwe tests).

Overgeslagen: betaalprovider-integratie zelf (aparte beslissing, wacht op
Stripe/Mollie-keuze en account van de gebruiker) en dus ook de
enforcement/shift-left-gates die daarbij zouden horen (geldstromen,
webhook-verificatie) — die horen bij dát werk, niet bij deze stap.
