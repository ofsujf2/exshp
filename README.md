# ExecutiveShop

Piattaforma eCommerce per beni **digitali e fisici**: storefront pubblico + dashboard Admin completa.
Backend in **Node.js puro** (nessuna dipendenza esterna: solo moduli core `http`, `node:sqlite`, `crypto`),
frontend in **HTML/CSS/JS** vanilla. Nessun framework, nessun `npm install` necessario.

## Avvio rapido

```bash
node server.js
```

Il database SQLite (`data/executiveshop.db`) viene creato e popolato automaticamente al primo avvio.

Apri **http://localhost:3000**

### Credenziali demo (create dal seed automatico)
- **Admin**: `admin@executiveshop.test` / `Admin#2026!` → pannello su `/admin/`
- **Cliente**: `cliente@executiveshop.test` / `Customer#2026!` → `/dashboard.html`

Per ripartire da zero: cancella `data/executiveshop.db*` e riavvia il server.

## Cosa e realmente funzionante

- Autenticazione con password hashate (scrypt), sessioni firmate (HMAC), rate limiting sul login
- Catalogo, categorie, ricerca, recensioni, wishlist
- Carrello lato client + checkout multi-step con **calcolo prezzi/IVA/sconti ricalcolato sempre lato server**
- Coupon (percentuale, fisso, spedizione gratuita) con anteprima live
- Consegna automatica di licenze/chiavi digitali quando un ordine viene marcato "pagato"
- Dashboard Admin: statistiche, gestione prodotti (con upload immagini reale su disco), ordini, coupon,
  wallet crypto, gateway di pagamento, provider API, recensioni, ticket, impostazioni, audit log
- Multi-lingua (IT/EN/ES/FR) lato interfaccia

## Cosa e simulato (e perche)

Questo ambiente di sviluppo **non ha accesso alla rete in uscita** e non fornisce chiavi live, quindi:

- **Stripe / PayPal / Revolut Pay**: il pulsante e il flusso di checkout sono collegati e funzionanti,
  ma la *conferma reale* del pagamento richiede una chiave live + un webhook raggiungibile da internet.
  In questa demo l'ordine resta `pending_verification` finche' un admin non lo marca `paid` manualmente
  dal pannello Ordini (che a sua volta assegna in automatico licenze/chiavi digitali).
- **Pagamenti crypto (BTC/LTC/ETH/USDT)**: indirizzo e QR sono reali nel senso che l'admin puo inserire
  i propri indirizzi wallet veri; quello che manca e la **verifica automatica on-chain** (serve un
  provider tipo BTCPay Server, BlockCypher, ecc.) — di default la conferma e manuale.
  I tassi di cambio mostrati in EUR sono **indicativi/demo**, non un feed di mercato live.
  Vedi `src/routes/payments.routes.js` (`DEMO_RATES_EUR`).
- **API Provider (consegna digitale automatica)**: la struttura (CRUD, test connessione) e reale; la
  chiamata effettiva al provider esterno richiede rete in uscita — vedi il commento con il codice
  `fetch` gia pronto in `src/routes/orders.routes.js` (funzione `fulfillDigitalItem`).
- **Email (verifica account, reset password, notifiche)**: nessun invio reale, serve configurare SMTP.

Questi punti sono anche segnalati **onestamente nell'interfaccia stessa** (badge "in verifica", note
sotto ai pulsanti di pagamento): l'obiettivo e che sia chiaro cosa e live e cosa no, sia per te che per
eventuali utenti reali del negozio.

## Come collegare pagamenti reali in produzione

1. **Stripe/PayPal/Revolut**: crea un account merchant, genera le chiavi live, inseriscile da
   Admin → Metodi di pagamento. Poi implementa la chiamata reale server-side (creazione intent/ordine
   + verifica webhook) al posto del blocco `demo_mode` in `buildPaymentInstructions()`
   (`src/routes/orders.routes.js`).
2. **Crypto**: sostituisci la verifica manuale con un provider tipo BTCPay Server / NOWPayments, che
   ti notifica via webhook quando un pagamento arriva all'indirizzo — allora marca l'ordine `paid`
   via l'endpoint `PUT /api/admin/orders/:id`.
3. **API Provider**: attiva davvero il provider dal pannello e la chiamata `fetch` reale (gia scritta
   in commento) former al posto del messaggio "non disponibile in ambiente demo".
4. **SMTP**: aggiungi un client SMTP (es. `nodemailer`, richiede `npm install` in un ambiente con rete)
   per l'invio reale di email di verifica/reset password/notifiche.
5. Metti `SESSION_SECRET` (vedi `.env.example`) in variabile d'ambiente reale, dietro HTTPS.

## Struttura progetto

```
server.js                  entry point HTTP
src/db.js                  schema SQLite + seed dati demo
src/auth.js                hashing password, sessioni firmate, rate limiting
src/router.js               mini router (no Express)
src/utils.js                response helper, upload, audit log, QR placeholder
src/routes/                 auth, catalog, orders/checkout, account, admin, payments
public/                     storefront + admin (HTML/CSS/JS statici)
public/css/style.css        tema dark, glassmorphism, accento blu
public/js/                  api.js, store.js (carrello), layout.js, checkout.js, admin.js
locales/                    it.json, en.json, es.json, fr.json
```

## Note di sicurezza da rivedere prima di andare online

- Cambia `SESSION_SECRET` e servi tutto dietro HTTPS
- Aggiungi un vero CSRF token sulle richieste state-changing se esponi il sito pubblicamente
- Rivedi i limiti di rate limiting (attualmente in memoria, si azzera al riavvio del processo)
- Sostituisci i testi placeholder di Termini/Privacy/Refund Policy con testi legali reali
