export interface PaymentInitiateResult {
  url: string;
  id: string;
  provider: string;
}

export interface IPaymentProvider {
  initiate(
    amount: number,
    orderId: string,
    phone: string,
  ): Promise<PaymentInitiateResult>;

  verify(transactionId: string): Promise<boolean>;
}
