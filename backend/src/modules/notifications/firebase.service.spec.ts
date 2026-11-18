import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import { FirebaseService } from "./firebase.service";

const send = jest.fn().mockResolvedValue("msg-1");

jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(() => ({ name: "test" })),
  credential: { cert: jest.fn(() => ({})) },
  messaging: jest.fn(() => ({ send })),
}));

describe("FirebaseService.sendDataPush", () => {
  let service: FirebaseService;

  beforeEach(() => {
    send.mockClear();
    const config = {
      get: (key: string) =>
        ({
          FIREBASE_PROJECT_ID: "p",
          FIREBASE_CLIENT_EMAIL: "e@example.com",
          FIREBASE_PRIVATE_KEY: "k",
        })[key],
    } as unknown as ConfigService;
    service = new FirebaseService(config);
    service.onModuleInit();
  });

  const lastMessage = (): admin.messaging.Message => send.mock.calls[0][0];

  it("Android: notification bloki yo'q (data-only), matn data ichida, yuqori muhimlik", async () => {
    await service.sendDataPush("tok", "Yangi zakaz", "Amir Temur 1", {
      event: "new_order_offer",
    });

    const message = lastMessage();
    expect(message).not.toHaveProperty("notification");
    expect(message.android?.notification).toBeUndefined();
    expect(message.android?.priority).toBe("high");
    expect(message.data).toEqual({
      event: "new_order_offer",
      title: "Yangi zakaz",
      body: "Amir Temur 1",
    });
  });

  it("iOS: data-only ko'rinmaydi — APNs alert saqlanadi", async () => {
    await service.sendDataPush("tok", "Yangi zakaz", "Amir Temur 1", {});

    const aps = lastMessage().apns?.payload?.aps;
    expect(aps?.alert).toEqual({ title: "Yangi zakaz", body: "Amir Temur 1" });
    expect(aps?.sound).toBe("default");
  });

  it("muddat berilsa ttl qolgan vaqtga teng; o'tib ketgan bo'lsa yuborilmaydi", async () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    await service.sendDataPush("tok", "t", "b", {}, now + 12_000);
    expect(lastMessage().android?.ttl).toBe(12_000);

    send.mockClear();
    await service.sendDataPush("tok", "t", "b", {}, now - 1);
    expect(send).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
