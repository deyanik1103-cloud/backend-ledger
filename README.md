# Aurum Bank (Backend Ledger)

A ledger-based banking demo built with Node.js, Express 5, MongoDB (Mongoose) and a plain HTML/CSS/JS frontend.
Balances are never stored. They are derived from immutable ledger entries.

## Features
- JWT authentication (register, login, logout with token blacklist)
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
| POST | /api/auth/register | Register a user | No |
| POST | /api/auth/login | Log in | No |
| POST | /api/auth/logout | Log out (blacklists token) | Yes |
| POST | /api/accounts | Create an account | Yes |
| GET | /api/accounts | List my accounts with balances | Yes |
| GET | /api/accounts/balance/:accountId | Get account balance | Yes |
| GET | /api/accounts/lookup/:accountId | Find the owner name of an account | Yes |
| POST | /api/transactions | Transfer between accounts | Yes |
| GET | /api/transactions | My transaction history | Yes |
| POST | /api/transactions/system/initial-funds | Add initial funds | System user |
