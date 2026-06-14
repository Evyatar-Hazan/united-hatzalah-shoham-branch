# United Hatzalah Shoham Branch

Full-stack monorepo for the United Hatzalah Shoham branch website, admin panel, and backend API.

## Apps

- `apps/client` - React, TypeScript, Vite frontend.
- `apps/server` - Express, TypeScript, Prisma API, ready for a Node host such as Render.

## Getting Started

```bash
npm install
cp apps/client/.env.example apps/client/.env
cp apps/server/.env.example apps/server/.env
npm run prisma:generate
npm run dev:server
npm run dev:client
```

## Quality Checks

```bash
npm run build
npm run lint
```

Real environment files are intentionally ignored. Keep production secrets in the deployment provider, not in Git.
