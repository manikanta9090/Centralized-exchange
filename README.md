# Centralized Exchange (CEX)

A high-performance centralized cryptocurrency exchange built from scratch using **Bun**, **TypeScript**, **Express**, **PostgreSQL**, **Prisma**, and **Redis**.

This project is being developed by following the architecture of a real-world centralized exchange, focusing on scalability, performance, and clean backend design.

## 🚀 Current Progress

* ✅ Bun project initialized
* ✅ Express server configured
* ✅ PostgreSQL configured using Docker
* ✅ Prisma initialized
* ✅ Health check endpoint implemented

## 🛠️ Tech Stack

* Bun
* TypeScript
* Express.js
* PostgreSQL
* Prisma ORM
* Redis *(Upcoming)*
* WebSockets *(Upcoming)*

## 📁 Project Structure

```text
backend/
├── prisma/
├── src/
│   ├── index.ts
│   └── utils/
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── bun.lock
```

## ⚙️ Getting Started

### Clone the repository

```bash
git clone <repository-url>
```

### Navigate to the backend

```bash
cd backend
```

### Install dependencies

```bash
bun install
```

### Configure environment variables

Create a `.env` file:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cex
JWT_SECRET=your-secret-key
```

### Start PostgreSQL (Docker)

```bash
docker run -d --name cex-postgres \
-e POSTGRES_USER=postgres \
-e POSTGRES_PASSWORD=postgres \
-e POSTGRES_DB=cex \
-p 5432:5432 \
postgres:17
```

### Run the development server

```bash
bun run dev
```

Visit:

```
http://localhost:3000/health
```

Expected response:

```json
{
  "ok": true
}
```

## 📌 Roadmap

* [x] Project setup
* [x] Express server
* [ ] User authentication
* [ ] JWT authorization
* [ ] Matching Engine
* [ ] Order Book
* [ ] Trade Execution
* [ ] Redis Pub/Sub
* [ ] WebSocket Streaming
* [ ] Frontend Dashboard

## 📄 License

This project is intended for learning and educational purposes.
