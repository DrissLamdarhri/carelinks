# CareLink Admin Panel - Integration Guide

## 📋 Overview

CareLink features a unified admin management system with both **mobile** and **web** interfaces:

- **Mobile Admin** (`mobile-app/app/admin/`): Lightweight admin dashboard on mobile devices
- **Web Admin** (`src/app/components/AdminPanel.tsx`): Full-featured admin interface for desktop

## 🔗 Access Flow

### From Mobile App
1. Login as an admin via mobile admin credentials
2. Navigate to "Admin Dashboard"
3. Scroll to "Admin Web" section
4. Tap "Ouvrir le Web Admin" to open the web dashboard in browser

### Web Access
- URL: `http://localhost:5173/admin`
- Desktop-optimized interface for advanced management tasks

## 🔐 Authentication

### Unified Credentials
Both mobile and web interfaces use the **same authentication credentials**:

```
Email:    admin@carelink.ma
Password: CareLinkAdmin2024!
```

### Auth Flow
1. **Mobile Admin** validates credentials locally (`ADMIN_CREDENTIALS`)
2. **Web Admin** validates through Supabase (`RequireAuth` component)
3. Both maintain separate sessions (browser ≠ app)

> **Note**: For production, implement proper Supabase authentication across both platforms

## 📱 Mobile Admin Dashboard

Located at: `mobile-app/app/admin/dashboard.tsx`

**Features:**
- KPIs: Users, Professionals, Bookings, Average Rating
- Priority Actions: Pending KYC, Disputes, Suspensions
- Quick Links:
  - Metrics (`/admin/metrics`)
  - KYC Queue (`/admin/kyc`)
  - Web Admin (External link)

**Routes:**
```
/admin              → Login screen
/admin/dashboard    → Main dashboard
/admin/metrics      → Platform metrics
/admin/kyc          → KYC moderation queue
```

## 🌐 Web Admin Interface

Located at: `src/app/components/AdminPanel.tsx`

**Features:**
- Dashboard with analytics
- User management
- Professional verification (KYC)
- Service catalog management
- Booking analytics
- Settings & configuration

**Routes:**
```
/admin              → Web admin login
/admin/dashboard    → Full admin dashboard
```

## 🔌 Integration Points

### Shared Data Layer
- **Supabase**: Database and auth (configured in `shared/supabase.ts`)
- **Shared Context**: Auth context for both platforms (`shared/auth-context.tsx`)

### Environment Variables

**Mobile App** (`mobile-app/.env`):
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Web** (`src/utils/supabase/info.ts`):
```typescript
export const supabaseProjectId = "your-project-id";
export const supabasePublicAnonKey = "your-anon-key";
```

## 🛠️ Development Setup

### Local Testing

**Terminal 1: Start Web Admin**
```bash
pnpm dev
# Opens at http://localhost:5173/admin
```

**Terminal 2: Start Mobile App**
```bash
pnpm -C mobile-app start
# Follow on-screen instructions to run on device/emulator
```

**Testing Link:**
- From mobile admin dashboard, tap "Ouvrir le Web Admin"
- This will open `http://localhost:5173/admin` in device browser

### Production Deployment

1. **Web**: Deploy to `carelink.ma/admin`
2. **Mobile**: Update `openWebAdmin()` URL to production domain
3. **Auth**: Implement Supabase session sync between platforms

## 📝 Configuration

### Mobile Admin Button

To customize the web admin link, edit `mobile-app/app/admin/dashboard.tsx`:

```typescript
const openWebAdmin = () => {
  // Update URL for your environment
  Linking.openURL("https://carelink.ma/admin"); // Production
};
```

### Mobile Admin Credentials

Edit `mobile-app/app/admin/index.tsx`:

```typescript
const ADMIN_CREDENTIALS = {
  email: "admin@carelink.ma",
  password: "CareLinkAdmin2024!",
};
```

## 🔐 Security Recommendations

1. **Use Supabase Auth**: Replace hardcoded credentials with proper OAuth/SAML
2. **Enable 2FA**: For admin accounts in production
3. **Session Management**: Implement proper token expiry
4. **Audit Logging**: Track all admin actions
5. **Role-Based Access**: Implement granular permissions

## 🐛 Troubleshooting

**Mobile link not working?**
- Ensure web server is running: `pnpm dev`
- Check URL in `openWebAdmin()` function
- Verify device can reach development machine (same network)

**Login fails on web?**
- Check Supabase connection
- Verify environment variables in `src/utils/supabase/info.ts`
- Check browser console for errors

**Mobile app not starting?**
- Clear cache: `pnpm -C mobile-app start --clear`
- Rebuild: `pnpm -C mobile-app build`

## 📚 Related Files

- Mobile Admin: `mobile-app/app/admin/`
- Web Admin: `src/app/components/AdminPanel.tsx`
- Auth: `shared/auth-context.tsx`
- Routes: `src/app/routes.tsx`
- Supabase: `shared/supabase.ts`

---

**Last Updated**: June 2026
