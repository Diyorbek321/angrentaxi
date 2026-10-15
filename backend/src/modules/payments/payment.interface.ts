export interface PaymentInitiateResult {
  url: string;
  id: string;
  provider: string;
}

/** Checkout'ning ixtiyoriy sozlamalari. */
export interface PaymentInitiateOptions {
  /**
   * To'lovdan keyin foydalanuvchi qaytadigan manzil (ilova deep link yoki
   * https sahifa). Payme — `c`, Click/UZPS — `return_url`.
   */
  returnUrl?: string;
}

export interface IPaymentProvider {
  initiate(
    amount: number,
    orderId: string,
    phone: string,
    options?: PaymentInitiateOptions,
  ): Promise<PaymentInitiateResult>;

  verify(transactionId: string): Promise<boolean>;
}
