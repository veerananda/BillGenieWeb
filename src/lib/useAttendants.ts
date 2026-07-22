import { useEffect, useMemo, useState } from 'react';
import { apiClient, type Attendant } from '../services/api';

export function useAttendants() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = useMemo(() => localStorage.getItem('user_id') ?? '', []);
  const currentUserName = useMemo(() => localStorage.getItem('user_name') ?? '', []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .listAttendants()
      .then((list) => {
        if (!cancelled) setAttendants(list);
      })
      .catch(() => {
        if (!cancelled) setAttendants([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultAttendantId = useMemo(() => {
    if (currentUserId && attendants.some((a) => a.id === currentUserId)) {
      return currentUserId;
    }
    return attendants[0]?.id ?? currentUserId;
  }, [attendants, currentUserId]);

  const resolveAttendantName = (userId: string) =>
    attendants.find((a) => a.id === userId)?.name ?? currentUserName;

  return {
    attendants,
    loading,
    currentUserId,
    currentUserName,
    defaultAttendantId,
    resolveAttendantName,
  };
}
