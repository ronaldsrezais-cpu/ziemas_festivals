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
5. Ja jānosūta apstiprinājuma e-pasti, pievienojiet `RESEND_API_KEY` un `EMAIL_FROM`. Bez tiem vēstule tiek saglabāta administratora sadaļā **E-pasti**, un piekļuves kods ir redzams admina skatā. Pēc konfigurācijas un jaunas izvietošanas nospiediet **Nosūtīt atkārtoti**; automātiska gaidošo vēstuļu izsūtīšana nenotiek.
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

## Komandas pieteikuma pabeigšana

Skolas sadaļā **Pabeigt pieteikumu** pārbauda, vai ir vismaz viens dalībnieks, katram dalībniekam ir pieteikums sporta veidā un uz katriem 10 dalībniekiem ir vismaz viens vadītājs (11 dalībniekiem — divi, 21 — trīs). Pēc dalībnieku vai vadītāju izmaiņām pieteikums jāapstiprina vēlreiz. Administrators statusu un trūkumus redz skolu sarakstā.

Administratora **Iestatījumos** ir divi atsevišķi slēdži: **Reģistrācija atvērta** regulē jaunu skolu pieteikumus; **Komandas sastāva labošana atvērta** regulē apstiprināto skolu dalībnieku/vadītāju izmaiņas un pieteikuma pabeigšanu. Aizverot labošanu, saraksti un drošības lapa paliek pieejami. Ierobežojumi darbojas arī API.

Dalībnieka labošana saglabā nemainīto sporta pieteikumu identifikatorus un rezultātus. Nevar noņemt dalībnieku vai disciplīnu ar rezultātu, kā arī mainīt šāda pieteikuma komandu. Neveiksmīga pārbaude atceļ visas attiecīgā labojuma izmaiņas vienā datubāzes transakcijā.

## Apstiprinājuma e-pasti

Administratora sadaļā **E-pasti** redzama katras skolas pēdējā vēstule, tās statuss, kļūda un pēdējais sūtīšanas mēģinājums. **Nosūtīt atkārtoti** izmanto skolas esošo kodu. Vienlaicīgi mēģinājumi tiek aizsargāti pret dubultu nosūtīšanu, un neskaidra/neveiksmīga mēģinājuma atkārtojums izmanto to pašu Resend idempotences atslēgu. Jau pieņemtu vēstuli apzināti var nosūtīt vēlreiz pēc minūtes.

**Nodots nosūtīšanai** nozīmē, ka Resend pieņēmis vēstuli, nevis apstiprinātu piegādi pastkastē. Piegādes statusu pārbauda Resend. Sūtītāja domēnam jābūt apstiprinātam Resend; piemēram, `EMAIL_FROM=Ziemas festivāls <ziemasfestivals@lsfp.lv>`.

## Pārbaudes

Ar Node.js 24 palaidiet `node --test tests/*.test.mjs`, `npm run lint` un `npm run build`. E-pastu un pieteikumu darbību testos izmantota izolēta datu glabātuve un imitēts Resend — tie nepieslēdzas īstajai datubāzei un nesūta vēstules. Pilnu datubāzes plūsmu pārbaudiet atsevišķā Neon zarā.
