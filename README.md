# Simple Web Tools

A collection of small tools that run entirely in the browser (no backend).

Tech stack: React + TypeScript + Vite + Tailwind CSS (same setup as `sql-analyzer-web`).

## Tools

| Tool | Description |
| --- | --- |
| Replace String | Apply a chain of find/replace steps to a text. Each step is plain text or a regex (with `g i m s u y` flags), can be disabled, reordered by drag and drop. The step list can be exported to / imported from a local JSON config file, or saved by name in browser storage and managed from the "Saved configs" sidebar. |

## Requirements

- Node.js 20+ and npm

## Commands

```bash
# Install dependencies (first time only)
npm install

# Start the dev server with hot reload (http://localhost:5173)
npm run dev

# Production build -> dist/ (serve it with any static web server)
npm run build

# Preview the production build locally
npm run preview

# Single-file build -> dist-single/index.html
# All JS and CSS are inlined, so the file opens directly from disk (double-click), no server needed.
npm run build:single
```

On Windows you can also run `build-single.bat` for the single-file build.

## Replace String configs

There are two ways to keep a list of steps:

- **Save to browser**: saves the steps under a name in this browser's `localStorage`. Saved configs are listed in the
  right sidebar (collapsible with the panel button, resizable by dragging its left edge) with their name, saved time and
  step count, plus **Import** / **Remove** buttons and a **Clear all** button. Saving with an existing name overwrites it.
  Saved configs stay in that browser only; use Export to move them elsewhere.
- **Export config / Import config**: a JSON file on disk.

"Export config" downloads `replace-config.json`:

```json
{
  "tool": "replace-string",
  "version": 1,
  "steps": [
    { "enabled": true, "kind": "text", "find": "foo", "replace": "bar", "flags": "g" },
    { "enabled": true, "kind": "regex", "find": "(\\d+)", "replace": "[$1]", "flags": "gi" }
  ]
}
```

"Import config" replaces the current steps with the steps from a file in this format.
Regex replacements support `$1`, `$<name>`, `$&` etc. (JavaScript `String.prototype.replace` syntax).

## Adding a new tool

1. Create the tool page in `src/tools/<tool-id>/`.
2. Register it in `src/tools/registry.tsx` (id, name, description, icon, path, element). It then appears on the home page and gets its route automatically.
