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

Pirms migrācijas aizpildiet `.env` vērtības. Lietotnei izmantojiet apvienoto savienojumu (`DATABASE_URL` ar `-pooler`), bet migrācijām norādiet tiešo Neon savienojumu `DATABASE_URL_UNPOOLED`. To var nokopēt Neon **Connect** logā, izslēdzot **Connection pooling**. Migrācijas fails jau ir iekļauts mapē `drizzle/`.

`npm run db:migrate` nolasa `.env.local` un `.env`, izmanto Drizzle migrāciju žurnālu un ievieš gaidošās izmaiņas vienā Neon HTTP transakcijā. Komandu var atkārtot: jau ieviestās migrācijas netiek palaistas vēlreiz. Kļūdas gadījumā transakcijas izmaiņas tiek atceltas, un savienojuma atslēgas netiek izdrukātas.

## Izvietošana ar GitHub un Vercel

Šis repozitorijs ir savienots ar Vercel. Izmaiņas `main` zarā automātiski izraisa jaunu produkcijas izvietošanu; citu zaru izmaiņām Vercel izveido priekšskatījumu. Turpmākiem koda atjauninājumiem ZIP augšupielāde nav vajadzīga.

### Sākotnējā konfigurācija

1. Izveidojiet tukšu GitHub repozitoriju un augšupielādējiet šīs mapes saturu.
2. Vercel izvēlieties **Add New → Project**, importējiet repozitoriju un atstājiet Framework Preset kā **Next.js**.
3. Vercel projektam pievienojiet Neon Postgres datubāzi un **Private** Vercel Blob glabātuvi. Integrācijas automātiski pievienos datubāzes un Blob savienojuma mainīgos.
4. Vercel projekta Environment Variables sadaļā pievienojiet `AUTH_SECRET` un `ADMIN_PASSWORD`.
5. Ja jānosūta apstiprinājuma e-pasti, pievienojiet `RESEND_API_KEY` un `EMAIL_FROM`. Bez tiem vēstule paliek administratora izsūtnes rindā un piekļuves kods ir redzams admina skatā.
6. Pārbaudiet migrāciju atsevišķā Neon zarā, pēc tam lokāli ar produkcijas `DATABASE_URL_UNPOOLED` palaidiet `npm run db:migrate` un Vercel veiciet **Deploy**.

Drošas nejaušas atslēgas piemērs:

```bash
openssl rand -base64 32
```

## Vides mainīgie

| Mainīgais | Obligāts | Nozīme |
|---|---:|---|
| `DATABASE_URL` | Jā | Neon/PostgreSQL savienojums |
| `DATABASE_URL_UNPOOLED` | Migrācijām | Tiešais Neon savienojums; nav nepieciešams lietotnes ikdienas darbībai |
| `AUTH_SECRET` | Jā | Skolu piekļuves kodu jaucējvērtību slepenā atslēga |
| `ADMIN_PASSWORD` | Jā | Administratora sākotnējā parole |
| `BLOB_READ_WRITE_TOKEN` | Jā | Vercel Blob klienta augšupielāžu pilnvara |
| `RESEND_API_KEY` | E-pastam | Resend API atslēga |
| `EMAIL_FROM` | E-pastam | Apstiprināta sūtītāja adrese |

## Zīmola noformējums

Noformējums pielāgots lietotāja iesniegtajai Latvijas skolu Ziemas festivāla zīmola grāmatai. Krāsas: tumši violets `#0C0942`, violets `#2910BF`, lavandas `#C7CFFF`, koraļļu `#FF4A4A`, laima `#D2D61D`. Logo un grafiskais raksts ir `public/brand/`; vietēji glabātie League Spartan un Oswald fonti un to OFL licences — `public/fonts/`. Tēma un kopīgie stili ir `app/festival.css`.

Bez `DATABASE_URL` sākumlapa rāda noformējumu un paziņojumu par vēl nepieejamiem sarakstiem, bet skolas pieteikuma iesniegšana ir atspējota. Pēc vides mainīgo pievienošanas jāveic jauna Vercel izvietošana. Piemēra dalībnieki un izdomāti rezultāti netiek publicēti.

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
