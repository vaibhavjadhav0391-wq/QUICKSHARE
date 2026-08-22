import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isMobileDevice } from '@/utils/deviceDetect';

/**
 * JoinPage — handles the /join/:token route.
 *
 * When a user scans the QR code or opens the join link:
 *   - On mobile → navigate to /mobile with the token in state
 *   - On desktop → navigate to /pc (they should be the one displaying QR)
 *
 * The MobilePage reads the token from route state or URL param
 * and auto-joins the session.
 */
export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    if (isMobileDevice()) {
      // Pass token via navigation state so MobilePage can read it
      navigate('/mobile', { state: { joinToken: token }, replace: true });
    } else {
      // Desktop opened the join link — redirect to PC page
      navigate('/pc', { replace: true });
    }
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Connecting...</p>
      </div>
    </div>
  );
}
