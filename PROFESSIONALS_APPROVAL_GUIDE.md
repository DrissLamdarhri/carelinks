# Professional Account Approval/Rejection Guide

## Overview
The CareLink admin panel includes a dedicated **Professionals Manager** that allows administrators to:
- View pending professional applications
- Approve professional accounts
- Reject professional accounts with a reason
- View detailed professional information including KYC documents
- Filter and search professionals

## Feature Components

### 1. Admin Panel Integration
- **File**: `src/app/components/AdminPanel.tsx`
- **Tab**: "Professionnels" (Professionals)
- **Navigation**: Located in the main admin dashboard sidebar

### 2. ProfessionalsManager Component
- **File**: `src/app/components/ProfessionalsManager.tsx`
- **Features**:
  - Real-time professional list with status filtering
  - Search functionality (by name or email)
  - Specialty filtering (Nurse, Psychologist, Yoga Instructor, Physiotherapist)
  - Inline approval/rejection buttons for pending professionals
  - Detailed modal view with:
    - Professional information (contact, experience, bio)
    - KYC documents with preview links
    - Professional ratings and review count
    - Approval/rejection action buttons
  - Rejection reason input modal
  - Real-time status updates via Supabase subscriptions

### 3. Status Badges
- **Pending** (En attente): Yellow badge - awaiting admin review
- **Approved** (Approuvé): Green badge - account is active
- **Rejected** (Rejeté): Red badge - application was rejected

## How to Use

### Accessing the Admin Panel
1. Navigate to `http://localhost:5174/admin` (or your production admin URL)
2. Log in with admin credentials
3. Click on "Professionnels" tab in the left sidebar

### Approving a Professional
1. In the professionals list, find a professional with "En attente" (Pending) status
2. **Quick Approval**: Click the green **✓** (check) button in the actions column
3. **Detailed Review**: Click the **👁** (eye) button to open the details modal
   - Review the professional's information
   - Check uploaded KYC documents
   - Click "Approuver" (Approve) button at the bottom
4. A success toast notification will appear
5. The professional will receive an approval notification in the app

### Rejecting a Professional
1. In the professionals list, find a professional with "En attente" (Pending) status
2. **Quick Rejection**: Click the red **✗** (X) button in the actions column
3. **Detailed Review**: Click the **👁** (eye) button to open the details modal
   - Review the professional's information
   - Click "Rejeter" (Reject) button at the bottom
4. A modal will appear asking for the rejection reason
5. Enter a detailed reason (e.g., "Documents incomplets, expérience insuffisante")
6. Click "Confirmer" (Confirm) to submit
7. A success toast notification will appear
8. The professional will receive a rejection notification with the reason

### Filtering and Searching
- **Search**: Use the search box to find professionals by name or email
- **Status Filter**: Click tabs at the top to filter by status:
  - Tous (All)
  - En attente (Pending)
  - Approuvés (Approved)
  - Rejetés (Rejected)
- **Specialty Filter**: Use the specialty dropdown to filter by professional type

### Viewing Professional Details
1. Click the **👁** (eye) icon in the actions column
2. The details modal shows:
   - Professional name and specialty
   - Contact information (email, phone, city)
   - Years of experience
   - Professional rating and review count
   - Professional bio
   - KYC documents with download links
   - Current verification status
   - Rejection reason (if rejected)

## Technical Implementation

### Data Structure
```typescript
type Professional = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  specialty: "nurse" | "psychologist" | "yoga_instructor" | "physiotherapist";
  verification_status: "pending" | "approved" | "rejected";
  verified_at: string | null;
  rejection_reason: string | null;
  bio: string | null;
  years_experience: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  avatar_url: string | null;
};
```

### Real-Time Updates
- The component subscribes to real-time changes on the `professionals` table
- When a professional's status changes, the list automatically updates
- Supports multiple admins working simultaneously

### Document Handling
- Professional KYC documents are stored in the `pro_documents` table
- Documents include: ID, document type, storage path, verification status, upload date
- Documents can be downloaded from Supabase storage with signed URLs

### Notifications
When a professional is approved:
- A notification is created in the `notifications` table
- An approval email is sent (via edge function)
- The professional app shows an approval notification

When a professional is rejected:
- A notification is created with the rejection reason
- A rejection email is sent (via edge function)
- The professional app shows a rejection notification

## Troubleshooting

### Professionals list not loading
- Check Supabase connection
- Verify RLS policies allow admin access
- Check browser console for errors

### Approval/Rejection not working
- Verify admin account has proper permissions
- Check Supabase table update permissions
- Look for error messages in browser console

### Documents not displaying
- Verify documents exist in `pro_documents` table
- Check Supabase storage bucket `pro-documents` permissions
- Verify storage paths are correct

### Real-time updates not working
- Ensure Supabase real-time is enabled
- Check network connectivity
- Verify subscription is created properly

## Database Schema

### professionals table
```sql
CREATE TABLE professionals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  specialty VARCHAR,
  verification_status VARCHAR, -- pending, approved, rejected
  verified_at TIMESTAMP,
  rejection_reason TEXT,
  bio TEXT,
  years_experience INT,
  rating_avg FLOAT,
  rating_count INT,
  created_at TIMESTAMP,
  ...
);
```

### pro_documents table
```sql
CREATE TABLE pro_documents (
  id UUID PRIMARY KEY,
  professional_id UUID REFERENCES professionals(id),
  doc_type VARCHAR,
  storage_path VARCHAR,
  is_verified BOOLEAN,
  uploaded_at TIMESTAMP,
  ...
);
```

## API Functions
- `approvePro(proId: string)` - Approve a professional
- `rejectPro(proId: string)` - Reject a professional
- `getProDocumentsAdmin(proId: string)` - Fetch professional documents
- `sendApprovalEmail(...)` - Send approval notification
- `sendRejectionEmail(...)` - Send rejection notification

## Future Improvements
- Bulk approval/rejection
- Custom approval templates
- Advanced filtering and sorting
- Professional verification history
- Audit logging for all approvals/rejections
- Automatic document verification workflow
