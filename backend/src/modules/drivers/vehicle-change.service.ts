import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Driver } from '../../database/entities/driver.entity';
import {
  VehicleChangeRequest,
  VehicleChangeRequestStatus,
  VehicleFields,
} from '../../database/entities/vehicle-change-request.entity';
import { RequestVehicleChangeDto, ReviewVehicleChangeDto } from './dto/vehicle-change.dto';

/** Queue row for the reviewer. */
export interface PendingVehicleChange {
  id: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  previous: VehicleFields;
  proposed: VehicleFields;
  createdAt: string;
}

export const PENDING_VEHICLE_CHANGES_LIMIT = 200;

function vehicleFieldsOf(driver: Driver): VehicleFields {
  return {
    carModel: driver.carModel,
    carNumber: driver.carNumber,
    licensePlate: driver.licensePlate,
    carYear: driver.carYear,
    vehicleType: driver.vehicleType,
  };
}

/**
 * Car changes for already-approved drivers.
 *
 * Passengers are told which car to look for from `drivers.car_number`; a
 * driver who could rewrite it at will could send a different car (or person)
 * to a pickup. So after approval the car only changes through a request a
 * manager signs off — the same "pending edit never touches live data" pattern
 * as tariff change requests.
 */
@Injectable()
export class VehicleChangeService {
  constructor(
    @InjectRepository(VehicleChangeRequest)
    private readonly requestRepository: Repository<VehicleChangeRequest>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly dataSource: DataSource,
  ) {}

  async request(userId: string, dto: RequestVehicleChangeDto): Promise<VehicleChangeRequest> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    const open = await this.requestRepository.findOne({
      where: { driverId: driver.id, status: VehicleChangeRequestStatus.PENDING },
    });
    if (open) {
      throw new ConflictException('Sizda ko‘rib chiqilayotgan so‘rov bor — natijasini kuting');
    }

    const proposed: VehicleFields = {
      carModel: dto.carModel,
      carNumber: dto.carNumber,
      licensePlate: dto.licensePlate ?? null,
      carYear: dto.carYear ?? null,
      vehicleType: dto.vehicleType ?? null,
    };
    const previous = vehicleFieldsOf(driver);
    if (JSON.stringify(proposed) === JSON.stringify(previous)) {
      throw new BadRequestException('Yangi ma’lumotlar hozirgisi bilan bir xil');
    }

    return this.requestRepository.save({
      driverId: driver.id,
      proposed,
      previous,
      status: VehicleChangeRequestStatus.PENDING,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
    });
  }

  /** The driver's most recent request, so the app can show its state. */
  async latestForUser(userId: string): Promise<VehicleChangeRequest | null> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.requestRepository.findOne({
      where: { driverId: driver.id },
      order: { createdAt: 'DESC' },
    });
  }

  async listPending(): Promise<PendingVehicleChange[]> {
    const requests = await this.requestRepository.find({
      where: { status: VehicleChangeRequestStatus.PENDING },
      relations: ['driver', 'driver.user'],
      order: { createdAt: 'ASC' },
      take: PENDING_VEHICLE_CHANGES_LIMIT,
    });
    return requests.map((request) => {
      const user = request.driver?.user;
      return {
        id: request.id,
        driverId: request.driverId,
        driverName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || null : null,
        driverPhone: user?.phone ?? null,
        previous: request.previous,
        proposed: request.proposed,
        createdAt: request.createdAt.toISOString(),
      };
    });
  }

  /**
   * Approve writes the proposed car onto the driver and closes the request in
   * one transaction, so a crash between the two can never leave an approved
   * request whose car never went live (or the reverse). The status write is
   * conditional on PENDING, so two reviewers clicking at once apply it once.
   */
  async review(
    requestId: string,
    reviewerId: string,
    dto: ReviewVehicleChangeDto,
    now: Date = new Date(),
  ): Promise<VehicleChangeRequest> {
    const note = dto.note?.trim() || null;
    if (!dto.approved && !note) {
      throw new BadRequestException('Rad etishda sabab ko‘rsatilishi shart');
    }

    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(VehicleChangeRequest, { where: { id: requestId } });
      if (!request) throw new NotFoundException('Vehicle change request not found');

      const result = await manager.update(
        VehicleChangeRequest,
        { id: requestId, status: VehicleChangeRequestStatus.PENDING },
        {
          status: dto.approved
            ? VehicleChangeRequestStatus.APPROVED
            : VehicleChangeRequestStatus.REJECTED,
          reviewNote: note,
          reviewedBy: reviewerId,
          reviewedAt: now,
        },
      );
      if (!result.affected) {
        throw new ConflictException('Bu so‘rov allaqachon ko‘rib chiqilgan');
      }

      if (dto.approved) {
        const { carModel, carNumber, licensePlate, carYear, vehicleType } = request.proposed;
        await manager.update(Driver, { id: request.driverId }, {
          carModel,
          carNumber,
          licensePlate,
          carYear,
          vehicleType: vehicleType as Driver['vehicleType'],
        });
      }

      return {
        ...request,
        status: dto.approved ? VehicleChangeRequestStatus.APPROVED : VehicleChangeRequestStatus.REJECTED,
        reviewNote: note,
        reviewedBy: reviewerId,
        reviewedAt: now,
      };
    });
  }
}
