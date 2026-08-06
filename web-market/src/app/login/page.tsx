'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Lock, Package, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { authApi } from '@/lib/api';
// `formatPhone` here normalises input for the API — not the display formatter
// of the same name in lib/format.ts.
import { isValidUzPhone, formatPhone as normalizePhone } from '@/lib/auth';
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
    try {
      const normalized = normalizePhone(data.phone);
      const res = await authApi.sendOtp(normalized);
      setPhone(normalized);
      setStep('otp');

      // In dev the backend returns the code, and the form is pre-filled with
      // it. This behaviour is deliberate — keep it.
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
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setIsLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, data.code);
      const { accessToken, user } = res.data.data;

      // This panel is vendors-only; every other role is turned away here.
      if (user.role !== 'market') {
        toast({
          title: 'Ruxsat yo‘q',
          description: 'Bu panel faqat sotuvchilar uchun',
          variant: 'error',
        });
        return;
      }

      login(accessToken, user);
      toast({ title: 'Muvaffaqiyatli kirildi', variant: 'success' });
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Noto'g'ri kod";
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-bg p-4">
      {/* Soft mint wash behind the card — the only decoration on this screen. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/[0.07] blur-3xl" />
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-glow-mint">
            <Package className="h-7 w-7 text-primary-ink" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Angren Market</h1>
            <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
              Sotuvchi paneli
            </p>
          </div>
        </div>

        <div className="surface-card p-7">
          {/* Two steps, two segments. */}
          <div className="mb-6 flex items-center gap-2" aria-hidden>
            <span className="h-1.5 flex-1 rounded-full bg-primary" />
            <span
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                step === 'otp' ? 'bg-primary' : 'bg-surface-3'
              )}
            />
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-bold text-ink">
              {step === 'phone' ? 'Panelga kirish' : 'Tasdiqlash kodi'}
            </h2>
            <p className="mt-1 text-sm text-muted">
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
                leftIcon={<Phone size={15} />}
                error={phoneForm.formState.errors.phone?.message}
                mono
                autoFocus
                {...phoneForm.register('phone')}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={16} />}
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
                inputMode="numeric"
                leftIcon={<Lock size={15} />}
                error={otpForm.formState.errors.code?.message}
                mono
                autoFocus
                {...otpForm.register('code')}
              />

              {devOtpCode && (
                <p className="rounded-lg border border-primary/30 bg-primary/[0.08] px-3 py-2 text-xs text-primary-700 dark:text-primary-300">
                  <span className="font-semibold">DEV:</span> kod{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span> — avtomatik kiritildi
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={16} />}
              >
                Kirish
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep('phone')}
                leftIcon={<ArrowLeft size={15} />}
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
