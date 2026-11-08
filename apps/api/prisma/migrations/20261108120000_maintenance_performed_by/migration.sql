-- Who registered each service (the session username). Nullable: rows written before the
-- login existed have no author, and adding the column must not rewrite them.
ALTER TABLE "maintenance_records" ADD COLUMN "performedBy" TEXT;
