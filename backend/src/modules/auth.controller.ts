import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { createAuthClient } from '@alien_org/auth-client';
import { z } from 'zod';
import { prisma } from '../prisma';

const AuthSchema = z.object({
  role: z.enum(['RIDER', 'DRIVER']).optional()
});

const authClient = createAuthClient();

@Controller('auth')
export class AuthController {
  @Post('alien')
  async alienAuth(@Headers('authorization') authHeader: string | undefined, @Body() body: unknown) {
    const data = AuthSchema.parse(body ?? {});
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const result = await authClient.verifyToken(token);
    const alienUserId = result.sub;
    const user = await prisma.user.upsert({
      where: { alienUserId },
      update: {
        name: 'Rider',
        role: data.role ?? 'RIDER'
      },
      create: {
        alienUserId,
        name: 'Rider',
        role: data.role ?? 'RIDER',
        wallet: { create: { balance: 0 } }
      },
      include: { wallet: true, driver: true }
    });

    return { user };
  }
}
