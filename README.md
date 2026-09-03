# Ziemas festivāla reģistrācija un rezultāti

Next.js lietotne skolu, dalībnieku un komandu vadītāju reģistrācijai, tiesnešu darbam, rezultātu publicēšanai, drošības parakstu lapām un akreditāciju drukai. Vecuma atbilstību sistēma pārbauda tikai pēc dzimšanas gada — 1. septembra robeža netiek izmantota.

## Palaišana lokāli

Nepieciešams Node.js 22 vai jaunāks.

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Pirms migrācijas aizpildiet `.env` vērtības. Migrācijas fails jau ir iekļauts mapē `drizzle/`.

## Izvietošana ar GitHub un Vercel

1. Izveidojiet tukšu GitHub repozitoriju un augšupielādējiet šīs mapes saturu.
2. Vercel izvēlieties **Add New → Project**, importējiet repozitoriju un atstājiet Framework Preset kā **Next.js**.
3. Vercel projektam pievienojiet Neon Postgres datubāzi un **Private** Vercel Blob glabātuvi. Integrācijas automātiski pievienos datubāzes un Blob savienojuma mainīgos.
4. Vercel projekta Environment Variables sadaļā pievienojiet `AUTH_SECRET` un `ADMIN_PASSWORD`.
5. Ja jānosūta apstiprinājuma e-pasti, pievienojiet `RESEND_API_KEY` un `EMAIL_FROM`. Bez tiem vēstule paliek administratora izsūtnes rindā un piekļuves kods ir redzams admina skatā.
6. Lokāli ar produkcijas `DATABASE_URL` palaidiet `npm run db:migrate`, pēc tam Vercel veiciet **Deploy**.

Drošas nejaušas atslēgas piemērs:

```bash
openssl rand -base64 32
```

## Vides mainīgie

| Mainīgais | Obligāts | Nozīme |
|---|---:|---|
| `DATABASE_URL` | Jā | Neon/PostgreSQL savienojums |
| `AUTH_SECRET` | Jā | Sesiju parakstīšanas atslēga |
| `ADMIN_PASSWORD` | Jā | Administratora sākotnējā parole |
| `BLOB_READ_WRITE_TOKEN` | Jā | Vercel Blob klienta augšupielāžu pilnvara |
| `RESEND_API_KEY` | E-pastam | Resend API atslēga |
| `EMAIL_FROM` | E-pastam | Apstiprināta sūtītāja adrese |

## Galvenās adreses

- `/` — publiskais dalībnieku, rezultātu un skolu kopvērtējuma skats
- `/registracija` — skolas reģistrācija
- `/skolai` — skolas pieteikuma pārvaldība
- `/tiesnesiem` — tiesnešu sadaļa un rezultātu imports
- `/admin` — administratora sadaļa
- `/admin/akreditacijas` — visu dalībnieku, vadītāju un tiesnešu akreditāciju druka

## Pirmā palaišana

Sporta veidi un sākotnējās kategorijas tiek izveidotas automātiski pirmajā pieprasījumā. Administrators var koriģēt kategoriju dzimšanas gadu robežas, publicēšanas iestatījumus, izveidot tiesnešu piekļuves un augšupielādēt akreditācijas kartes fona attēlu.

Rezultātu importā atbalstīti PDF, XLSX, CSV, TSV un TXT faili līdz 12 MB. Sistēma izveido priekšskatījumu; tiesnesim pirms saglabāšanas jāapstiprina automātiski identificētās rindas un vietas.
