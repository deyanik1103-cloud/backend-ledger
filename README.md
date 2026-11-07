# Backend Ledger

A ledger-based banking backend built with Node.js, Express 5 and MongoDB (Mongoose). Balances are never stored. They are derived from immutable ledger entries.

## Features
- JWT authentication (register, login, logout with token blacklist)
- Multiple accounts per user, with balance derived from the ledger
- Money transfers inside MongoDB sessions (atomic debit + credit)
- Idempotency keys to prevent duplicate transfers
- System user endpoint for adding initial funds
- Email notifications via Nodemailer (Gmail OAuth2)

## Setup
1. `npm install`
2. Create a `.env` file with: `MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`
3. `npm run dev` (server runs on port 3000)

## API
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/auth/register | Register a user | No |
| POST | /api/auth/login | Log in | No |
| POST | /api/auth/logout | Log out (blacklists token) | Yes |
| POST | /api/accounts | Create an account | Yes |
| GET | /api/accounts | List my accounts | Yes |
| GET | /api/accounts/balance/:accountId | Get account balance | Yes |
| POST | /api/transactions | Transfer between accounts | Yes |
| POST | /api/transactions/system/initial-funds | Add initial funds | System user |

## Tech Stack
Node.js, Express 5, MongoDB Atlas, Mongoose, JWT, bcryptjs, Nodemailer
