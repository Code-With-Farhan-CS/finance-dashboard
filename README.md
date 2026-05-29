# Personal Finance Dashboard

A premium, responsive personal finance app built with vanilla HTML, CSS, and JavaScript. It loads initial finance data from `data.json`, then persists user changes to `localStorage`.

## Features

- Overview dashboard with balances, pots, budgets, latest transactions, and recurring bills
- Transactions page with search, category filtering, sorting, and 10-item pagination
- Budgets page with create, read, update, delete, progress tracking, validation, and latest category transactions
- Pots page with create, read, update, delete, add money, withdraw money, progress tracking, and validation
- Recurring bills page with search, sorting, and current-month paid/upcoming/due-soon statuses
- Responsive desktop sidebar and tablet/mobile bottom navigation
- Accessible semantic markup, keyboard-friendly controls, focus states, modals, and status messages
- Clean production-style structure using separate HTML, CSS, JavaScript, and JSON files

## Project Structure

```text
index.html
css/style.css
js/script.js
data.json
assets/
```

## Setup

Serve the folder with a local static server, then open the local URL in a browser:

```bash
npx serve .
```

The app will load from `data.json` on first use. After you create, edit, or delete budgets and pots, the app stores updates in `localStorage`. Some browsers block `data.json` when opening `index.html` with `file://`, so a static server is recommended.

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- LocalStorage

## Full-Stack Upgrade Path

The current app is frontend-only so it can be opened directly and pushed to GitHub Pages. To make it full-stack, keep this UI unchanged and add:

- Node.js and Express API routes for balances, transactions, budgets, pots, and recurring bills
- A database such as PostgreSQL, SQLite, or MongoDB
- Authentication with sessions or JWT
- Per-user finance records and server-side validation
