'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Lock, Phone, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { authApi } from '@/lib/api';
import { isValidUzPhone, formatPhone } from '@/lib/auth';
import { errorMessage } from '@/hooks/useAsyncData';
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

  // Muvaffaqiyatli kirishdan keyingi manzil. Middleware asl yo'lni ?next= ga
  // qo'yadi; `sanitizeNextPath` shu origin'dagi oddiy yo'ldan boshqasini rad
  // etadi, ya'ni parametr ochiq redirectga aylana olmaydi. `useSearchParams`
  // o'rniga `window` — shunda sahifa Suspense chegarasisiz ham prerender bo'ladi.
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('next');
    setNextPath(sanitizeNextPath(param));
  }, []);

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } });
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
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setIsLoading(true);
    try {
      // Token juftligi /api/auth/login ichida httpOnly cookie qilib yoziladi,
      // rol tekshiruvi ham o'sha yerda. Bu yerga faqat profil qaytadi.
      const user = await authApi.verifyOtp(phone, data.code);
      login(user);
      toast({ title: 'Muvaffaqiyatli kirildi', variant: 'success' });
      router.push(nextPath);
    } catch (err: unknown) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Dekorativ mint halo — ma'no tashimaydi, shuning uchun mint bo'lishi mumkin. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-mint/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {/* Interaktiv emas, lekin brend belgisi — gradient-mint ustida ink matn. */}
          <div className="flex h-16 w-16 items-center justify-center rounded-ds-md bg-gradient-mint shadow-card">
            <UtensilsCrossed className="h-8 w-8 text-ink" aria-hidden />
          </div>
          <div>
            <h1 className="text-h1 text-ink">Angren Taxi</h1>
            <p className="text-body font-semibold text-primary-text">Restoran paneli</p>
          </div>
        </div>

        <div className="surface-card p-6 sm:p-8">
          {/* Bosqich indikatori: rangdan tashqari matn bilan ham beriladi. */}
          <div className="mb-6">
            <div className="flex items-center gap-2" aria-hidden>
              <span className="h-1.5 flex-1 rounded-full bg-primary" />
              <span
                className={`h-1.5 flex-1 rounded-full transition-colors duration-fast ${
                  step === 'otp' ? 'bg-primary' : 'bg-surface-3'
                }`}
              />
            </div>
            <p className="mt-2 text-caption font-semibold text-muted">
              {step === 'phone' ? '1-bosqich / 2' : '2-bosqich / 2'}
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-h2 text-ink">
              {step === 'phone' ? 'Panelga kirish' : 'Tasdiqlash kodi'}
            </h2>
            <p className="mt-1.5 text-body text-muted">
              {step === 'phone'
                ? 'Telefon raqamingizni kiriting'
                : `${phone} raqamiga yuborilgan 6 raqamli kodni kiriting`}
            </p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="flex flex-col gap-4" noValidate>
              <Input
                label="Telefon raqam"
                placeholder="+998901234567"
                autoComplete="tel"
                inputMode="tel"
                mono
                leftElement={<Phone className="h-4 w-4" />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button type="submit" size="lg" fullWidth isLoading={isLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                Kod yuborish
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="flex flex-col gap-4" noValidate>
              <Input
                label="Tasdiqlash kodi"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                mono
                leftElement={<Lock className="h-4 w-4" />}
                error={otpForm.formState.errors.code?.message}
                {...otpForm.register('code')}
              />
              {devOtpCode && (
                <p className="rounded-ds-sm border border-info/40 bg-info-tint px-3.5 py-2.5 text-caption text-info-deep dark:text-info-light">
                  <span className="font-bold">DEV:</span> OTP kod —{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span> (avtomatik kiritildi)
                </p>
              )}
              <Button type="submit" size="lg" fullWidth isLoading={isLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                Kirish
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep('phone')}>
                Raqamni o&apos;zgartirish
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
