'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Car, Phone, Lock, ArrowRight } from 'lucide-react';
import { sendOtp, verifyOtp } from '@/lib/api';
import { setAuthToken, setUser, isAuthenticated } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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
      setAuthError('Noto\'g\'ri kod. Qaytadan urinib ko\'ring.');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#080D1A] flex items-center justify-center p-4 overflow-hidden">
      {/* Yellow orb glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="relative w-full max-w-sm z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[#FACC15] flex items-center justify-center mb-4 shadow-glow-yellow">
            <Car size={28} className="text-[#080D1A]" />
          </div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Angren Taxi</h1>
          <p className="text-[#94A3B8] text-sm mt-1">Dispetcher paneli</p>
        </div>

        <div className="glass-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-[#F1F5F9] mb-1">
            {step === 'phone' ? 'Kirish' : 'Tasdiqlash kodi'}
          </h2>
          <p className="text-[#94A3B8] text-sm mb-6">
            {step === 'phone'
              ? 'Telefon raqamingizni kiriting'
              : `${phone} raqamiga yuborilgan kodni kiriting`}
          </p>

          {authError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
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
                leftElement={<Phone size={15} className="text-[#94A3B8]" />}
                {...phoneForm.register('phone')}
                error={phoneForm.formState.errors.phone?.message}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={phoneForm.formState.isSubmitting}
                className="w-full mt-2"
              >
                Kod yuborish
                <ArrowRight size={16} className="ml-2" />
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
                leftElement={<Lock size={15} className="text-[#94A3B8]" />}
                {...otpForm.register('code')}
                error={otpForm.formState.errors.code?.message}
              />
              {devOtpCode && (
                <div className="rounded-lg border border-[#FACC15]/30 bg-[#FACC15]/10 px-3 py-2 text-sm text-[#FACC15]">
                  <span className="font-semibold">DEV:</span> OTP kod —{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span> (avtomatik kiritildi)
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={otpForm.formState.isSubmitting}
                className="w-full mt-2"
              >
                Kirish
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <button
                type="button"
                onClick={() => { setStep('phone'); setDevOtpCode(''); setAuthError(null); }}
                className="w-full text-center text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
              >
                Raqamni o&apos;zgartirish
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[#94A3B8]/50 text-xs mt-6">
          Angren Taxi Dispetcher paneli v0.1.0
        </p>
      </div>
    </div>
  );
}
