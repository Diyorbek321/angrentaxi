'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Lock, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { authApi } from '@/lib/api';
import { isValidUzPhone, formatPhone } from '@/lib/auth';
import { errorMessage } from '@/lib/utils';
import { sanitizeNextPath } from '@/lib/route-guard';
import { useAuth } from '@/hooks/useAuth';

const phoneSchema = z.object({
  phone: z
    .string()
    .min(9, 'Telefon raqamini kiriting')
    .refine((v) => isValidUzPhone(v), "Noto'g'ri telefon raqam (+998XXXXXXXXX)"),
});

const otpSchema = z.object({
  code: z.string().length(6, '6 raqamli kod kiriting').regex(/^\d+$/, 'Faqat raqamlar'),
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
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema), defaultValues: { code: '' } });

  const handleSendOtp = async (data: PhoneForm) => {
    setIsLoading(true);
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
      toast({
        title: 'Xatolik',
        description: errorMessage(err, 'Kod yuborishda xatolik yuz berdi'),
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setIsLoading(true);
    try {
      // The token pair is set as httpOnly cookies inside /api/auth/login, which
      // is also where the role gate now lives — the cookie is never written for
      // the wrong kind of account. Only the profile comes back here.
      const user = await authApi.verifyOtp(phone, data.code);
      login(user);
      toast({ title: 'Muvaffaqiyatli kirildi', variant: 'success' });
      router.push(nextPath);
    } catch (err: unknown) {
      toast({
        title: 'Xatolik',
        description: errorMessage(err, "Noto'g'ri kod"),
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
      {/* Decorative only — mint may fill a surface, but never carry meaning. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-mint/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-info/10 blur-3xl"
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-ds-md bg-gradient-cta shadow-cta">
            <ShoppingBag className="h-7 w-7 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-h1 text-ink">Angren Market</h1>
            <p className="text-body text-primary-text font-semibold">Sotuvchi paneli</p>
          </div>
        </div>

        <div className="surface-card p-6 sm:p-8">
          {/* Two-step progress. `aria-valuenow` states the step for screen
              readers, since the filled bar alone says nothing. */}
          <div
            className="mb-6 flex items-center gap-2"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={2}
            aria-valuenow={step === 'phone' ? 1 : 2}
            aria-label="Kirish bosqichi"
          >
            <div className="h-1.5 flex-1 rounded-full bg-primary" />
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors duration-fast ${
                step === 'otp' ? 'bg-primary' : 'bg-surface-3'
              }`}
            />
          </div>

          <div className="mb-6">
            <h2 className="text-h2 text-ink">
              {step === 'phone' ? 'Sotuvchi paneliga kirish' : 'Tasdiqlash kodi'}
            </h2>
            <p className="mt-1.5 text-body text-muted">
              {step === 'phone'
                ? 'Telefon raqamingizni kiriting'
                : `${phone} raqamiga yuborilgan 6 raqamli kodni kiriting`}
            </p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
              <Input
                label="Telefon raqam"
                placeholder="+998901234567"
                autoComplete="tel"
                inputMode="tel"
                mono
                leftElement={<Phone className="h-4 w-4" aria-hidden />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
              >
                Kod yuborish
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              <Input
                label="Tasdiqlash kodi"
                placeholder="000000"
                maxLength={6}
                mono
                autoComplete="one-time-code"
                leftElement={<Lock className="h-4 w-4" aria-hidden />}
                error={otpForm.formState.errors.code?.message}
                inputMode="numeric"
                {...otpForm.register('code')}
              />
              {devOtpCode && (
                <div className="rounded-ds-sm border border-info/40 bg-info-tint px-3 py-2 text-body text-ink">
                  <span className="font-semibold">DEV:</span> OTP kod —{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span>{' '}
                  <span className="text-muted">(avtomatik kiritildi)</span>
                </div>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
              >
                Kirish
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep('phone')}
              >
                Raqamni o&apos;zgartirish
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
