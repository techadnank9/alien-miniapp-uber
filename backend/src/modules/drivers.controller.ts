import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '../prisma';

const DriverCreateSchema = z.object({
  userId: z.string(),
  vehicle: z.string(),
  isAi: z.boolean().optional()
});

const DriverLocationSchema = z.object({
  lat: z.number(),
  lng: z.number()
});

@Controller('drivers')
export class DriversController {
  @Post()
  async create(@Body() body: unknown) {
    const data = DriverCreateSchema.parse(body);
    const driver = await prisma.driver.upsert({
      where: { userId: data.userId },
      update: {
        vehicle: data.vehicle,
        isAi: data.isAi ?? false
      },
      create: {
        userId: data.userId,
        vehicle: data.vehicle,
        isAi: data.isAi ?? false
      }
    });
    return { driver };
  }

  @Get('nearby')
  async nearby(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    // Hackathon stub: return active drivers. Replace with Redis GEO search.
    const drivers = await prisma.driver.findMany({
      where: { isActive: true },
      include: { user: true }
    });
    return {
      drivers: drivers.map((d) => ({
        id: d.id,
        name: d.user.name,
        isAi: d.isAi,
        vehicle: d.vehicle,
        lat: d.lat,
        lng: d.lng
      })),
      debug: { lat, lng }
    };
  }

  @Patch(':id/location')
  async updateLocation(@Param('id') id: string, @Body() body: unknown) {
    const data = DriverLocationSchema.parse(body);
    const driver = await prisma.driver.update({
      where: { id },
      data: { lat: data.lat, lng: data.lng }
    });
    return { driver };
  }
}
