import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { VehicleChangeService } from './vehicle-change.service';
import { DriversService } from './drivers.service';
import { Driver } from '../../database/entities/driver.entity';
import {
  VehicleChangeRequest,
  VehicleChangeRequestStatus,
} from '../../database/entities/vehicle-change-request.entity';
import { UserStatus } from '../../database/entities/user.entity';

const driver = {
  id: 'driver-1',
  userId: 'user-1',
  carModel: 'Chevrolet Cobalt',
  carNumber: '10 A 111 AA',
  licensePlate: null,
  carYear: 2019,
  vehicleType: null,
} as unknown as Driver;

const newCar = { carModel: 'Chevrolet Onix', carNumber: '10 B 222 BB', carYear: 2024 };

function build(openRequest: Partial<VehicleChangeRequest> | null = null) {
  const requestRepository = {
    findOne: jest.fn(async () => openRequest),
    save: jest.fn(async (entity: Record<string, unknown>) => ({ id: 'req-1', ...entity })),
    find: jest.fn(),
  };
  const driverRepository = { findOne: jest.fn(async () => driver) };
  const manager = {
    findOne: jest.fn(async () => ({
      id: 'req-1',
      driverId: 'driver-1',
      status: VehicleChangeRequestStatus.PENDING,
      proposed: { ...newCar, licensePlate: null, vehicleType: null },
    })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const dataSource = { transaction: jest.fn(async (run: (m: typeof manager) => unknown) => run(manager)) };
  const service = new VehicleChangeService(
    requestRepository as never,
    driverRepository as never,
    dataSource as never,
  );
  return { service, requestRepository, manager };
}

describe('VehicleChangeService.request', () => {
  it('stores the full proposed car next to a snapshot of the current one', async () => {
    const { service, requestRepository } = build();

    await service.request('user-1', newCar);

    expect(requestRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        driverId: 'driver-1',
        status: VehicleChangeRequestStatus.PENDING,
        proposed: {
          carModel: 'Chevrolet Onix',
          carNumber: '10 B 222 BB',
          licensePlate: null,
          carYear: 2024,
          vehicleType: null,
        },
        previous: {
          carModel: 'Chevrolet Cobalt',
          carNumber: '10 A 111 AA',
          licensePlate: null,
          carYear: 2019,
          vehicleType: null,
        },
      }),
    );
  });

  it('allows one open request at a time', async () => {
    const { service, requestRepository } = build({ id: 'old', status: VehicleChangeRequestStatus.PENDING });

    await expect(service.request('user-1', newCar)).rejects.toThrow(ConflictException);
    expect(requestRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a "change" that changes nothing', async () => {
    const { service } = build();
    await expect(
      service.request('user-1', { carModel: 'Chevrolet Cobalt', carNumber: '10 A 111 AA', carYear: 2019 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('VehicleChangeService.review', () => {
  it('approval writes the new car onto the driver in the same transaction', async () => {
    const { service, manager } = build();

    const result = await service.review('req-1', 'manager-1', { approved: true });

    expect(result.status).toBe(VehicleChangeRequestStatus.APPROVED);
    expect(manager.update).toHaveBeenCalledWith(
      Driver,
      { id: 'driver-1' },
      expect.objectContaining({ carModel: 'Chevrolet Onix', carNumber: '10 B 222 BB', carYear: 2024 }),
    );
  });

  it('rejection needs a reason and never touches the driver', async () => {
    const { service, manager } = build();

    await expect(service.review('req-1', 'manager-1', { approved: false })).rejects.toThrow(
      BadRequestException,
    );

    await service.review('req-1', 'manager-1', { approved: false, note: 'Raqam o‘qilmayapti' });
    expect(manager.update).toHaveBeenCalledTimes(1);
    expect(manager.update).not.toHaveBeenCalledWith(Driver, expect.anything(), expect.anything());
  });

  it('a second reviewer cannot apply the same request twice', async () => {
    const { service, manager } = build();
    manager.update.mockResolvedValueOnce({ affected: 0 });

    await expect(service.review('req-1', 'manager-2', { approved: true })).rejects.toThrow(
      ConflictException,
    );
    expect(manager.update).toHaveBeenCalledTimes(1);
  });
});

describe('DriversService.updateProfile — car locked after approval', () => {
  function driversService(status: UserStatus) {
    const driverRepository = {
      findOne: jest.fn(async () => driver),
      save: jest.fn(async (entity: Record<string, unknown>) => entity),
    };
    const usersService = { findById: jest.fn(async () => ({ id: 'user-1', status })) };
    const service = new DriversService(
      driverRepository as never,
      {} as never,
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
    );
    return { service, driverRepository };
  }

  it('an approved driver cannot rewrite the plate directly', async () => {
    const { service, driverRepository } = driversService(UserStatus.ACTIVE);

    await expect(service.updateProfile('user-1', { carNumber: '99 Z 999 ZZ' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(driverRepository.save).not.toHaveBeenCalled();
  });

  it('an applicant still waiting for approval can fix their car', async () => {
    const { service, driverRepository } = driversService(UserStatus.PENDING);

    await service.updateProfile('user-1', { carNumber: '10 C 333 CC' });

    expect(driverRepository.save).toHaveBeenCalledWith(expect.objectContaining({ carNumber: '10 C 333 CC' }));
  });
});
