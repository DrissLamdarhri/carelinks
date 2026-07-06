import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface ServiceType {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export const useServiceTypes = (category?: string) => {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServiceTypes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let query = supabase.from('service_types').select('*');
        
        if (category) {
          query = query.eq('category', category);
        }
        
        const { data, error: err } = await query.order('name', { ascending: true });
        
        if (err) {
          console.error('[ServiceTypes] Error fetching:', err);
          setError(err.message);
          return;
        }
        
        setServiceTypes(data || []);
      } catch (err) {
        console.error('[ServiceTypes] Exception:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchServiceTypes();
  }, [category]);

  return { serviceTypes, loading, error };
};
