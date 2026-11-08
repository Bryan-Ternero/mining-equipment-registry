-- Temporary equipment type, added to exercise ./deploy.sh end to end (a new migration that
-- the deploy must apply). Remove it with a later migration once no equipment uses it.
INSERT INTO "equipment_types" ("code", "name", "maintenanceIntervalHours")
VALUES ('CARGADOR', 'Cargador frontal', 400)
ON CONFLICT ("code") DO NOTHING;
