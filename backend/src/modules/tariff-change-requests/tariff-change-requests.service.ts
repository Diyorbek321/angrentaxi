import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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
    let current: Tariff | null = null;

    if (dto.tariffId) {
      const tariff = await this.tariffRepository.findOne({ where: { id: dto.tariffId } });
      if (!tariff) {
        throw new NotFoundException(`Tariff with id ${dto.tariffId} not found`);
      }
      current = tariff;
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

    await this.assertValidProposal(dto, current);

    return this.requestRepository.save({
      action: dto.action,
      tariffId: dto.tariffId ?? null,
      proposedChanges: dto.proposedChanges,
      previousValues,
      proposedBy,
      status: TariffChangeRequestStatus.PENDING,
    });
  }

  /**
   * Checks `proposedChanges` with the same rules the admin's approval will
   * apply, so a proposal that can never be approved is refused when the
   * manager submits it — not discovered later by the admin as a bare 400.
   * Approval casts the JSON straight to Create/UpdateTariffDto, so this is
   * also the only place its shape is ever validated.
   */
  private async assertValidProposal(dto: ProposeTariffChangeDto, current: Tariff | null): Promise<void> {
    const isCreate = dto.action === TariffChangeAction.CREATE;
    const target = plainToInstance(isCreate ? CreateTariffDto : UpdateTariffDto, dto.proposedChanges);
    const errors = await validate(target, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      const reasons = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(`Tarif taklifi noto'g'ri: ${reasons.join('; ')}`);
    }

    // Effective bounds after the change: an update only sends what it alters.
    const changes = dto.proposedChanges as { minPrice?: number; maxPrice?: number | null };
    const minPrice = changes.minPrice ?? current?.minPrice ?? 0;
    const maxPrice = 'maxPrice' in changes ? changes.maxPrice : current?.maxPrice;
    if (maxPrice != null && maxPrice < minPrice) {
      throw new BadRequestException(
        `Max narx (${maxPrice}) min narxdan (${minPrice}) kichik bo'lmasligi kerak. ` +
          `Cheklov kerak bo'lmasa, max narxni bo'sh qoldiring.`,
      );
    }
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
