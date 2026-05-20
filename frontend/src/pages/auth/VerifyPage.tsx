import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export function VerifyPage() {
  const { verify, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = (location.state as any)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!resendCooldown) return;
    const id = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      await resendCode(email.trim().toLowerCase());
      setResendCooldown(30);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to resend code');
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Verification Code</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={code}
          onChange={(e) => {
            const next = e.target.value.replace(/\\D/g, '').slice(0, 6);
            setCode(next);
          }}
          placeholder="6-digit code"
          required
          maxLength={6}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onResend}
          disabled={resendCooldown > 0}
          className="text-indigo-600 hover:underline disabled:opacity-60"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </button>
        <Link className="text-indigo-600 hover:underline" to="/auth/login" state={{ email }}>
          Back to login
        </Link>
      </div>
    </form>
  );
}
