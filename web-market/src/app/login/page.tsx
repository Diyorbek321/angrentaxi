'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Lock, ArrowRight, ShoppingBag } from 'lucide-react';
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
      // The token pair is set as httpOnly cookies inside /api/auth/login, which
      // is also where the role gate now lives — the cookie is never written for
      // the wrong kind of account. Only the profile comes back here.
      const user = await authApi.verifyOtp(phone, data.code);
      login(user);
      toast({ title: 'Muvaffaqiyatli kirildi', variant: 'success' });
      router.push(nextPath);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error && err.message ? err.message : null) ||
        "Noto'g'ri kod";
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#080D1A] overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400"
            style={{ boxShadow: '0 0 32px rgba(250,204,21,0.4)' }}
          >
            <ShoppingBag className="h-7 w-7 text-[#080D1A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Angren Market</h1>
            <p className="text-sm text-yellow-400">Sotuvchi paneli</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(13,21,38,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          }}
        >
          <div className="mb-6 flex items-center gap-2">
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 'phone' || step === 'otp' ? 'bg-yellow-400' : 'bg-white/10'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 'otp' ? 'bg-yellow-400' : 'bg-white/10'}`} />
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">
              {step === 'phone' ? 'Sotuvchi paneliga kirish' : 'Tasdiqlash kodi'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
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
                leftIcon={<Phone className="h-4 w-4" />}
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Kod yuborish
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              <Input
                label="Tasdiqlash kodi"
                placeholder="000000"
                maxLength={6}
                leftIcon={<Lock className="h-4 w-4" />}
                error={otpForm.formState.errors.code?.message}
                inputMode="numeric"
                {...otpForm.register('code')}
              />
              {devOtpCode && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', color: '#FACC15' }}
                >
                  <span className="font-semibold">DEV:</span> OTP kod —{' '}
                  <span className="font-mono font-bold">{devOtpCode}</span>{' '}
                  <span className="text-yellow-400/60">(avtomatik kiritildi)</span>
                </div>
              )}
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Kirish
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
                onClick={() => setStep('phone')}
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
