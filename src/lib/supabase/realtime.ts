import { createClient } from '@supabase/supabase-js';

export function subscribeToEventChanges(eventId: string, callback: (payload: any) => void) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey || supabaseUrl.includes('placeholder')) {
    // If Supabase credentials are placeholder, use a lightweight 2-second fallback poll
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/event/status');
        if (res.ok) {
          const data = await res.json();
          callback({ new: data });
        }
      } catch {
        // Silent poll error
      }
    }, 2000);

    return {
      unsubscribe: () => clearInterval(interval),
    };
  }

  const supabase = createClient(supabaseUrl, anonKey);

  const channel = supabase
    .channel(`event-changes-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
        filter: `id=eq.${eventId}`,
      },
      callback
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
