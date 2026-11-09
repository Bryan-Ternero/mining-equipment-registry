-- Nuevo tipo de equipo: draga, con mantenimiento cada 600 horas.
-- ON CONFLICT hace que la migración sea segura de repetir.
INSERT INTO "equipment_types" ("code", "name", "maintenanceIntervalHours")
VALUES ('DRAGA', 'Draga', 600)
ON CONFLICT ("code") DO NOTHING;
