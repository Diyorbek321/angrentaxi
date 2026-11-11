import { MigrationInterface, QueryRunner } from 'typeorm';

// KYC document uploads (license, passport, vehicle registration) for driver
// onboarding. Additive: does not touch the existing drivers.car_model /
// car_number text fields. Like 002-006, dev environments run with DB_SYNC on;
// this documents the production path.
export class DriverDocuments1700000000007 implements MigrationInterface {
  name = 'DriverDocuments1700000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE driver_documents_document_type_enum AS ENUM (
          'license_front', 'license_back', 'passport', 'vehicle_registration'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE driver_documents_review_status_enum AS ENUM (
          'pending', 'approved', 'rejected'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS driver_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID NOT NULL REFERENCES drivers(id),
        document_type driver_documents_document_type_enum NOT NULL,
        file_url VARCHAR NOT NULL,
        review_status driver_documents_review_status_enum NOT NULL DEFAULT 'pending',
        uploaded_at TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents(driver_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS driver_documents;
      DROP TYPE IF EXISTS driver_documents_review_status_enum;
      DROP TYPE IF EXISTS driver_documents_document_type_enum;
    `);
  }
}
