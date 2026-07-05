# IndusBrain AI

A production-ready full-stack intelligent platform.

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React 18, Vite 8, Tailwind CSS 3, React Router 6, Axios |
| Backend  | FastAPI, SQLAlchemy 2.0, Pydantic               |
| Database | PostgreSQL 16                                   |
| Infra    | Docker, Docker Compose                          |

## Project Structure

```
IndusBrain-AI/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point with lifespan
│   │   ├── config.py        # Pydantic settings (env-based)
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models/          # ORM models (User)
│   │   ├── schemas/         # Pydantic schemas
│   │   └── routers/         # API routes (health, etc.)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx         # Entry with BrowserRouter
│   │   ├── App.jsx          # Layout + Routes
│   │   ├── api/client.js    # Axios instance
│   │   ├── pages/           # Page components
│   │   └── index.css        # Tailwind directives
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # db + backend + frontend
└── .env.example
```

## Quick Start

### With Docker (recommended)

```bash
docker compose up --build
```

Services:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **Health Check:** http://localhost:8000/health
- **PostgreSQL:** localhost:5432

### Without Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and adjust:

```
POSTGRES_USER=indusbrain
POSTGRES_PASSWORD=indusbrain
POSTGRES_DB=indusbrain
DATABASE_URL=postgresql://indusbrain:indusbrain@localhost:5432/indusbrain
SECRET_KEY=change-me-to-a-random-secret
DEBUG=true
```

## API Endpoints

| Method | Path       | Description        |
| ------ | ---------- | ------------------ |
| GET    | `/health`  | Service health check |
