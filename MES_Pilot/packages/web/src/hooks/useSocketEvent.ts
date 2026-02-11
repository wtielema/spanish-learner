import { useEffect } from 'react';
import { getSocket } from '../api/socket';

export function useSocketEvent<T>(event: string, callback: (data: T) => void) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, callback);
    return () => {
      s.off(event, callback);
    };
  }, [event, callback]);
}
