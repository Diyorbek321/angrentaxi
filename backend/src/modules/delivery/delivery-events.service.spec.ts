import { DeliveryEventsService } from './delivery-events.service';

describe('DeliveryEventsService', () => {
  it('delivers food and market events to every listener', async () => {
    const service = new DeliveryEventsService();
    const a = jest.fn();
    const b = jest.fn();
    service.subscribe(a);
    service.subscribe(b);

    await service.publish({ id: 'ride-1', details: { foodOrderId: 'food-1' } }, 'delivered');

    const expected = {
      kind: 'delivered',
      deliveryOrderId: 'ride-1',
      foodOrderId: 'food-1',
      marketOrderId: null,
    };
    expect(a).toHaveBeenCalledWith(expected);
    expect(b).toHaveBeenCalledWith(expected);
  });

  it('ignores rides that carry no vendor order (taxi, cargo)', async () => {
    const service = new DeliveryEventsService();
    const listener = jest.fn();
    service.subscribe(listener);

    await service.publish({ id: 'ride-1', details: null }, 'delivered');
    await service.publish({ id: 'ride-2', details: { cargoWeight: 20 } }, 'accepted');

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps going and never throws when a listener fails', async () => {
    const service = new DeliveryEventsService();
    const after = jest.fn();
    service.subscribe(() => {
      throw new Error('db down');
    });
    service.subscribe(after);

    await expect(
      service.publish({ id: 'ride-1', details: { marketOrderId: 'm-1' } }, 'cancelled'),
    ).resolves.toBeUndefined();
    expect(after).toHaveBeenCalled();
  });
});
