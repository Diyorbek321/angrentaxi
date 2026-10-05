import { DriversModule } from './drivers.module';
import { DriversController } from './drivers.controller';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverVerificationController } from './driver-verification.controller';

/**
 * Express matches routes in registration order, and Nest registers
 * controllers in the order the module lists them. DriversController owns
 * `GET /drivers/:id` (manager/admin only), so any controller under the same
 * `drivers` prefix listed AFTER it loses its literal paths to that param route.
 *
 * Found by the e2e suite: a driver calling `GET /drivers/documents` (the
 * app's "my documents" screen) hit `/drivers/:id` with id="documents" and got
 * 403 "Required roles: manager, admin".
 */
describe('DriversModule controller order', () => {
  const controllers: unknown[] = Reflect.getMetadata('controllers', DriversModule);
  const indexOf = (controller: unknown) => controllers.indexOf(controller);

  it.each([
    ['DriverDocumentsController', DriverDocumentsController],
    ['DriverVerificationController', DriverVerificationController],
  ])('%s is registered before DriversController', (_name, controller) => {
    expect(indexOf(controller)).toBeGreaterThanOrEqual(0);
    expect(indexOf(controller)).toBeLessThan(indexOf(DriversController));
  });
});
