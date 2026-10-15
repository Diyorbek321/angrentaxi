'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowRight, Lock, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/components/ui/cn';
import { formatPhone as formatPhoneDisplay } from '@/lib/format';
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

  const stepIndex = step === 'phone' ? 1 : 2;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <main className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-ds-sm bg-primary text-base font-bold text-white dark:bg-primary-on-dark"
          >
            A
          </span>
          <div>
            <p className="text-title text-ink">Angren Taxi</p>
            <p className="text-[13px] text-muted">Super Admin paneli</p>
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
            <p className="num mt-2 text-xs text-subtle">{stepIndex}-qadam / 2</p>
          </div>

          <div className="mb-5">
            <h1 className="text-h2 text-ink">{step === 'phone' ? 'Panelga kirish' : 'Tasdiqlash kodi'}</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {step === 'phone'
                ? 'Telefon raqamingizni kiriting — SMS orqali bir martalik kod yuboramiz.'
                : `${formatPhoneDisplay(phone)} raqamiga yuborilgan 6 raqamli kodni kiriting.`}
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
                label="Telefon raqam"
                type="tel"
                autoComplete="tel"
                autoFocus
                placeholder="+998901234567"
                className="num"
                leftIcon={<Phone aria-hidden="true" />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={15} aria-hidden="true" />}
              >
                {isLoading ? 'Kod yuborilmoqda…' : 'Kod yuborish'}
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4" noValidate>
              <Input
                label="Tasdiqlash kodi"
                type="text"
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                mono
                leftIcon={<Lock aria-hidden="true" />}
                error={otpForm.formState.errors.code?.message}
                inputMode="numeric"
                {...otpForm.register('code')}
              />
              {/* Dev-only helper — informational blue; amber stays reserved
                  for manual overrides. */}
              {devOtpCode && (
                <div className="rounded-ds-sm border border-info/30 bg-info-tint px-3 py-2 text-[13px] text-info-dark dark:text-info-light">
                  <span className="font-semibold">TEST:</span> OTP kod —{' '}
                  <span className="font-mono font-semibold">{devOtpCode}</span> (avtomatik kiritildi)
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={15} aria-hidden="true" />}
              >
                {isLoading ? 'Tekshirilmoqda…' : 'Kirish'}
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
                Raqamni oʻzgartirish
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Angren Taxi · Super Admin</p>
      </main>
    </div>
  );
}
