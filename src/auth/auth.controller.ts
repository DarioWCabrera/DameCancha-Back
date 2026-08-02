import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { imageUploadOptions } from '../common/uploads/image-upload';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @RateLimit({ limit: 10, windowMs: 10 * 60 * 1000 })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register/usuario')
  @RateLimit({ limit: 5, windowMs: 60 * 60 * 1000 })
  registerUsuario(@Body() body: CreateUserDto) {
    return this.authService.registerUsuario(body);
  }

  @Post('register/dueno')
  @RateLimit({ limit: 3, windowMs: 60 * 60 * 1000 })
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions('', 2)))
  registerDueno(
    @Body() body: RegisterOwnerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registerDueno(body, file);
  }

  @Post('forgot-password/send-code')
  @RateLimit({ limit: 5, windowMs: 15 * 60 * 1000 })
  sendPasswordResetCode(@Body() body: ForgotPasswordDto) {
    return this.authService.sendPasswordResetCode(body.email);
  }

  @Post('forgot-password/reset')
  @RateLimit({ limit: 10, windowMs: 15 * 60 * 1000 })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(
      body.email,
      body.code,
      body.newPassword,
      body.confirmPassword,
    );
  }
}
