# SKETING

A private goals / finance / schedule / work / todo tracker. Plain HTML + CSS + JS
(no build step) backed by Supabase. Open `index.html` in a browser, or host the
whole folder on any static host (Netlify, Vercel, GitHub Pages, etc).

## File structure

```
sketing-app/
├── index.html              ← markup only, no logic
├── manifest.json           ← PWA/home-screen icon config
├── assets/
│   └── logo.svg             ← the app icon, also used as favicon
├── css/
│   ├── base.css              ← variables, buttons, form fields, resets
│   ├── layout.css            ← header, tabs, panels, responsive grid
│   ├── components.css        ← cards, modals, calendar widget
│   └── animations.css        ← smooth tab-switch fade
├── js/
│   ├── supabaseClient.js     ← the ONLY file with your Supabase URL/key
│   ├── utils.js               ← $(), toast, escapeHtml, date fmt, delete-confirm helper
│   ├── router.js              ← tab switching (fade transition, no flash)
│   ├── calendar.js            ← custom date-picker (replaces native <input type=date>)
│   ├── countdown.js           ← live y/d/h/m/s countdown chips
│   ├── auth.js                ← sign up / log in / log out
│   ├── goals.js               ← goals: linking, savings targets, attachments
│   ├── finance.js             ← income/expense, deferred & recurring entries
│   ├── schedule.js            ← weekly/monthly/yearly recurring items
│   ├── work.js                ← work session timer + history
│   ├── todos.js                ← todos
│   └── main.js                 ← wires everything together (the only entry point)
└── sql/
    └── schema.sql            ← full DB schema, safe to re-run any time
```

**Why this layout:** each panel of the app (Goals, Finance, Schedule, Work,
Todos) is its own file with its own `load*()`, `render()`, and `init*()`
functions. If something breaks in Finance, you only ever need to open
`js/finance.js` — you'll never have to scroll through 1,500 lines of
unrelated goal/schedule code to find it. `main.js` is the only file that
imports everything else, so it also doubles as a map of how the app boots.

## Setup

1. Run `sql/schema.sql` in your Supabase project's SQL editor (safe to
   re-run — it only adds what's missing).
2. Make sure a **public? No — private** storage bucket named `goal-proofs`
   exists (the schema tries to create it automatically).
3. Open `index.html`. That's it — no `npm install`, no build step.

If you ever move to a different Supabase project, the *only* file to edit
is `js/supabaseClient.js`.

## What's new vs. the old single-file version

- **Live countdown** — every goal with a deadline now shows a chip that
  ticks down in years/days/hours/minutes/seconds (`js/countdown.js`).
- **App icon** — `assets/logo.svg` is wired up as the favicon, Apple
  touch icon, and PWA icon via `manifest.json`.
- **Goal linking** — a short-term goal can be linked to a long-term goal
  when creating/editing it. The long-term goal's progress bar automatically
  becomes the average of its linked children, and updates live whenever a
  child's progress or completion changes.
- **Savings goals** — a long-term goal can optionally get a `$` target.
  Income entries in Finance can be linked to that goal; the goal's progress
  bar then tracks "$ saved / $ target" automatically instead of the manual
  slider.
- **Deferred / recurring finance entries** — an entry can be marked
  "Recurring, starts on a future date." It's excluded from every total
  until that date arrives, then it counts every month from then on — e.g.
  income you've set up in advance for next year.
- **Remarks everywhere** — goals, todos, and work sessions all got a
  `notes` field (schedule and finance already had one).
- **Custom calendar** — every date field in the app now opens a themed
  popover calendar (`js/calendar.js`) instead of the browser's native date
  input.
- **Smooth tab switching** — switching between Goals/Finance/Schedule/
  Work/Todos now fades instead of flashing (`js/router.js` +
  `css/animations.css`).
- **Responsive** — layout collapses to a comfortable single column, the
  finance dashboard reflows to 2-across, and the `+ Add` button becomes a
  floating action button on small screens.

## Extending it

- New panel → copy the pattern in `js/todos.js` (it's the simplest one):
  a `load()`, a `render()`, and an `init()` that wires up its own DOM
  listeners. Add a `<button data-panel="...">` tab and a `.panel` div in
  `index.html`, then call your `init()`/`load()` from `main.js`.
- New date field → just use `<input type="date" id="...">` in the HTML;
  `enhanceDateInputs()` in `main.js` picks up every date input
  automatically on page load.
