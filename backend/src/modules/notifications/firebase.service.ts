import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured, push notifications disabled');
      return;
    }

    try {
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        this.app = admin.apps[0];
      }

      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.error(`Firebase initialization failed: ${(err as Error).message}`);
    }
  }

  async sendPush(
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.app) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return;
    }

    try {
      const message: admin.messaging.Message = {
        notification: { title, body },
        data,
        token: fcmToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'angren_taxi_orders',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const messageId = await admin.messaging(this.app).send(message);
      this.logger.log(`Push notification sent, id: ${messageId}`);
    } catch (err) {
      this.logger.error(`Push notification failed: ${(err as Error).message}`);
    }
  }

  async sendMulticast(
    fcmTokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.app || fcmTokens.length === 0) {
      return;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data,
        tokens: fcmTokens,
      };

      const response = await admin.messaging(this.app).sendEachForMulticast(message);
      this.logger.log(
        `Multicast: ${response.successCount} sent, ${response.failureCount} failed`,
      );
    } catch (err) {
      this.logger.error(`Multicast push failed: ${(err as Error).message}`);
    }
  }
}
