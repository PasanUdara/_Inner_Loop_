# InnerLoop

Internal Project, Meeting, and Resource Management Platform for Digital Lab.

## Docker Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git installed if cloning the repository

### 1. Configure the backend environment

From the repository root, create `Backend/.env` with the following values:

```env
DATABASE_URL=postgresql://innerloop_user:innerloop_password@postgres:5432/innerloop_db
JWT_SECRET=change-me
JWT_ALGORITHM=HS256
```

For shared or production environments, replace `JWT_SECRET` with a long, random secret and do not commit the `.env` file.

The database host depends on where the backend runs:

- Docker Compose backend: use `postgres:5432` as shown above. Docker resolves `postgres` to the PostgreSQL service.
- FastAPI running directly on Windows: use `localhost:5432`, because PostgreSQL is published from the container to the host.

For a direct local run, change only the database host in `Backend/.env` to:

```env
DATABASE_URL=postgresql://innerloop_user:innerloop_password@localhost:5432/innerloop_db
```

Restore `postgres:5432` before starting the backend with Docker Compose.

### 2. Build and start the services

Run this command from the directory containing `docker-compose.yml`:

```bash
docker compose up --build
```

To start the services in the background:

```bash
docker compose up --build -d
```

The first build downloads the required dependencies and may take a few minutes.

### 3. Access the application

Once the containers are running, use:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API health check: http://localhost:8000/health
- PostgreSQL: `localhost:5432`

### Docker commands

```bash
# View running containers
docker compose ps

# Follow service logs
docker compose logs -f

# Stop the services
docker compose down

# Stop the services and remove the PostgreSQL data volume
docker compose down -v
```

The PostgreSQL data is stored in the named Docker volume `innerloop_postgres_data` and is preserved when using `docker compose down`. Use `docker compose down -v` only when you want to delete the local database data.

## Data persistence

InnerLoop stores application records in PostgreSQL through the FastAPI API. The
React frontend does not use browser persistence APIs such as Web Storage or
IndexedDB. React component state is transient display/form state and is rebuilt
from the API after a page reload.

Authentication uses a signed JWT in a secure HttpOnly cookie. The cookie is an
authentication credential only; application records are not stored in it.

To enforce the browser-storage rule, run this from `Frontend/`:

```bash
npm run check:no-browser-storage
```

## Structure

- `Frontend/` — React + Vite application scaffold
- `Backend/` — FastAPI application scaffold
- `Databases/` — PostgreSQL schema/migration assets
- `docker-compose.yml` — Frontend, backend, and PostgreSQL deployment scaffold

The structure follows the InnerLoop Project Proposal dated 14 September 2026.
