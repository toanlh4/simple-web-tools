# Project

Collection of small static web tools. Everything runs in the browser; there is no backend.

## Tech Stack

- Language: TypeScript
- Library: React, react-router-dom (HashRouter), zustand, @dnd-kit, lucide-react
- CSS: tailwind css

## Coding Standards

- Use TypeScript strictly; avoid `any`.

## Adding a tool

- Put the tool in `src/tools/<tool-id>/` and register it in `src/tools/registry.tsx`.
