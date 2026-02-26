# ISMS React Conversion

This project has been converted from Flask HTML templates to React components.

## 📁 File Structure

```
isms/
├── templates/
│   ├── Admin.jsx          # Admin dashboard component
│   ├── Login.jsx          # Login page component
│   ├── SuperAdmin.jsx     # Super Admin dashboard component
│   ├── SubAdmin.jsx       # Sub Admin (Mentor) dashboard component
│   ├── Dashboard.jsx      # Generic dashboard component
│   ├── App.jsx            # Main app with routing
│   ├── index.jsx          # React entry point
│   └── index.html         # HTML template
├── package.json           # Dependencies
└── vite.config.js         # Vite configuration
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd c:\Users\SHOBHIT\Downloads\isms
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

This will start the Vite development server at `http://localhost:3000`

### 3. Build for Production

```bash
npm run build
```

## 🛠️ Backend Integration (For Reviewer)

This project is prepared for backend integration. All API endpoints are centralized and easily configurable.

### 1. Configure API URL
Create or edit the `.env` file in the root directory and set the backend URL:

```bash
VITE_API_URL=http://your-backend-api-url:port
```

### 2. API Endpoints
The frontend expects the following endpoints from your backend:
- `POST /api/login` - User authentication
- `GET /api/reports` - Fetch reports (supports `?type=Daily` or `?type=Weekly`)
- `POST /api/reports` - Submit new reports
- `DELETE /api/reports/:id` - Delete a report
- `GET /api/users` - Fetch user lists and statistics
- `GET /api/logs` - System logs
- `GET /api/mentors/performance` - Performance metrics

## 📝 Components Overview

### Login.jsx
- Handles user authentication
- Form with username and password fields
- Redirects to appropriate dashboard based on role

### Admin.jsx
- Admin dashboard with sidebar navigation
- Displays stats: Total Users, Daily Productivity, Weekly Activity

### SuperAdmin.jsx
- Super Admin dashboard
- Shows Total Users, Total Admins, Productivity stats

### SubAdmin.jsx (Mentor)
- Full-featured dashboard with modern UI
- Top navigation bar with search
- Sidebar navigation
- Stats cards
- System overview with live monitors
- Monthly reports section
- Interactive report tabs (Daily/Weekly/Monthly)

### Dashboard.jsx
- Generic dashboard component
- Can be customized for different user types

## 🔄 Conversion Changes

### From HTML Templates to React:
1. ✅ Converted all `.html` files to `.jsx` React components
2. ✅ Added React Router for navigation
3. ✅ Converted inline styles to CSS-in-JS where needed
4. ✅ Added state management with React hooks
5. ✅ Made components interactive (e.g., report tabs in SubAdmin)
6. ✅ Set up Vite for fast development and building

### Key Differences:
- **Routing**: Now uses React Router instead of Flask routes
- **State**: Form inputs and UI state managed with React hooks
- **Styling**: CSS classes remain the same, styles can reference `style.css`
- **Interactivity**: Components are now interactive with React events

## 🔗 Integration with Flask (Optional)

If you want to keep Flask as the backend API:

1. Build the React app: `npm run build`
2. Serve the built files from Flask
3. Use Flask for API endpoints only
4. Update API calls in React components to point to Flask endpoints

## 📦 Dependencies

- **React 18.2.0**: UI library
- **React Router DOM 6.20.0**: Client-side routing
- **Vite 5.0.8**: Build tool and dev server
- **@vitejs/plugin-react**: Vite plugin for React

## 🎨 Styling

The components reference `style.css` for styling. Make sure to:
1. Keep your existing `static/style.css` file
2. Or move styles into component files
3. Or use a CSS-in-JS solution like styled-components

## 🔐 Authentication

Currently, the Login component has a basic form submission. You'll need to:
1. Set up API endpoints in Flask (or another backend)
2. Update the fetch call in `Login.jsx` to point to your API
3. Handle JWT tokens or session management
4. Add protected route logic in `App.jsx`

## 📱 Responsive Design

The SubAdmin component includes responsive breakpoints:
- Desktop: Full layout with sidebar
- Tablet (< 1100px): Stacked content grid
- Mobile (< 900px): Vertical sidebar layout

## 🛠️ Next Steps

1. ✅ Install dependencies
2. ✅ Run the dev server
3. 🔲 Set up backend API endpoints
4. 🔲 Implement authentication logic
5. 🔲 Add data fetching from backend
6. 🔲 Customize styling as needed
7. 🔲 Add more features and components

---

**Note**: The old HTML files are still in the templates folder. You can keep them as backup or remove them once you're satisfied with the React version.
# ISMS
