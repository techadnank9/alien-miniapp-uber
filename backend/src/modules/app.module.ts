import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DriversController } from './drivers.controller';
import { RidesController } from './rides.controller';
import { WalletController } from './wallet.controller';
import { RidesGateway } from './rides.gateway';
import { HealthController } from './health.controller';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [],
  controllers: [AuthController, DriversController, RidesController, WalletController, HealthController, PaymentsController],
  providers: [RidesGateway]
})
export class AppModule {}
