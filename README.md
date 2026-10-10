# Kokobi+ website

React (Vite) frontend + Node/Express backend. When a customer places an order, the backend emails the full order and
customer details to **kokobifoods@gmail.com**. Customers can pay online with **Paystack** and get an emailed **receipt (with PDF)**, or pay by bank transfer.

```
kokobi/
  client/   React + Vite website
  server/   Express API (POST /api/orders -> email)
```

## 1. Run it in VS Code

Requires Node.js 18+ (https://nodejs.org).

1. Open the `kokobi` folder in VS Code (File > Open Folder).
2. Open a terminal (Terminal > New Terminal) and install everything:
   ```
   npm run install:all
   ```
3. Set up email (see section 2), then create `server/.env` from `server/.env.example`.
4. Start the backend (terminal 1):
   ```
   npm run dev:server
   ```
5. Start the website (terminal 2, use the "+" button for a new terminal):
   ```
   npm run dev:client
   ```
6. Open http://localhost:5173. Place a test order; the email should arrive at kokobifoods@gmail.com.

Run the backend's checks any time with `npm test --prefix server`.

## 2. Set up the order emails

**Option A: Gmail (simplest)**
1. Sign in to the Gmail account that will *send* the emails (kokobifoods@gmail.com is fine).
2. Turn on 2-Step Verification: https://myaccount.google.com/security
3. Create an App Password: https://myaccount.google.com/apppasswords
4. In `server/.env` set `SMTP_USER=kokobifoods@gmail.com` and `SMTP_PASS=<the 16-character app password>`.

**Option B: Resend (use if your host blocks SMTP)**
*Note: on Resend's free plan without a verified domain it can only email you, so customer receipts will NOT be delivered. Verify your own domain in Resend first, or use Option A.*
Some hosts (for example Render's free tier) block outbound SMTP, so Gmail will fail there. Sign up at https://resend.com
using kokobifoods@gmail.com, create an API key and set `RESEND_API_KEY` in the server's environment. Resend then
sends the emails over HTTPS. Without a verified domain it can only deliver to the email you signed up with,
which is the address you want.

Never put these keys in the `client` folder or commit `.env`. The browser must never see them.

## 3. Paystack online payment and receipts

How it works: the customer picks "Pay online now", goes to Paystack's secure checkout, and returns to the site.
Only after Paystack confirms the payment does the backend (1) email you a **[PAID]** order and (2) email the customer a
receipt with a PDF attached. Totals are calculated on the server, so the amount can't be changed in the browser.
**Processing fee:** the customer pays Paystack's fee (1.5% + NGN 100, NGN 100 waived under NGN 2,500, capped at NGN 2,000) on top of the
items, so you receive the full item total. The order page shows the fee before they pay, and the receipt lists it. To absorb the fee yourself
instead, set `PASS_PAYSTACK_FEE=false` on the server and `VITE_PASS_PAYSTACK_FEE=false` on the client. If Paystack changes its fees, update
`server/src/fees.js` and the matching lines in `client/src/data.js`.

Customers who choose bank transfer still get the old flow, and you receive an **[AWAITING PAYMENT]** email.

Set up:
1. Create an account at https://paystack.com and open Settings > API Keys & Webhooks.
2. Copy the **Test Secret Key** (`sk_test_...`) into `server/.env` as `PAYSTACK_SECRET_KEY`. Set `CLIENT_URL` to your website
   address (`http://localhost:5173` locally). Restart the backend; it should log `Paystack: enabled`.
3. Test with Paystack's test card: `4084 0840 8408 4081`, any future expiry date, CVV `408`. Paystack's docs list other test cards.
4. When you deploy, set the **Webhook URL** in the same Paystack settings page to `https://YOUR-API/api/paystack/webhook`.
   The webhook makes sure you get the order and the customer gets the receipt even if they close the tab after paying.
   (Locally the webhook isn't needed: the return page confirms the payment itself.)
5. To take real money, finish Paystack's business verification, then replace the key with the **Live Secret Key** (`sk_live_...`)
   in your host's environment variables. Never put the secret key in the `client` folder.

Check the receipt design without paying: run `npm run sample:receipt --prefix server`, then open `server/sample-receipt.pdf`.
If that command shows an error, the PDF part is the problem (the customer email is then sent without the attachment).
The confirmation page also has a **Download receipt (PDF)** button and a **WhatsApp** button so the customer can confirm delivery.

Receipts: the PDF uses `server/assets/logo.png`. The receipt email goes out from the same Gmail account as your order emails.
Gmail has daily sending limits, which is fine for a small shop. If a customer says they didn't get a receipt, check their spam folder
and the backend logs (`Receipt email FAILED`).

Not stored: orders are not kept in a database. Duplicate-email protection lives in server memory, so a server restart in the middle of a
payment could rarely cause a repeated email.

## 4. Receipts for bank transfer orders

Bank transfer customers are not charged online, so no receipt is sent automatically (that would be a receipt for money you may not have).
Instead, your **[AWAITING PAYMENT]** order email contains a **Review and send receipt** button. When the money is in your Opay or Zenith account:
1. Open the email and press the button. It opens a page showing the order and asking you to confirm. Nothing is sent just by opening it.
2. Press **Yes, payment received**. The customer gets the same branded email and PDF receipt, marked "Bank transfer".

Setup (once): in `server/.env` set `RECEIPT_SECRET` to a long random value (the command is in `.env.example`) and `API_PUBLIC_URL` to your
backend's address (`http://localhost:4000` locally, your live backend address when deployed). Restart the backend; it should log
`Bank transfer receipt links: enabled`. Without `RECEIPT_SECRET` the button is simply left out.
Notes: links stop working after 90 days; a link can't be edited or forged; pressing twice won't email the customer twice (unless the server restarted in between).

## 5. Deploy

Deploy the backend first, because the website needs its URL. Both parts can be deployed on Vercel as two separate projects from the same
GitHub repo (Root Directory `server` for the backend, `client` for the website). Render's free plan blocks the ports Gmail uses, so Gmail email won't work there.

**Backend (Render, Railway, Fly, etc.)**
- Root directory: `server`. Build command: `npm install`. Start command: `npm start`.
- Environment variables: `ORDER_TO`, `SMTP_USER`, `SMTP_PASS` (or `RESEND_API_KEY`), `PAYSTACK_SECRET_KEY`, `CLIENT_URL` (your website address), `RECEIPT_SECRET`, `API_PUBLIC_URL` (this backend's own address), and
  `CORS_ORIGINS` = your website address, e.g. `https://kokobi.vercel.app` (no trailing slash; comma-separate several).
- Check `https://YOUR-API/api/health` returns `{"ok":true}`.

**Website (Vercel or Netlify)**
- Root directory: `client`. Build command: `npm run build`. Output directory: `dist`.
- Environment variable: `VITE_API_URL` = your backend URL, e.g. `https://kokobi-api.onrender.com` (no trailing slash).
- Page refreshes on routes like /order work thanks to `vercel.json` and `public/_redirects`.
- After you add a custom domain, add it to `CORS_ORIGINS` on the backend.

## 6. Things you may want to change

- Prices, bank details, phone numbers, email: `client/src/data.js` (`CONFIG`, `PRODUCTS`). If you change a price,
  also change it in `server/src/catalog.js`; the server calculates totals itself and ignores the browser's.
- "More ways to enjoy Kokobi+" cards: `WAYS` in `client/src/data.js`.
- Logo: `client/src/assets/logo.png` (also copied to `client/public/logo.png`), plus `client/public/favicon.png`,
  `apple-touch-icon.png` and `og-image.png`. The logo was cut from the Formula A packaging artwork. To use your
  original logo file, replace `logo.png` with a transparent PNG (or SVG, then update the import in `components/Logo.jsx`).
- Orders are emailed only and not stored in a database. For bank transfers the customer sends proof on WhatsApp as before;
  if an email ever fails, the order page tells them to finish via WhatsApp.
