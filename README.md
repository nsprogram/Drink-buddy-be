# DrinkBuddy Backend

Node.js/Express backend with MongoDB and Socket.IO.

## Local run (Docker recommended)

From workspace root:

```bash
docker compose up --build
```

Health check:
- `http://localhost:5000/api/health`

## Local run (without Docker)

Prerequisites: MongoDB running locally

```bash
cd DrinkBuddy-Backend
npm install
npm run dev
```

Configure environment variables via `.env` (see `.env.example`).

