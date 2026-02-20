# User Interface Design

The Gemini Web UI is a React-based single-page application (SPA) featuring a dual-layout shell to provide a distinct experience for public/user interactions versus administrative tasks.

## 1. Dual-Layout Shell

### 1.1 Main Layout (`MainLayout.tsx`)
The public and primary user interface.
- **Top Navbar**: Contains site-wide navigation links (Gemini UI, Home, Login/Register).
- **Session Info**: Displays the logged-in username and a "Logout" button.
- **Dynamic Access**: The "Dashboard" link only appears for users with the `read:dashboard` permission (or Root).

### 1.2 Dashboard Layout (`DashboardLayout.tsx`)
The administrative command center.
- **Sidebar Navigation**: Fixed left-side navigation for managing system resources:
  - Overview
  - Users
  - Roles
  - Permissions
  - System Settings
- **Admin Footer**: Displays current session info and a logout button that revokes the JWT server-side.

---

## 2. Interactive Management UI

### 2.1 Attach/Detach Pattern
For complex relationships (like User-to-Roles or Role-to-Permissions), we avoid traditional checkboxes in favor of an "Attach/Detach" UI.
- **Badges**: Current assignments are shown as grey badges with a red `x` for quick detaching.
- **Modals**: An "Attach" button opens a modal window listing only the *available* (non-assigned) items.
- **ID-Based State**: Modals use `activeId` state to prevent re-render loops and ensure reliable closing.

### 2.2 Modal Experience
- **Overlay**: Clicking the dimmed background closes the modal.
- **Done/X**: Explicit "Done" and "X" buttons provide multiple clear exit paths.
- **Keyboard (Future)**: Support for the `Esc` key is planned.

---

## 3. Styling Principles

### 3.1 Visual Hierarchy
- **Primary Actions**: Solid blue buttons (`#1a73e8`).
- **Destructive Actions**: Red text or buttons (`#dc3545`).
- **Success Actions**: Green text or buttons (`#28a745`).
- **Cards**: Resource items (users, roles) are grouped into cards with subtle shadows and clean borders.

### 3.2 Responsive Design
- **Admin Tables**: Optimized for desktop viewing but includes scrollable wrappers for smaller screens.
- **Cards**: Use CSS Grid with `repeat(auto-fill, minmax(350px, 1fr))` to reflow naturally based on viewport width.
