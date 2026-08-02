import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface YogaSession {
  id: string;
  title: string;
  description?: string;
  instructor: string;
  level: string;
  imageUrl?: string;
  startsAt: string;
  durationMin: number;
  capacity: number;
  priceMad: number;
  enrolledCount: number;
  address?: string;
  city?: string;
  isOnline?: boolean;
  meetingUrl?: string;
}

/**
 * Hook to fetch and subscribe to yoga sessions in real-time
 * Automatically updates when admin adds/edits/deletes sessions
 * Includes enrollment counts
 */
export function useYogaSessions() {
  const [sessions, setSessions] = useState<YogaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const channels: any[] = [];

    const loadSessions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch yoga sessions (without requiring instructor to exist).
        // `city` was added by migration 0041 — until that migration is
        // actually run, selecting it 42703s and would otherwise blank the
        // whole catalog (the catch-all below sets sessions to []), so fall
        // back to the column list without it rather than fail hard.
        let sessionsData: any[] | null = null;
        {
          const withCity = await supabase
            .from('yoga_sessions')
            .select(`
              id,
              title,
              description,
              instructor_name,
              level,
              image_url,
              starts_at,
              duration_min,
              capacity,
              price_mad,
              address,
              city,
              is_online,
              meeting_url
            `)
            .gt('starts_at', new Date().toISOString()) // Only future sessions
            .order('starts_at', { ascending: true })
            .limit(50);
          if (withCity.error?.code === '42703') {
            const withoutCity = await supabase
              .from('yoga_sessions')
              .select(`
                id, title, description, instructor_name, level, image_url,
                starts_at, duration_min, capacity, price_mad, address,
                is_online, meeting_url
              `)
              .gt('starts_at', new Date().toISOString())
              .order('starts_at', { ascending: true })
              .limit(50);
            if (withoutCity.error) throw withoutCity.error;
            sessionsData = withoutCity.data;
          } else if (withCity.error) {
            throw withCity.error;
          } else {
            sessionsData = withCity.data;
          }
        }

        if (!mounted) return;

        // Fetch enrollment counts
        const sessionIds = (sessionsData ?? []).map((s: any) => s.id);
        const { data: enrollmentCounts, error: enrollmentError } = sessionIds.length > 0
          ? await supabase
              .from('yoga_enrollments')
              .select('session_id')
              .in('session_id', sessionIds)
          : { data: [], error: null };

        if (enrollmentError) throw enrollmentError;

        if (!mounted) return;

        // Map enrollments to session IDs
        const enrollmentMap: Record<string, number> = {};
        (enrollmentCounts ?? []).forEach((e: any) => {
          enrollmentMap[e.session_id] = (enrollmentMap[e.session_id] ?? 0) + 1;
        });

        // Format sessions
        const formatted: YogaSession[] = (sessionsData ?? []).map((s: any) => {
          // Prefer the real instructor_name column; fall back to the legacy
          // "Instructeur: X" description format for older rows.
          let instructorName = (s.instructor_name as string) || 'Instructeur';
          if (!s.instructor_name && s.description && s.description.includes('Instructeur:')) {
            const parts = s.description.split('Instructeur:');
            instructorName = parts[1]?.trim() || 'Instructeur';
          }
          
          return {
            id: s.id,
            title: s.title,
            description: s.description,
            instructor: instructorName,
            level: s.level || 'Tous niveaux',
            imageUrl: s.image_url,
            startsAt: s.starts_at,
            durationMin: s.duration_min,
            capacity: s.capacity,
            priceMad: s.price_mad,
            enrolledCount: enrollmentMap[s.id] ?? 0,
            address: s.address,
            city: s.city,
            isOnline: s.is_online,
            meetingUrl: s.meeting_url,
          };
        });

        setSessions(formatted);
      } catch (err) {
        console.error('[useYogaSessions] Error loading sessions:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load sessions'));
          // Fallback: empty array or cached sessions
          setSessions([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSessions();

    // Subscribe to real-time changes
    const yogaChannel = supabase
      .channel('yoga:admin:changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'yoga_sessions' },
        () => {
          console.log('[useYogaSessions] Yoga sessions changed, reloading...');
          loadSessions();
        }
      )
      .subscribe();

    const enrollmentChannel = supabase
      .channel('yoga:enrollments:changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'yoga_enrollments' },
        () => {
          console.log('[useYogaSessions] Enrollments changed, reloading...');
          loadSessions();
        }
      )
      .subscribe();

    channels.push(yogaChannel, enrollmentChannel);

    return () => {
      mounted = false;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  return { sessions, loading, error };
}
