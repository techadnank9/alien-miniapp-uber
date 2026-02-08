import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createAuthClient } from '@alien_org/auth-client';
import { randomUUID, verify } from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma';

const authClient = createAuthClient();

const InvoiceSchema = z.object({
  amount: z.string(),
  rideId: z.string().optional()
});

function decodeSignature(sig: string): Buffer {
  try {
    return Buffer.from(sig, 'base64');
  } catch {
    return Buffer.from(sig, 'hex');
  }
}

@Controller('payments')
export class PaymentsController {
  @Post('invoice')
  async createInvoice(@Headers('authorization') authHeader: string | undefined, @Body() body: unknown) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing Bearer token');

    const data = InvoiceSchema.parse(body ?? {});
    const result = await authClient.verifyToken(token);
    const alienUserId = result.sub;

    const recipient = process.env.ALIEN_RECIPIENT_ADDRESS;
    if (!recipient) throw new Error('Missing ALIEN_RECIPIENT_ADDRESS');

    const user = await prisma.user.upsert({
      where: { alienUserId },
      update: {},
      create: {
        alienUserId,
        name: 'Rider',
        wallet: { create: { balance: 0 } }
      }
    });

    const invoice = `inv_${randomUUID()}`;

    await prisma.paymentIntent.create({
      data: {
        userId: user.id,
        rideId: data.rideId,
        amount: data.amount,
        token: 'ALIEN',
        network: 'alien',
        recipient,
        invoice,
        status: 'CREATED'
      }
    });

    return { invoice, recipient, amount: data.amount };
  }

  @Post('webhook')
  async webhook(@Headers('x-alien-signature') signature: string | undefined, @Req() req: any) {
    if (!signature) throw new UnauthorizedException('Missing signature');
    const publicKey = process.env.WEBHOOK_PUBLIC_KEY;
    if (!publicKey) throw new Error('Missing WEBHOOK_PUBLIC_KEY');

    const rawBody = req.rawBody as string;
    const sigBuf = decodeSignature(signature);

    const valid = verify(null, Buffer.from(rawBody), publicKey, sigBuf);
    if (!valid) throw new UnauthorizedException('Invalid signature');

    const payload = JSON.parse(rawBody);
    const invoice = payload?.invoice;
    const status = payload?.status ?? 'PAID';

    if (invoice) {
      await prisma.paymentIntent.update({
        where: { invoice },
        data: { status }
      });
    }

    return { ok: true };
  }
}
