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
import { formatPhone as displayPhone } from '@/lib/format';
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
    <div className="relative flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-ds-sm bg-primary text-white dark:bg-primary-on-dark dark:text-ink">
            <UtensilsCrossed size={20} aria-hidden />
          </div>
          <h1 className="text-h1 text-ink">Angren Taxi</h1>
          <p className="mt-0.5 text-[13px] text-muted">Restoran paneli</p>
        </div>

        <div className="rounded-ds-md border border-line bg-surface p-6 shadow-card">
          <div className="mb-5">
            <p className="text-xs text-subtle">{step === 'phone' ? '1-bosqich / 2' : '2-bosqich / 2'}</p>
            <h2 className="mt-1 text-h3 text-ink">{step === 'phone' ? 'Panelga kirish' : 'Tasdiqlash kodi'}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {step === 'phone'
                ? 'Telefon raqamingizni kiriting'
                : `${displayPhone(phone)} raqamiga yuborilgan 6 raqamli kodni kiriting`}
            </p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="flex flex-col gap-4" noValidate>
              <Input
                label="Telefon raqam"
                placeholder="+998901234567"
                autoComplete="tel"
                inputMode="tel"
                className="num"
                leftElement={<Phone size={15} />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button type="submit" size="lg" fullWidth isLoading={isLoading} rightIcon={<ArrowRight size={15} />}>
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
                leftElement={<Lock size={15} />}
                error={otpForm.formState.errors.code?.message}
                {...otpForm.register('code')}
              />
              {devOtpCode && (
                <p className="rounded-ds-sm border border-info/30 bg-info-tint px-3 py-2 text-[13px] text-info-dark dark:text-info-light">
                  <span className="font-semibold">TEST:</span> OTP kod —{' '}
                  <span className="font-mono font-semibold">{devOtpCode}</span> (avtomatik kiritildi)
                </p>
              )}
              <Button type="submit" size="lg" fullWidth isLoading={isLoading} rightIcon={<ArrowRight size={15} />}>
                Kirish
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => setStep('phone')}>
                Raqamni oʻzgartirish
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Faqat restoran hisoblari uchun</p>
      </div>
    </div>
  );
}
