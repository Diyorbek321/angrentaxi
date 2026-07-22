# Angren Taxi — Web Dashboard Design Prompts

Each prompt in this file is **standalone** — copy-paste it into Claude (or any other
AI design tool) and it should produce a **complete, working dashboard UI** on its own.
Each prompt includes: context, tech stack, brand/design system, page list, the
components on every page, data model, and edge cases — enough detail that nothing
extra needs to be asked before a full dashboard can be built.

**Shared decisions (apply to all 5 dashboards):**
- Brand color: **mint green `#1FCA8E`** (primary), `#10A064` (dark variant), `#27D89B` (light variant) —
  same as the mobile app (`mobile/lib/core/config/app_theme.dart`). Ink/text color `#0F1B22`, background `#F4F7F8` (light) / `#0B1210` (dark).
- Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, lucide-react icons, recharts for charts.
- Font: Manrope (body text), JetBrains Mono (numbers/codes — e.g. order IDs, prices).
- Both dark and light mode, with a toggle.
- Every dashboard: left sidebar navigation (collapsible), top header (search, notifications, profile menu), main content area.
- Every table: search, filters, pagination, CSV export.
- All UI copy in **English**, currency displayed in **UZS / so'm** (e.g. "125,000 UZS").
- Responsive: desktop-first, but should not break on tablet (a mobile layout is not required — this is an internal staff tool).
- Even if a real backend isn't wired up yet, render a **fully working state with realistic mock data** (not empty screens).

---

## 1) Dispatcher Dashboard — live monitor + exception console

```
You are a professional B2B SaaS dashboard designer and frontend engineer.
Design and build a DISPATCHER web panel for Angren Taxi (Angren city, Uzbekistan) as
a complete, working Next.js 14 + TypeScript + Tailwind CSS application.

CONTEXT — READ CAREFULLY, this changes the whole design:
Driver assignment is FULLY AUTOMATIC (Yandex Go / Bolt / Uber model) — a matching
service finds the nearest online driver by GPS, offers the ride, waits 15 seconds,
and cascades to the next-nearest driver on a decline or timeout, with zero human
involvement. The dispatcher does NOT assign drivers to orders as their default job.
Their job is to (1) watch the live system state and (2) handle the exceptions the
algorithm can't: no drivers found in an area, an SOS/panic alert, a driver's car
breaking down mid-trip, a customer complaint that needs a human call. Manual driver
assignment still exists, but ONLY as a deliberate, reason-required override — never
the primary interaction on every order.

Also important: this dashboard is used by MANAGER accounts under a fine-grained
permission system (RBAC) — not every manager can see every page. Design the sidebar
so it's driven by a `permissions: string[]` array on the current user, e.g.
`dispatch`, `drivers_view`, `drivers_approve`, `drivers_finance`. If the logged-in
account only has `dispatch`, they should see ONLY Live Monitor/Exceptions/Manual
Order Creation/Audit Log — the sidebar must gracefully render with just one item,
not look broken. Fetch the current user's permissions once (e.g. `GET /users/me`)
and filter the nav array against it.

BRAND / DESIGN SYSTEM:
- Primary color: mint green #1FCA8E (accent/CTA), dark variant #10A064, light variant #27D89B
- Ink (text): #0F1B22, background: #F4F7F8 (light) / #0B1210 (dark), with a dark/light toggle
- Font: Manrope (UI text), JetBrains Mono (IDs, timestamps, prices)
- Status colors: pending=gray, searching=amber, assigned=blue, en route=mint,
  delivered=dark green, cancelled=red
- Reserve amber/orange specifically for "manual override" affordances — it should read
  as "this is an exception path", visually distinct from the mint-colored automatic flow

LAYOUT:
- Left sidebar (collapsible): Live Monitor, Exceptions, Drivers, Manual Order Creation,
  Override Audit Log, Shift Report
- Header: active-orders-in-city count (live badge), online drivers count, an "Exceptions"
  badge that turns red and pulses when > 0, search, notification bell (with an audio-cue
  icon for new SOS/complaints), operator profile

MAIN SCREEN — "Live Monitor" (split view, two panels side by side, mostly READ-ONLY):
1. LEFT PANEL — Order feed (real-time list, styled to look auto-refreshing):
   - Each card: order ID, customer name/phone, pickup/dropoff address, service type icon
     (taxi/cargo), status badge, assigned driver (once matched) with avatar+name+rating,
     and — while status is "searching" — a small progress indicator ("offering to driver
     2 of 3...") so the operator can SEE the algorithm working, not just wait blindly
   - Filter tabs: All / Searching / Assigned / En Route / Completed
   - Clicking a card opens a read-only detail drawer (customer history, price breakdown,
     which drivers were offered and in what order, timestamps) — NO assign button here;
     this view is for understanding what the system already did
2. RIGHT PANEL — Live map (styled as an OpenStreetMap/Leaflet-style placeholder):
   - All online drivers shown as mint car icons on the map, busy ones shown in gray
   - Pickup/dropoff pins and route line for the selected order
   - Floating panel over the map: citywide density stats (busy/available driver ratio)

PAGE: Exceptions — the dispatcher's actual worklist, NOT a generic order table
- Two sections: "No drivers found" (orders the matching service gave up on after its
  search window) and "SOS / Safety" (panic alerts, red-flagged and always on top)
- Each exception card: what happened, how long it's been unresolved, one-click actions:
  "Call customer", "Manual override" (opens the override flow below), "Resolve"
- This page's badge count in the sidebar is what operators actually watch all shift

PAGE: Manual Override flow (NOT a default action on every order — reached only from
Exceptions or a deliberate "Override" button on an already-assigned order)
- Modal/drawer: order summary, a REQUIRED reason field (free text, min ~5 chars,
  e.g. "No drivers found automatically" / "Driver's car broke down"), then a driver
  picker (search by name/plate/phone, shows only online+free drivers)
- Submitting is disabled until a reason is entered — every override is written to a
  durable audit log, never silent
- Visually distinct (amber accent, "Manual Override" label) from anything that looks
  like a routine action

PAGE: Override Audit Log
- Table: timestamp, order ID, performed by (operator name), previous driver → new
  driver, reason — sortable/filterable, this is what a manager reviews to make sure
  overrides are being used for real exceptions, not as a shortcut habit

PAGE: Drivers (live status)
- Grid/table: avatar, name, phone, vehicle (make+plate), rating, status (online/busy/offline),
  trips completed today, last location update time
- Quick "Message" and "Call" buttons
- Ability to select one driver and highlight them on the map

PAGE: Manual Order Creation (for call-center use — a customer calling in is a real
use case, this is NOT the same as manually assigning a driver)
- Form: customer phone number (auto-lookup of existing customer), pickup/dropoff address
  (map-based picker), service type, tariff selection, notes field, "Create Order" button
- After creation, the order enters the exact same automatic matching flow as an
  app-originated order — no driver picker here, no shortcut

PAGE: Shift Report
- Operator's shift stats: exceptions handled, average time-to-resolve, override count
  (flag if unusually high vs. team average), daily/weekly chart (recharts line chart)

EXTRAS:
- Show a toast notification + animated audio-cue icon whenever a new EXCEPTION arrives
  (not every order — that would retrain operators to watch every order again)
- Design polished empty states — an empty Exceptions page is the GOOD, normal state,
  design it to feel calm/positive (e.g. a checkmark + "No exceptions — everything's
  running automatically"), not like something is missing
- Break components into reusable pieces: StatCard, StatusBadge, OrderCard (read-only),
  ExceptionCard, OverrideModal, AuditLogTable, DriverCard, LiveMap, Sidebar, Header
```

---

## 2) Manager Dashboard — operations management panel

```
You are a professional B2B SaaS dashboard designer and frontend engineer.
Design and build a MANAGER (operations manager) web panel for Angren Taxi as a
complete, working Next.js 14 + TypeScript + Tailwind CSS application.

CONTEXT:
Unlike the dispatcher, the manager isn't dealing with real-time orders — they handle
**day-to-day/weekly operational management**: driver onboarding/blocking/penalties/bonuses,
financial oversight, tariff and promo-code configuration, and reporting. This dashboard
is not fast-paced — it's analytics- and management-focused.

Same RBAC model as the Dispatcher dashboard: the current manager's account has a
`permissions: string[]` array (e.g. `drivers_view`, `drivers_approve`, `drivers_finance`,
`tariffs_manage`, `promo_manage`, `bonuses_view`, `support_manage`, `withdrawals_view`).
A manager might have `drivers_view`+`drivers_approve` but NOT `drivers_finance` — in
that case, hide balance/commission-rate editing entirely (don't just disable the
button, don't show it) rather than showing a page they'll get a 403 on. Two important
asymmetries this creates:
- Tariff/promo-code changes a manager makes are PROPOSALS — an admin approves or
  rejects them elsewhere; never design a manager-facing "Approve" button for these.
- The Finance/withdrawal queue below is VIEW-ONLY for a manager — approving,
  rejecting, or marking a payout paid happens only in the Super Admin panel, since
  moving money is deliberately kept out of this permission set by default.

BRAND / DESIGN SYSTEM:
- Primary color: mint green #1FCA8E, dark #10A064, light #27D89B
- Ink: #0F1B22, background: #F4F7F8 (light) / #0B1210 (dark), dark/light toggle
- Font: Manrope + JetBrains Mono (for numbers)
- Chart color palette: mint (primary), blue, amber, purple — to distinguish categories

LAYOUT:
- Left sidebar: Overview, Drivers, Penalties/Bonuses, Finance, Tariffs, Promo Codes,
  Reports, Settings
- Header: date-range selector (today/week/month/custom — a global filter affecting the
  whole dashboard), search, notifications, profile

PAGE: Overview
- 6 StatCards at the top: Total Revenue, Completed Orders, Active Drivers,
  Average Trip Price, Cancellation Rate, New Customers — each with a % change vs.
  the previous period (green/red arrow indicator)
- Large line chart (recharts): daily revenue and order count (two lines, dual axis)
- Donut chart: distribution by service type (Taxi/Cargo/Market/Eats — if the manager
  also tracks other verticals, otherwise just Taxi/Cargo)
- Bar chart: order density by hour (which hours have the most orders — for shift planning)
- "Needs attention" list: low-rated drivers, customers with frequent cancellations,
  promo codes about to expire

PAGE: Driver Management
- Full table: name, phone, vehicle, registration date, status
  (active/blocked/pending approval), rating, total trips, total earnings, document status
- Filters: status, rating range, registration date
- Driver profile page: personal info, documents (driver's license, vehicle registration
  photos — with approve/reject buttons, only shown if the manager has `drivers_approve`),
  trip history, penalty/bonus history, rating breakdown (customer reviews)
- New driver approval workflow: review documents from the "Pending" list, "Approve"/"Reject + reason"
  (requires `drivers_approve`)
- A "Finance" tab/section on the driver profile (balance adjustment, commission-rate
  override) — requires `drivers_finance` specifically; render the whole tab absent for
  a manager who doesn't have it, don't just grey it out

PAGE: Penalties and Bonuses
- Two tabs: Penalties / Bonuses
- Table: driver, amount, reason, date, applied by, status
- "Add new penalty/bonus" modal: driver picker (autocomplete), amount, reason (dropdown:
  late arrival, complaint, excellent service, etc.), notes
- Monthly summary: net balance (penalties - bonuses) per driver

PAGE: Finance (view-only — requires `withdrawals_view`)
- Total revenue, commission (platform's share), payouts, pending payouts (payout queue)
- Withdrawal requests table — spans THREE requester types, not just drivers: driver,
  Market vendor, Eats restaurant owner (a "Requester type" column/badge distinguishes
  them). Columns: requester, type, amount, payout destination, status
  (pending/approved/rejected/paid), requested date
- NO "Approve"/"Reject"/"Mark paid" buttons here — a banner explains: "Processing
  happens in the Super Admin panel. This view is for oversight."
- Breakdown by payment method (Payme/Click/Cash) — pie chart

PAGE: Tariffs
- Tariff card grid: name (Standard/Comfort/Small Cargo/Large Cargo), base price, price per km,
  price per minute, minimum price — each with an "Edit" button
- Form to add a new tariff

PAGE: Promo Codes
- Table: code, discount type (%/fixed amount), usage limit, times used, expiry date, status
- New promo code creation form + "active promo codes" stats (times used, total discount given)

PAGE: Reports
- Date-range report generator, exportable as PDF/CSV: daily/weekly/monthly revenue report,
  driver activity report, customer activity report

EXTRAS:
- Every chart should have fully working tooltips and legends
- Reusable components: StatCard, TrendChart, DataTable (sortable+filterable), DriverProfileDrawer,
  ApprovalWorkflow, DateRangePicker
```

---

## 3) Market Dashboard — online store / vendor panel

```
You are a professional B2B SaaS dashboard designer and frontend engineer.
Design and build a VENDOR (store owner/staff) web panel for the MARKET
(online store) vertical of the Angren Taxi super-app, as a complete, working
Next.js 14 + TypeScript + Tailwind CSS application.

CONTEXT:
This dashboard is for a single store (e.g. a local market/supermarket) to manage
its own products, orders, and stock. Each store owner should only see their own
store's data (design it as one tenant of a multi-store system, but also add a
"switch store" selector in the header for when an admin logs in and can see all stores).

BRAND / DESIGN SYSTEM:
- Primary color: mint green #1FCA8E, dark #10A064, light #27D89B
- Ink: #0F1B22, background: #F4F7F8 (light) / #0B1210 (dark), dark/light toggle
- Font: Manrope + JetBrains Mono
- Use gray placeholder images with an icon for product cards without a real photo

LAYOUT:
- Left sidebar: Overview, Orders, Products, Categories, Stock, Reports, Settings
- Header: store name/logo, "open/closed" status toggle (temporarily close the store),
  new-order notification (with an audio-cue icon), search, profile

PAGE: Overview
- StatCards: today's orders, today's revenue, pending orders, low-stock product count
  (low-stock alert)
- Line chart: revenue over the last 7/30 days
- Best-selling products ranking (top 5, image+name+units sold)
- "Needs attention" section: out-of-stock products, unanswered orders

PAGE: Orders
- Kanban-style columns (or tabs+table): New / Preparing / Ready for Delivery /
  In Transit / Delivered / Cancelled
- Each order card: ID, customer name/address, item list (qty+price), order total,
  payment method, courier status (if assigned)
- Clicking a card opens a detail modal: full item list, customer note, "Accept/Reject"
  (for new orders), "Mark Ready" button
- Toast + animated audio-cue icon when a new order arrives

PAGE: Products
- Grid view (image, name, price, stock quantity, active/inactive toggle)
- "Add new product" modal: image upload, name, description, category, price, sale price
  (optional), unit (piece/kg/liter), stock quantity
- Bulk actions: select multiple products to change price/delete in bulk

PAGE: Categories
- Tree/list view of categories (Beverages, Bakery, Dairy, etc.), showing product count
  per category, drag-and-drop reordering

PAGE: Stock
- Table: product, current stock, low-stock threshold, last restocked date
- Low-stock rows highlighted in red
- Quick "Restock" action (enter quantity)

PAGE: Reports
- Date-range based: revenue, order count, best/worst-selling products,
  breakdown of cancellation reasons
- CSV export

PAGE: Settings
- Store profile (name, address, business hours, phone), delivery zone and fee,
  bank details (for payouts)

EXTRAS:
- Reusable components: ProductCard, OrderKanbanColumn, StockAlertRow, StatCard, ImageUploadField
```

---

## 4) Eats Dashboard — restaurant / food delivery panel

```
You are a professional B2B SaaS dashboard designer and frontend engineer.
Design and build a RESTAURANT panel (for restaurant owner/staff) for the EATS
(food delivery) vertical of the Angren Taxi super-app, as a complete, working
Next.js 14 + TypeScript + Tailwind CSS application.

CONTEXT:
This dashboard is for a single restaurant to manage its menu, orders, and kitchen
workflow. Unlike Market, food delivery is extremely time-sensitive (the customer is
hungry and waiting), so the UI must be fast and unambiguous (large buttons, minimal
clicks to change order status).

BRAND / DESIGN SYSTEM:
- Primary color: mint green #1FCA8E, dark #10A064, light #27D89B
- Ink: #0F1B22, background: #F4F7F8 (light) / #0B1210 (dark), dark/light toggle
- Font: Manrope + JetBrains Mono
- The "preparation time" countdown timer on order cards should be large and highly visible

LAYOUT:
- Left sidebar: Overview, Orders (Kitchen Screen), Menu, Categories, Reports, Settings
- Header: restaurant name, "open/closed" status toggle, "busy" status (temporarily pause
  new orders, e.g. during a lunch rush), notifications, search, profile

PAGE: Overview
- StatCards: today's orders, today's revenue, average preparation time, customer rating
- Line chart: order volume by hour (lunch/dinner peaks should be visible)
- Most-ordered dishes ranking (image+name+order count)
- "Needs attention" section: delayed orders, recent low-rated orders

PAGE: Orders (Kitchen Screen) — THE MOST IMPORTANT PAGE, large and unambiguous design:
- Kanban columns: New (awaiting acceptance) / Preparing / Ready (awaiting courier) /
  Handed to Courier / Completed
- Each card in large type: order number, dish names+quantities (e.g. "2x Lagman, 1x Somsa"),
  special notes (e.g. "no spice" — highlighted with a yellow background), elapsed time since
  order was placed (count-up timer, turns red if over 15 minutes)
- Each card has one large button: "Accept" → "Ready" → "Handed to Courier" (progresses
  one status at a time with a single tap)
- New order arrival triggers a large modal + audio cue (kitchens are noisy, so this needs
  to be highly visually prominent)

PAGE: Menu
- Dishes grid grouped by category (image, name, price, available/sold-out toggle)
- "Add new dish" modal: image, name, description, price, prep time (minutes),
  ingredients/allergens (as tags), add-ons (e.g. "extra cheese +5,000 UZS")
- Quick "sold out" toggle — when tapped, the dish shows as grayed-out/unavailable on the menu

PAGE: Categories
- List of menu sections (Main Dishes, Fast Food, Beverages, Desserts) with reordering

PAGE: Reports
- Date-range based: revenue, order count, prep-time trend, best/worst-selling dishes,
  cancellation reasons
- CSV export

PAGE: Settings
- Restaurant profile (name, address, business hours, phone, image/logo), delivery zone,
  minimum order amount, bank details

EXTRAS:
- A "fullscreen/kiosk mode" button for the kitchen screen (an always-on large-screen
  mode — sidebar hidden, only the order kanban remains)
- Reusable components: MenuItemCard, KitchenOrderCard, CountdownTimer, StatCard
```

---

## 5) Super Admin Dashboard — master control panel (controls everything)

```
You are a professional B2B SaaS dashboard designer and frontend engineer.
Design and build the TOP-LEVEL SUPER ADMIN web panel for the Angren Taxi super-app,
as a complete, working Next.js 14 + TypeScript + Tailwind CSS application.

CONTEXT:
This is the single "god-mode" panel that controls the entire platform. The super
admin sees and manages all of the following verticals:
- Taxi (all Dispatcher/Manager-level data)
- Cargo (freight/courier requests)
- Market (all stores)
- Eats (all restaurants)
- Users, drivers, couriers, store/restaurant owners (every role)
- Finance (platform-wide)
- System settings, roles and permissions management

This dashboard includes ALL the functionality of the other 4 panels (Dispatcher,
Manager, Market, Eats) PLUS oversight over them PLUS platform-level settings.
Navigation must therefore be deeply hierarchical (sections within sections) but
never confusing.

BRAND / DESIGN SYSTEM:
- Primary color: mint green #1FCA8E, dark #10A064, light #27D89B
- Ink: #0F1B22, background: #F4F7F8 (light) / #0B1210 (dark), dark/light toggle
- Font: Manrope + JetBrains Mono
- Secondary colors to distinguish verticals: Taxi=mint, Cargo=blue,
  Market=purple, Eats=orange (used as badges/tags — the primary brand color stays mint)

LAYOUT:
- Left sidebar, hierarchical groups (accordion/collapsible sections):
  1. **Overview** — Dashboard home (cross-vertical summary)
  2. **Taxi & Cargo** — Live Map, Orders, Drivers, Tariffs
  3. **Market** — Store Directory, All Orders, Product Moderation
  4. **Eats** — Restaurant Directory, All Orders, Menu Moderation
  5. **Users** — Customers, Drivers, Couriers, Vendor/Restaurant Owners
  6. **Finance** — Platform Revenue, Payouts, Commission Settings
  7. **Marketing** — Promo Codes, Bonuses, Push Notifications
  8. **System** — Staff & Roles (RBAC), Audit Log, Global Settings
- Header: global search (by any order/user/store/restaurant ID), vertical filter
  selector (All/Taxi/Cargo/Market/Eats — affects the whole dashboard), date-range
  selector, notifications, super admin profile

PAGE: Overview (cross-vertical dashboard home)
- 4 large "vertical cards" at the top (Taxi, Cargo, Market, Eats) — each showing:
  today's orders, revenue, active users (drivers/couriers/vendors), a mini trend line,
  and clicking navigates to that vertical's detail section
- Below that, a row of overall StatCards: total platform revenue, total users,
  total active orders (all verticals), average platform commission
- Large stacked/grouped bar chart: daily revenue comparison across verticals
- "Recent activity" table: last 20 important events across all verticals
  (new order, new store registration, penalty applied, etc.) — styled as an audit log

PAGE: Taxi & Cargo section
- Contains ALL pages from the Dispatcher and Manager dashboards (as an internal
  tab/sub-nav): Live Monitor, Exceptions, Driver Management, Override Audit Log,
  Penalties/Bonuses, Tariffs — driver assignment is automatic (see the Dispatcher
  prompt); this section is for oversight, not manual dispatch
- Difference: here the super admin can view across all cities/zones (for future
  multi-city expansion), whereas dispatcher/manager only see their assigned zone

PAGE: Market section
- **Store Directory** (a new page, not present at the vendor level): table of all
  registered stores — name, owner, status (active/pending approval/blocked),
  registration date, total orders, rating
  - New store approval workflow: review documents (license, certificate),
    "Approve"/"Reject"
  - Quick block/activate action per store
- **All Orders** — orders table across all stores (filterable by store)
- **Product Moderation** — review and remove inappropriate product images or names

PAGE: Eats section
- Same structure as Market, but for restaurants: **Restaurant Directory** (with
  approval workflow), **All Orders**, **Menu Moderation**

PAGE: Users section (4 sub-tabs)
- **Customers**: all registered users, trip/order history, block action
- **Drivers**: same as the Manager dashboard, but across all cities/zones
- **Couriers**: delivery personnel list (for Market/Eats), status, activity stats
- **Vendor/Restaurant Owners**: account details, which store/restaurant they're
  linked to, access management

PAGE: Finance section
- Total platform revenue (across all 4 verticals), per-vertical commission rate
  setting (e.g. Taxi 15%, Market 10%, Eats 12% — editable)
- All payout requests in a SINGLE queue spanning three requester types — driver,
  Market vendor, Eats restaurant owner (a type badge/column tells them apart, since
  they share one underlying withdrawal-request table) — filter by status
  (pending/approved/rejected/paid) and by requester type. Actions: "Approve",
  "Reject" (with reason), "Mark Paid" (a manual step — no real payment-processor
  payout integration exists yet, this just records that money was sent by whatever
  channel the business uses, e.g. a bank/card transfer done outside the app)
- Overall stats by payment method (Payme/Click/Cash)

PAGE: Marketing section
- Promo codes (for all verticals, can be scoped to a single vertical: Taxi-only,
  Market-only, or all)
- Bonuses (driver/courier incentive programs)
- Push notification panel: compose message, select target audience
  (all/customers only/drivers only/by city), send history

PAGE: System section
- **Staff & Roles (RBAC)**: there is no separate "dispatcher account type" —
  everyone who isn't ADMIN is a MANAGER, and what they can actually do is
  determined by a `permissions: string[]` field on their account. Design this as:
  - A table of all MANAGER accounts: name, phone, and a compact summary of their
    permissions (a badge showing "Full access" if they have everything, "No access"
    if empty, or a few permission-name chips + "+N more" otherwise)
  - Clicking a row opens a permission editor: a checklist of exactly these ten
    permissions, each with a one-line description of what it unlocks —
    `dispatch` (Live Monitor, Exceptions, Manual Override, Audit Log),
    `drivers_view` (driver roster), `drivers_approve` (KYC approval),
    `drivers_finance` (balance/commission-rate — a money-moving permission,
    visually flagged as sensitive), `tariffs_manage` (propose tariff changes/surge),
    `promo_manage`, `bonuses_view`, `support_manage`, `withdrawals_view`,
    `users_view`
  - Three quick-preset buttons above the checklist: "Full manager" (checks
    everything), "Dispatch only" (checks just `dispatch` + `drivers_view`),
    "Clear" (unchecks everything) — admins mostly want a preset, not to hand-pick
    ten boxes every time
  - A save button that replaces the account's entire permission list (not a merge)
  - Explicitly state near the top: "ADMIN accounts always have full access and
    don't use this list — this page only affects MANAGER accounts."
- **Audit Log**: who changed what and when — fully searchable/filterable log
- **Global Settings**: platform name, support phone/email, app version info,
  maintenance mode toggle

EXTRAS:
- This is the largest and most complex dashboard — keep components highly modular:
  VerticalSummaryCard, EntityApprovalTable (a shared component for store/restaurant/
  driver approval), PermissionMatrix, AuditLogTable, GlobalSearchBar, VerticalFilterSelector
- Make permission levels clearly visible: the super admin always sees "everything,"
  but demonstrate on the RBAC page how a regular admin's view can be restricted
- Design polished empty states, loading skeletons, and error states throughout
```

---

## How to use this

1. Copy each prompt (the content inside the ``` ``` block) in full and give it to Claude one at a time.
2. Ask for each one as a **separate project/artifact** — don't mix them together, or the AI may cross-contaminate them.
3. Compare the result against the existing code: `web-manager` (base for Dispatcher+Manager),
   `web-market`, `web-restaurant`, `web-admin` (base for Super Admin) — these folders already
   have a Next.js skeleton, so it's easier to adapt the new design onto that structure.
4. If the result feels too generic, add to the prompt: "match the style of the existing
   components in `web-admin/src` (Card, StatCard, Header, Toast)" — this keeps visual consistency.
5. A meaningful slice of this is already real, not mock — if you're regenerating a
   dashboard, check these first so the AI design tool builds *on top of* them instead of
   duplicating: `web-manager/src/app/dispatch/exceptions`, `.../audit-log`, `.../drivers`
   (Manual Override with required reason + audit log, SOS + no-drivers-found queue, driver
   roster with permission-gated Finance actions); `web-admin/src/app/dashboard/withdrawals`
   (the cross-vertical payout queue) and `.../staff` (the RBAC permission editor described
   in the Super Admin prompt above). The backend RBAC (`Permission` enum, `PermissionsGuard`)
   these all depend on is real and enforced — a redesigned UI still needs to respect it,
   not just look like it does.
