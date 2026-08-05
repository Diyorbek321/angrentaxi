'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Lock, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { authApi } from '@/lib/api';
import { isValidUzPhone, formatPhone } from '@/lib/auth';
import { sanitizeNextPath } from '@/lib/route-guard';
import { useAuth } from '@/hooks/useAuth';

const phoneSchema = z.object({
  phone: z
    .string()
    .min(9, 'Telefon raqamini kiriting')
    .refine((v) => isValidUzPhone(v), 'Noto\'g\'ri telefon raqam (+998XXXXXXXXX)'),
});

const otpSchema = z.object({
  code: z
    .string()
    .length(6, '6 raqamli kod kiriting')
    .regex(/^\d+$/, 'Faqat raqamlar'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Where to land after a successful login. The middleware puts the originally
  // requested path in ?next=; `sanitizeNextPath` refuses anything that is not a
  // plain path on this origin, so the parameter cannot become an open redirect.
  // Read from `window` rather than `useSearchParams` so the page still prerenders
  // without a Suspense boundary.
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('next');
    setNextPath(sanitizeNextPath(param));
  }, []);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const handleSendOtp = async (data: PhoneForm) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const normalized = formatPhone(data.phone);
      const res = await authApi.sendOtp(normalized);
      setPhone(normalized);
      setStep('otp');
      const code = res.data.data.code;
      if (code) {
        setDevOtpCode(code);
        otpForm.setValue('code', code);
      }
      toast({
        title: 'Kod yuborildi',
        description: code ? `[DEV] Kod: ${code}` : `${normalized} raqamiga SMS kod yuborildi`,
        variant: 'success',
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Kod yuborishda xatolik yuz berdi';
      setAuthError(message);
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      // The token pair is set as httpOnly cookies inside /api/auth/login and
      // never reaches this code — only the profile comes back.
      const user = await authApi.verifyOtp(phone, data.code);
      login(user);
      toast({ title: 'Muvaffaqiyatli kirildi', variant: 'success' });
      router.push(nextPath);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error && err.message ? err.message : null) ||
        'Noto\'g\'ri kod';
      setAuthError(message);
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
      {/* Decorative background orbs — brend rangi, dekorativ (aria-hidden). */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-[80px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-info/10 blur-[100px]"
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative w-full max-w-md">
        {/* Logo section */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-ds-md bg-gradient-cta shadow-cta">
            <Shield className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-h1 text-ink">Angren Taxi</h1>
            <p className="text-body text-primary-text">Admin Panel</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-ds-lg border border-line bg-surface p-8 shadow-pop">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2" aria-hidden="true">
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === 'phone' || step === 'otp' ? 'bg-primary' : 'bg-surface-2'
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === 'otp' ? 'bg-primary' : 'bg-surface-2'
              }`}
            />
          </div>

          <div className="mb-6">
            <h2 className="text-h2 text-ink">
              {step === 'phone' ? 'Admin paneliga kirish' : 'Tasdiqlash kodi'}
            </h2>
            <p className="mt-1.5 text-body text-muted">
              {step === 'phone'
                ? 'Telefon raqamingizni kiriting'
                : `${phone} raqamiga yuborilgan 6 raqamli kodni kiriting`}
            </p>
          </div>

          {authError && (
            <p
              role="alert"
              className="mb-4 rounded-ds-md border border-danger/30 bg-danger-tint px-3 py-2.5 text-body text-danger-deep dark:text-danger-light"
            >
              {authError}
            </p>
          )}

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4" noValidate>
              <Input
                label="Telefon raqam"
                type="tel"
                autoComplete="tel"
                placeholder="+998901234567"
                mono
                leftIcon={<Phone className="h-4 w-4" />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Kod yuborish
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4" noValidate>
              <Input
                label="Tasdiqlash kodi"
                type="text"
                placeholder="000000"
                maxLength={6}
                mono
                leftIcon={<Lock className="h-4 w-4" />}
                error={otpForm.formState.errors.code?.message}
                inputMode="numeric"
                {...otpForm.register('code')}
              />
              {devOtpCode && (
                <div className="rounded-ds-md border border-override/40 bg-override-tint px-3 py-2 text-body text-override-dark dark:text-override-light">
                  <span className="font-semibold">DEV:</span> OTP kod —{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span>{' '}
                  <span className="text-subtle">(avtomatik kiritildi)</span>
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Kirish
              </Button>
              <button
                type="button"
                className="w-full rounded-ds-xs text-center text-body text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                onClick={() => {
                  setStep('phone');
                  setDevOtpCode('');
                  setAuthError(null);
                }}
              >
                Raqamni o&apos;zgartirish
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
