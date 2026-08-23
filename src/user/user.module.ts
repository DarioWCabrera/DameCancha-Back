import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { UserService } from './user.service';
import { UserController } from './user.controller';

import { User } from './entities/user.entity';
import { Club } from '../club/entities/club.entity';

import { RecaptchaService } from '../common/recaptcha/recaptcha.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    TypeOrmModule.forFeature([User, Club]),
  ],

  controllers: [UserController],

  providers: [
    UserService,
    RecaptchaService,
  ],

  exports: [UserService],
})
export class UserModule {}