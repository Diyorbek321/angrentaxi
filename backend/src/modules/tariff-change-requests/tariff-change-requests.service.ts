import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TariffChangeAction,
  TariffChangeRequest,
  TariffChangeRequestStatus,
} from '../../database/entities/tariff-change-request.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { CreateTariffDto } from '../tariffs/dto/create-tariff.dto';
import { UpdateTariffDto } from '../tariffs/dto/update-tariff.dto';
import { ProposeTariffChangeDto } from './dto/propose-tariff-change.dto';

@Injectable()
export class TariffChangeRequestsService {
  constructor(
    @InjectRepository(TariffChangeRequest)
    private readonly requestRepository: Repository<TariffChangeRequest>,
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
    private readonly tariffsService: TariffsService,
  ) {}

  async propose(proposedBy: string, dto: ProposeTariffChangeDto): Promise<TariffChangeRequest> {
    let previousValues: Record<string, unknown> | null = null;

    if (dto.tariffId) {
      const tariff = await this.tariffRepository.findOne({ where: { id: dto.tariffId } });
      if (!tariff) {
        throw new NotFoundException(`Tariff with id ${dto.tariffId} not found`);
      }
      previousValues = {
        name: tariff.name,
        basePrice: tariff.basePrice,
        pricePerKm: tariff.pricePerKm,
        pricePerMin: tariff.pricePerMin,
        minPrice: tariff.minPrice,
        maxPrice: tariff.maxPrice,
        isActive: tariff.isActive,
      };
    }

    return this.requestRepository.save({
      action: dto.action,
      tariffId: dto.tariffId ?? null,
      proposedChanges: dto.proposedChanges,
      previousValues,
      proposedBy,
      status: TariffChangeRequestStatus.PENDING,
    });
  }

  async findAll(status?: TariffChangeRequestStatus): Promise<TariffChangeRequest[]> {
    return this.requestRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdOrThrow(id: string): Promise<TariffChangeRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Tariff change request ${id} not found`);
    }
    return request;
  }

  async approve(
    id: string,
    reviewedBy: string,
    reviewNote?: string,
  ): Promise<TariffChangeRequest> {
    const request = await this.findByIdOrThrow(id);
    this.assertPending(request);

    // ⚠️ Taqqoslash ENUM a'zosi bilan, satr bilan emas. Ilgari bu yerda
    // `=== 'create'` turardi: `action` ustunining turi o'zgarsa (masalan
    // yangi qiymat qo'shilsa yoki nomi tuzatilsa) shart JIMGINA hech
    // qachon rost bo'lmay qolardi va har bir so'rov `update` shoxiga
    // tushardi.
    if (request.action === TariffChangeAction.CREATE) {
      await this.tariffsService.create(request.proposedChanges as unknown as CreateTariffDto);
    } else {
      if (!request.tariffId) {
        throw new BadRequestException('Update request is missing a tariffId');
      }
      // Kast ATAYLAB saqlanadi, garchi TypeScript usiz ham o'tkazsa:
      // `proposedChanges` — `Record<string, unknown>`, ya'ni turlanmagan
      // JSON, va `UpdateTariffDto` maydonlarining hammasi ixtiyoriy
      // bo'lgani uchun tekshiruvchi ularni mos deb biladi. Kast "bu yerda
      // ishonch bilan tur beryapmiz" degan niyatni ko'rsatib turadi va
      // yuqoridagi `create` shoxi bilan bir xil o'qiladi.
      await this.tariffsService.update(
        request.tariffId,
        request.proposedChanges as unknown as UpdateTariffDto,
      );
    }

    return this.requestRepository.save({
      ...request,
      status: TariffChangeRequestStatus.APPROVED,
      reviewedBy,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    });
  }

  async reject(id: string, reviewedBy: string, reviewNote?: string): Promise<TariffChangeRequest> {
    const request = await this.findByIdOrThrow(id);
    this.assertPending(request);

    return this.requestRepository.save({
      ...request,
      status: TariffChangeRequestStatus.REJECTED,
      reviewedBy,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    });
  }

  private assertPending(request: TariffChangeRequest): void {
    if (request.status !== TariffChangeRequestStatus.PENDING) {
      throw new BadRequestException(`Request has already been ${request.status}`);
    }
  }
}
