# Business Records

## Phase 0 technical proof

This phase verifies the Windows desktop delivery path before business features are added. It proves that a static Nuxt interface can run in Electron, write to a local SQLite database, generate a PDF, and be packaged as a Windows installer.

Run the desktop proof during development:

```bash
pnpm dev
```

Select **Run SQLite and PDF proof**. The app adds a row to its local proof database and writes `technical-proof.pdf` to `Documents/Business Records/Reports`.

Build the installer:

```bash
pnpm dist
```

The installer is written to `release/`.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
