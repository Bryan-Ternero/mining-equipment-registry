import type { FastifyPluginAsync } from 'fastify';
import {
  createEquipmentSchema,
  createMaintenanceSchema,
  idParamSchema,
  parse,
  updateEquipmentSchema,
} from '../schemas.js';
import type { EquipmentService } from '../services/equipment-service.js';

export const equipmentRoutes: FastifyPluginAsync<{ service: EquipmentService }> = async (app, { service }) => {
  app.get('/equipment-types', async () => {
    const types = await service.listTypes();
    return types.map((t) => ({ code: t.code, name: t.name, maintenanceIntervalHours: t.maintenanceIntervalHours }));
  });

  app.get('/equipment', async () => service.list());

  app.post('/equipment', async (request, reply) => {
    const created = await service.create(parse(createEquipmentSchema, request.body));
    return reply.status(201).send(created);
  });

  app.get('/equipment/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return service.get(id);
  });

  app.patch('/equipment/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return service.update(id, parse(updateEquipmentSchema, request.body));
  });

  app.delete('/equipment/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params);
    await service.remove(id);
    return reply.status(204).send();
  });

  app.get('/equipment/:id/maintenances', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return service.listMaintenances(id);
  });

  app.post('/equipment/:id/maintenances', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params);
    const result = await service.registerMaintenance(id, parse(createMaintenanceSchema, request.body));
    return reply.status(201).send(result);
  });
};
