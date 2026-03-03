# Dock

Dock is a lightweight Project Bookmark and Focus Manager for VS Code.

## Features (MVP v0.1)

- Activity Bar icon and dedicated Dock sidebar.
- Sidebar title: **Dock – Aditya Sarode**.
- Header description:
  - `Workspace: <WorkspaceName>`
  - `User: Aditya Sarode`
- Shows only project names by default (collapsed).
- Single click project: expands and loads structure lazily.
- Double click project: opens project based on mode (`newWindow`, `currentWindow`, or prompt with `Add to Workspace`).
- Register projects via:
  - Explorer context menu: **Register to Dock**
  - Command: **Dock: Register Existing Folder**
- Create empty project folder via **Dock: Create New Project**.
- Automatic tracking on create/delete/save updates metadata and refreshes tree.
- Search projects by name, tags, languages, and path via **Dock: Search Project**.
- Metadata stored in `.dock/index.json` at workspace root.

## Settings

- `dock.defaultOpenMode`: `newWindow` | `currentWindow` | `ask` (default)
- `dock.showAuthorHeader`: `true` | `false` (default: `true`)
