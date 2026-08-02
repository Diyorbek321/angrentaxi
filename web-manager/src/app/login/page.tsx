'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Car, Lock, Phone } from 'lucide-react';
import { sendOtp, verifyOtp } from '@/lib/api';
import { setAuthToken, setUser, isAuthenticated } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const phoneSchema = z.object({
  phone: z.string().min(9, 'Telefon raqamini kiriting'),
});

const otpSchema = z.object({
  code: z.string().length(6, '6 raqamli kod kiriting').regex(/^\d+$/, 'Faqat raqamlar'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dispatch');
    }
  }, [router]);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
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
      setAuthError('Kod yuborishda xatolik. Raqamni tekshiring.');
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setAuthError(null);
    try {
      const result = await verifyOtp(phone, data.code);
      if (result.user.role !== 'manager' && result.user.role !== 'admin') {
        setAuthError('Bu panel faqat menejerlar uchun.');
        return;
      }
      setAuthToken(result.token);
      setUser(result.user);
      router.replace('/dispatch');
    } catch {
      setAuthError('Notoʻgʻri kod. Qaytadan urinib koʻring.');
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Mint glow, subtle in both themes */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -left-24 w-80 h-80 bg-primary/[0.07] blur-[120px] rounded-full pointer-events-none" />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-glow-mint">
            <Car size={28} className="text-[#04231A]" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Angren Taxi</h1>
          <p className="text-muted text-sm mt-1">Dispetcher paneli</p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-ink mb-1">
            {step === 'phone' ? 'Kirish' : 'Tasdiqlash kodi'}
          </h2>
          <p className="text-muted text-sm mb-6">
            {step === 'phone'
              ? 'Telefon raqamingizni kiriting'
              : `${phone} raqamiga yuborilgan kodni kiriting`}
          </p>

          {authError && (
            <div className="mb-4 bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
              {authError}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4" noValidate>
              <Input
                label="Telefon raqam"
                type="tel"
                placeholder="+998901234568"
                autoComplete="tel"
                mono
                leftElement={<Phone size={15} />}
                {...phoneForm.register('phone')}
                error={phoneForm.formState.errors.phone?.message}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={phoneForm.formState.isSubmitting}
                className="w-full mt-2"
                rightIcon={<ArrowRight size={16} />}
              >
                Kod yuborish
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4" noValidate>
              <Input
                label="Tasdiqlash kodi"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                mono
                leftElement={<Lock size={15} />}
                {...otpForm.register('code')}
                error={otpForm.formState.errors.code?.message}
              />
              {devOtpCode && (
                <div className="rounded-lg border border-override/40 bg-override/[0.08] px-3 py-2 text-sm text-override-dark dark:text-override-light">
                  <span className="font-semibold">TEST:</span> OTP kod —{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span> (avtomatik kiritildi)
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={otpForm.formState.isSubmitting}
                className="w-full mt-2"
                rightIcon={<ArrowRight size={16} />}
              >
                Kirish
              </Button>
              <button
                type="button"
                onClick={() => { setStep('phone'); setDevOtpCode(''); setAuthError(null); }}
                className="w-full text-center text-sm text-muted hover:text-ink transition-colors"
              >
                Raqamni oʻzgartirish
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-subtle text-xs mt-6">
          Angren Taxi Dispetcher paneli v0.1.0
        </p>
      </div>
    </div>
  );
}
