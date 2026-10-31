import { OrdersMeterService } from './orders-meter.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MatchingService } from '../matching/matching.service';
import { User, UserRole } from '../../database/entities/user.entity';

/**
 * `PATCH /orders/:id/accept` — safar yozilgandan keyingi yordamchi qadamlar
 * (antifrod yozuvi, matching navbatini tozalash) yiqilsa ham haydovchi
 * muvaffaqiyat oladi: aks holda u 500 ko'rib, aslida o'ziniki bo'lgan safarni
 * tashlab ketardi.
 */
describe('OrdersController.acceptOrder — qabuldan keyingi xatolar', () => {
  const driver = { id: 'driver-a', role: UserRole.DRIVER } as User;
  const accepted = { id: 'ride-1', status: 'accepted' };

  function build(opts: { fraudFails?: boolean; matchingFails?: boolean }) {
    const driverAccepted = opts.matchingFails
      ? jest.fn().mockRejectedValue(new Error('redis down'))
      : jest.fn().mockResolvedValue(undefined);
    const recordDriverAccept = opts.fraudFails
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockResolvedValue(undefined);
    const controller = new OrdersController(
      { acceptOrder: jest.fn().mockResolvedValue(accepted) } as unknown as OrdersService,
      { driverAccepted } as unknown as MatchingService,
      {} as OrdersMeterService,
      { recordDriverAccept } as never,
    );
    return { controller, driverAccepted };
  }

  it('antifrod yozuvi yiqilsa — qabul qaytadi va navbat baribir tozalanadi', async () => {
    const { controller, driverAccepted } = build({ fraudFails: true });

    await expect(controller.acceptOrder(driver, 'ride-1')).resolves.toBe(accepted);
    expect(driverAccepted).toHaveBeenCalledWith('driver-a', 'ride-1');
  });

  it('navbatni tozalash yiqilsa — qabul baribir qaytadi', async () => {
    const { controller } = build({ matchingFails: true });

    await expect(controller.acceptOrder(driver, 'ride-1')).resolves.toBe(accepted);
  });
});
