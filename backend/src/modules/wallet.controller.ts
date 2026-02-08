import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '../prisma';

const WalletTopupSchema = z.object({
  userId: z.string(),
  amount: z.number()
});

const WalletPaySchema = z.object({
  userId: z.string(),
  amount: z.number(),
  reason: z.string(),
  rideId: z.string().optional()
});

@Controller('wallet')
export class WalletController {
  @Get(':userId')
  async get(@Param('userId') userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    return { wallet };
  }

  @Post('topup')
  async topup(@Body() body: unknown) {
    const data = WalletTopupSchema.parse(body);
    const wallet = await prisma.wallet.update({
      where: { userId: data.userId },
      data: {
        balance: { increment: data.amount },
        txs: { create: { amount: data.amount, reason: 'Topup' } }
      },
      include: { txs: true }
    });
    return { wallet };
  }

  @Post('pay')
  async pay(@Body() body: unknown) {
    const data = WalletPaySchema.parse(body);
    const wallet = await prisma.wallet.update({
      where: { userId: data.userId },
      data: {
        balance: { decrement: data.amount },
        txs: { create: { amount: -data.amount, reason: data.reason, rideId: data.rideId } }
      },
      include: { txs: true }
    });
    return { wallet };
  }
}
