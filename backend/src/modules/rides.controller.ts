import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '../prisma';
import { RidesGateway } from './rides.gateway';

const RideRequestSchema = z.object({
  riderId: z.string(),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropLat: z.number(),
  dropLng: z.number(),
  fareCents: z.number().optional()
});

const RideAcceptSchema = z.object({
  driverId: z.string()
});

@Controller('rides')
export class RidesController {
  constructor(private gateway: RidesGateway) {}

  @Post()
  async requestRide(@Body() body: unknown) {
    const data = RideRequestSchema.parse(body);
    const ride = await prisma.ride.create({
      data: {
        riderId: data.riderId,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropLat: data.dropLat,
        dropLng: data.dropLng,
        status: 'MATCHING',
        fareCents: data.fareCents ?? 0
      }
    });
    this.gateway.broadcastRideUpdate(ride);
    return { ride };
  }

  @Patch(':id/accept')
  async accept(@Param('id') id: string, @Body() body: unknown) {
    const data = RideAcceptSchema.parse(body);
    const ride = await prisma.ride.update({
      where: { id },
      data: { status: 'ASSIGNED', driverId: data.driverId }
    });
    this.gateway.broadcastRideUpdate(ride);
    return { ride };
  }

  @Patch(':id/start')
  async start(@Param('id') id: string) {
    const ride = await prisma.ride.update({
      where: { id },
      data: { status: 'STARTED' }
    });
    this.gateway.broadcastRideUpdate(ride);
    return { ride };
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    const ride = await prisma.ride.update({
      where: { id },
      data: { status: 'COMPLETED' }
    });
    this.gateway.broadcastRideUpdate(ride);
    return { ride };
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    const ride = await prisma.ride.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
    this.gateway.broadcastRideUpdate(ride);
    return { ride };
  }

  @Get('open')
  async open() {
    const rides = await prisma.ride.findMany({ where: { status: 'MATCHING' } });
    return { rides };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const ride = await prisma.ride.findUnique({ where: { id } });
    return { ride };
  }
}
