# Aurum Bank (Backend Ledger)

A ledger-based banking demo built with Node.js, Express 5, MongoDB (Mongoose) and a plain HTML/CSS/JS frontend.
Balances are never stored. They are derived from immutable ledger entries.

## Features
- JWT authentication (register, login, logout with token blacklist)
- Email verification: a 6-digit code is emailed at sign-up and works for 3 minutes (5 attempts, resend after 30 seconds)
- Email to both people whenever money is sent or received
- Multiple accounts per user, balance derived from the ledger
- Atomic transfers inside MongoDB sessions, with idempotency keys
- System user endpoint for adding initial funds
- Email notifications via Nodemailer (Gmail OAuth2)
- Aurum web app served from the same server (`public/index.html`)

## Setup
1. `npm install`
2. Fill in `.env`: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `EMAIL_USER`
3. `npm run dev`
4. Open http://localhost:3000

## API
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/auth/register | Register a user and email a 6-digit code | No |
| POST | /api/auth/verify-email | Enter the code to finish sign-up | No |
| POST | /api/auth/resend-code | Send a new code | No |
| POST | /api/auth/login | Log in | No |
| POST | /api/auth/logout | Log out (blacklists token) | Yes |
| POST | /api/accounts | Create an account | Yes |
| GET | /api/accounts | List my accounts with balances | Yes |
| GET | /api/accounts/balance/:accountId | Get account balance | Yes |
| GET | /api/accounts/lookup/:accountId | Find the owner name of an account | Yes |
| POST | /api/transactions | Transfer between accounts | Yes |
| GET | /api/transactions | My transaction history | Yes |
| POST | /api/transactions/system/initial-funds | Add initial funds | System user |
