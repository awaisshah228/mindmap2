# Whimsical-Style Diagram App - Architecture

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14+ (App Router) | Full-stack React, RSC, Server Actions |
| **Canvas** | React Flow (@xyflow/react) | Nodes, edges, mind maps, flowchart, pan/zoom |
| **Database** | Neon PostgreSQL | Serverless Postgres, branching |
| **ORM** | Drizzle | Type-safe SQL, migrations |
| **State** | Zustand | Canvas state, undo/redo |
| **AI** | Vercel AI SDK + OpenAI | Diagram generation from prompts |
| **Styling** | Tailwind CSS | Utility-first styling |
| **UI** | Radix UI + Lucide Icons | Toolbars, modals, icons |
| **Auth** | (optional) Clerk | User auth, workspaces |

## Core Features (Whimsical Parity)

### 1. **Canvas & Node Types**
- **Sticky notes** – Text blocks with color
- **Flowchart shapes** – Rectangle, diamond, document, circle
- **Connectors** – Arrows, smooth step edges
- **Text** – Standalone text nodes
- **Mind map** – Hierarchical nodes with +/- controls
- **Frames** – Group/container nodes
- **Lists** – Bulleted/numbered list nodes

### 2. **Node Controls**
- Selection styling (ring)
- Resize handles (React Flow built-in)
- Connection handles (inputs/outputs)
- Duplicate, delete (via store)

### 3. **AI Diagram Generation**
- Prompt → GPT-4o-mini → JSON → React Flow
- "Create mind map about X"
- "Generate flowchart for login process"

### 4. **Toolbar**
- Sticky note, shapes, connector, text, list
- Magic wand (AI generation)
- Pan, zoom, undo/redo

### 5. **Persistence** (schema ready)
- Drizzle schema for documents, nodes, edges
- Run `npm run db:push` after setting DATABASE_URL

## Project Structure

```
src/
  app/
    page.tsx           # Main editor
    ai-diagram/        # AI generation modal page
    api/diagrams/      # AI generation API
  components/
    canvas/            # React Flow wrapper
    nodes/             # Custom node types
    toolbar/           # Left sidebar tools
    sidebar/           # Document list
    layout/            # Editor layout
  db/
    schema.ts          # Drizzle schema
    index.ts           # DB client
  lib/
    store/             # Zustand stores
    utils.ts
```

## Setup

1. Copy `.env.example` to `.env.local`
2. Add your Neon `DATABASE_URL` and `OPENAI_API_KEY`
3. Run `npm install`
4. Run `npm run db:push` to create tables
5. Run `npm run dev`
