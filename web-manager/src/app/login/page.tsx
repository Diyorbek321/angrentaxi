'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowRight, Car, Lock, Phone } from 'lucide-react';
import { sendOtp, verifyOtp } from '@/lib/api';
import { setUser, isAuthenticated } from '@/lib/auth';
import { sanitizeNextPath } from '@/lib/route-guard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageToggle } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import { formatPhone } from '@/lib/format';
import { t } from '@/locales';

// Sxemalar funksiya ichida: xabarlar joriy tilda (chaqirilgan paytda) olinadi.
function phoneSchema() {
  return z.object({
    phone: z.string().min(9, t().orders.login.phoneRequired),
  });
}

function otpSchema() {
  const m = t().orders.login;
  return z.object({
    code: z.string().length(6, m.codeLength).regex(/^\d+$/, m.digitsOnly),
  });
}

type PhoneForm = z.infer<ReturnType<typeof phoneSchema>>;
type OtpForm = z.infer<ReturnType<typeof otpSchema>>;

export default function LoginPage() {
  const m = t().orders.login;
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Where to land after a successful login. The middleware puts the originally
  // requested path in ?next=; `sanitizeNextPath` refuses anything that is not a
  // plain path on this origin, so the parameter cannot become an open redirect.
  // Read from `window` rather than `useSearchParams` so the page still prerenders
  // without a Suspense boundary.
  const [nextPath, setNextPath] = useState('/dispatch');

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('next');
    setNextPath(sanitizeNextPath(param));
  }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dispatch');
    }
  }, [router]);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema()),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema()),
    defaultValues: { code: '' },
  });

  const handleSendOtp = async (data: PhoneForm) => {
    setAuthError(null);
    try {
      const normalized = data.phone.startsWith('+') ? data.phone : `+998${data.phone.replace(/\D/g, '').slice(-9)}`;
      const res = await sendOtp(normalized);
      setPhone(normalized);
      setStep('otp');
      if (res.code) {
        setDevOtpCode(res.code);
        otpForm.setValue('code', res.code);
      }
    } catch {
      setAuthError(m.sendFailed);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setAuthError(null);
    try {
      // The tokens are set as httpOnly cookies inside /api/auth/login and never
      // reach this code; the role check now lives there too, where it cannot be
      // stepped around by calling the backend directly.
      const result = await verifyOtp(phone, data.code);
      setUser(result.user);
      router.replace(nextPath);
    } catch (err) {
      setAuthError(
        err instanceof Error && err.message
          ? err.message
          : m.invalidCode
      );
    }
  };

  const stepIndex = step === 'phone' ? 1 : 2;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <main className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-ds-sm bg-primary text-white dark:bg-primary-on-dark"
          >
            <Car size={20} />
          </span>
          <div>
            <p className="text-title text-ink">Angren Taxi</p>
            <p className="text-[13px] text-muted">{m.panelName}</p>
          </div>
        </div>

        <div className="rounded-ds-md border border-line bg-surface p-6 shadow-card">
          {/* Step indicator — meaning in words too, not colour alone. */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-1 flex-1 rounded-full bg-primary dark:bg-primary-on-dark" />
              <span
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  step === 'otp' ? 'bg-primary dark:bg-primary-on-dark' : 'bg-surface-3'
                )}
              />
            </div>
            <p className="num mt-2 text-xs text-subtle">{m.step(stepIndex)}</p>
          </div>

          <div className="mb-5">
            <h1 className="text-h2 text-ink">{step === 'phone' ? m.titlePhone : m.titleOtp}</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {step === 'phone'
                ? m.hintPhone
                : m.hintOtp(formatPhone(phone))}
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2 text-[13px] text-danger-dark dark:text-danger-light"
            >
              <AlertCircle size={15} className="mt-px shrink-0" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4" noValidate>
              <Input
                label={m.phoneLabel}
                type="tel"
                autoComplete="tel"
                autoFocus
                placeholder="+998901234568"
                className="num"
                leftIcon={<Phone aria-hidden="true" />}
                {...phoneForm.register('phone')}
                error={phoneForm.formState.errors.phone?.message}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={phoneForm.formState.isSubmitting}
                className="w-full"
                rightIcon={<ArrowRight size={15} aria-hidden="true" />}
              >
                {m.sendCode}
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4" noValidate>
              <Input
                label={m.titleOtp}
                type="text"
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                mono
                leftIcon={<Lock aria-hidden="true" />}
                {...otpForm.register('code')}
                error={otpForm.formState.errors.code?.message}
              />
              {/* Dev-only helper note — informational blue; amber stays
                  reserved for manual override alone. */}
              {devOtpCode && (
                <div className="rounded-ds-sm border border-info/30 bg-info-tint px-3 py-2 text-[13px] text-info-dark dark:text-info-light">
                  <span className="font-semibold">TEST:</span> {m.devOtp}{' '}
                  <span className="font-mono font-semibold">{devOtpCode}</span> {m.devOtpAuto}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={otpForm.formState.isSubmitting}
                className="w-full"
                rightIcon={<ArrowRight size={15} aria-hidden="true" />}
              >
                {m.submit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('phone');
                  setDevOtpCode('');
                  setAuthError(null);
                }}
              >
                {m.changePhone}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Angren Taxi · {m.panelName}</p>
      </main>
    </div>
  );
}
