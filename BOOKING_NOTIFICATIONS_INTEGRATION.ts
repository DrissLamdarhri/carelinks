/**
 * Quick integration guide for booking notifications
 * Add this to your booking creation flow
 */

// STEP 1: In your booking creation function, import the notification system
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";

// STEP 2: After creating a booking in your API/Supabase
export async function createBookingAndNotifyAdmin(bookingData) {
  // Your existing booking creation logic
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert([bookingData])
    .select()
    .single();

  if (error) {
    console.error("Error creating booking:", error);
    return null;
  }

  // IMPORTANT: Notify admin immediately
  if (booking) {
    await notifyAdminNewBooking(booking);
  }

  return booking;
}

// STEP 3: Update your booking status change handler
import { notifyAdminBookingStatusChange } from "@/lib/admin/booking-notifications";

export async function updateBookingStatusAndNotifyAdmin(bookingId, newStatus) {
  // Get the current booking to know the previous status
  const { data: currentBooking } = await supabase
    .from("bookings")
    .select()
    .eq("id", bookingId)
    .single();

  // Update the booking
  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .update({ status: newStatus })
    .eq("id", bookingId)
    .select()
    .single();

  if (error) {
    console.error("Error updating booking:", error);
    return null;
  }

  // Notify admin of status change
  if (updatedBooking && currentBooking) {
    await notifyAdminBookingStatusChange(updatedBooking, currentBooking.status);
  }

  return updatedBooking;
}

// STEP 4: Optional - Add real-time listener to your booking page
import { useBookingNotifications } from "@/lib/admin/use-booking-notifications";

function MyBookingScreen() {
  const { booking } = useBooking();
  const { user } = useAuth();

  // This will automatically notify admin when booking status changes
  useBookingNotifications(booking?.id ?? null, user?.id ?? null);

  return (
    <View>
      {/* Your booking UI here */}
    </View>
  );
}

// STEP 5: Access admin bookings page
// The admin can now go to /admin/bookings to see all reservations
// with automatic notifications for:
// - All reservations
// - Psychologist appointments (marked with 🧠)
// - Urgent cases (⚠️)
// - Critical cases (🚨)
