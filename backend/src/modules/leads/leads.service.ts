import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Lead, LeadDetails } from '../../database/entities/lead.entity';
import { TelegramService } from '../business-reports/telegram.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LEAD_DUPLICATE_WINDOW_HOURS } from './leads.constants';

export interface LeadsPage {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
}

const TYPE_LABEL: Record<Lead['type'], string> = {
  driver: '🚕 Haydovchi',
  courier: '🛵 Kuryer',
  partner: '🏪 Hamkor',
};

const DETAIL_LABEL: Record<keyof LeadDetails, string> = {
  carModel: 'Mashina',
  carYear: 'Yili',
  vehicle: 'Transport',
  businessName: 'Biznes',
  businessType: 'Turi',
  address: 'Manzil',
  comment: 'Izoh',
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Ariza qabul qiladi. Bot (honeypot to'ldirilgan) va 24 soat ichidagi
   * takror ham "muvaffaqiyatli" javob oladi — botga qaysi tekshiruv
   * ishlaganini bildirmaymiz, odam esa ikki marta bosganda xato ko'rmaydi.
   */
  async create(dto: CreateLeadDto): Promise<void> {
    if (dto.website) {
      this.logger.warn('lead honeypot triggered — dropped');
      return;
    }
    const since = new Date(Date.now() - LEAD_DUPLICATE_WINDOW_HOURS * 3_600_000);
    const duplicate = await this.leads.exist({
      where: { phone: dto.phone, type: dto.type, createdAt: MoreThan(since) },
    });
    if (duplicate) return;

    const lead = await this.leads.save(
      this.leads.create({
        type: dto.type,
        name: dto.name,
        phone: dto.phone,
        details: pickDetails(dto),
        lang: dto.lang ?? 'uz',
        status: 'new',
        note: null,
        consentAt: new Date(),
      }),
    );
    // Telegram kutilmaydi: u sekin/o'chiq bo'lsa ham ariza saqlangan.
    void this.telegram.send(formatLeadMessage(lead));
  }

  async list(query: ListLeadsDto): Promise<LeadsPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.leads.findAndCount({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.leads.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.leads.save({
      ...lead,
      status: dto.status,
      note: dto.note === undefined ? lead.note : dto.note.trim() || null,
    });
  }
}

export function pickDetails(dto: CreateLeadDto): LeadDetails {
  const keys = Object.keys(DETAIL_LABEL) as (keyof LeadDetails)[];
  return Object.fromEntries(
    keys.filter((k) => dto[k] !== undefined && dto[k] !== '').map((k) => [k, dto[k]]),
  ) as LeadDetails;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatLeadMessage(lead: Pick<Lead, 'type' | 'name' | 'phone' | 'details' | 'lang'>): string {
  const lines = [
    `<b>${TYPE_LABEL[lead.type]} — yangi ariza (sayt)</b>`,
    `Ism: ${escapeHtml(lead.name)}`,
    `Tel: ${escapeHtml(lead.phone)}`,
  ];
  for (const [key, value] of Object.entries(lead.details)) {
    const label = DETAIL_LABEL[key as keyof LeadDetails];
    if (label && value !== undefined) lines.push(`${label}: ${escapeHtml(String(value))}`);
  }
  lines.push(`Til: ${lead.lang}`);
  return lines.join('\n');
}
