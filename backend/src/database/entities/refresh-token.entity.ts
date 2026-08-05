import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One row per issued refresh token. Without this table a leaked or stolen
// refresh token stayed valid for its full lifetime with no way to revoke it —
// persisting them is what makes logout, rotation and reuse detection possible.
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Every lookup is either "this exact token" or "all tokens of this user"
  // (logout-everywhere / reuse detection), so both columns are indexed.
  @Index('idx_refresh_tokens_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  // SHA-256 hex digest of the JWT, never the JWT itself: a dump of this table
  // must not hand an attacker usable credentials. SHA-256 (not bcrypt) is the
  // right tool here — the token is 200+ bits of unguessable entropy, so there
  // is nothing to brute-force, and lookups must stay O(index).
  @Index('idx_refresh_tokens_token_hash')
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  // Set when the token is rotated away, revoked by logout, or wiped by reuse
  // detection. NULL means the token is still usable.
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  // Hash of the token that replaced this one during rotation. Purely forensic:
  // it lets an investigation walk a token chain after a reuse alert.
  @Column({ type: 'varchar', length: 64, nullable: true })
  replacedByTokenHash: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
