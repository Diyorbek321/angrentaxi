import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../database/entities/user.entity';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverVerificationController } from './driver-verification.controller';
import { VehicleChangeController } from './vehicle-change.controller';

/**
 * Approving a driver needs DRIVERS_APPROVE; so must every review that decides
 * what a driver may do (KYC, periodic checks, car changes). A manager whose
 * admin revoked that permission must not be able to approve through the side
 * door of a review queue.
 */
describe('driver review endpoints require DRIVERS_APPROVE', () => {
  const cases: Array<[string, object, string]> = [
    ['documents queue', DriverDocumentsController.prototype, 'pending'],
    ['document review', DriverDocumentsController.prototype, 'review'],
    ['verification queue', DriverVerificationController.prototype, 'pending'],
    ['verification review', DriverVerificationController.prototype, 'review'],
    ['vehicle change queue', VehicleChangeController.prototype, 'pending'],
    ['vehicle change review', VehicleChangeController.prototype, 'review'],
  ];

  it.each(cases)('%s', (_name, proto, method) => {
    const handler = (proto as Record<string, unknown>)[method] as object;
    expect(handler).toBeDefined();
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([Permission.DRIVERS_APPROVE]);
  });
});
