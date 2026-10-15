'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Lock, ArrowRight } from 'lucide-react';
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
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-ds-sm bg-primary text-base font-semibold text-white dark:bg-primary-on-dark"
          >
            A
          </span>
          <h1 className="text-xl font-semibold text-ink">Angren Market</h1>
          <p className="mt-0.5 text-[13px] text-muted">Sotuvchi paneli</p>
        </div>

        <div className="rounded-ds-md border border-line bg-surface p-6 shadow-card">
          <div className="mb-5">
            <p className="num text-xs text-subtle" aria-live="polite">
              {step === 'phone' ? '1-qadam / 2' : '2-qadam / 2'}
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">
              {step === 'phone' ? 'Kirish' : 'Tasdiqlash kodi'}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {step === 'phone'
                ? 'Telefon raqamingizni kiriting — SMS kod yuboramiz'
                : `${phone} raqamiga yuborilgan 6 raqamli kodni kiriting`}
            </p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4" noValidate>
              <Input
                label="Telefon raqam"
                placeholder="+998901234567"
                autoComplete="tel"
                inputMode="tel"
                className="num"
                leftElement={<Phone size={15} aria-hidden />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={16} aria-hidden />}
              >
                Kod yuborish
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4" noValidate>
              <Input
                label="Tasdiqlash kodi"
                placeholder="000000"
                maxLength={6}
                mono
                autoComplete="one-time-code"
                leftElement={<Lock size={15} aria-hidden />}
                error={otpForm.formState.errors.code?.message}
                inputMode="numeric"
                {...otpForm.register('code')}
              />
              {devOtpCode && (
                <div className="rounded-ds-sm border border-info/30 bg-info-tint px-3 py-2 text-[13px] text-info-dark dark:text-info-light">
                  <span className="font-semibold">TEST:</span> OTP kod —{' '}
                  <span className="font-mono font-semibold">{devOtpCode}</span> (avtomatik kiritildi)
                </div>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={16} aria-hidden />}
              >
                Kirish
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('phone')}>
                Raqamni o&apos;zgartirish
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Angren Market · Sotuvchi paneli</p>
      </div>
    </div>
  );
}
