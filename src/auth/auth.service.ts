import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { randomInt } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(email: string, password: string) {
    const result = await this.userService.login(email, password);

    const payload = {
      sub: result.user.id_usuario,
      email: result.user.email,
      tipo: result.user.tipo,
      role: result.user.tipo,
    };

    const token = await this.jwtService.signAsync(payload);

    return { ...result, token };
  }

  async registerUsuario(dto: CreateUserDto) {
    return this.userService.create({ ...dto, tipo_usuario: 'usuario', estado_usuario: 'activo' });
  }

  async registerDueno(dto: RegisterOwnerDto, file?: Express.Multer.File) {
    return this.userService.createWithClub({ ...dto, tipo: 'dueno' }, file);
  }

  async sendPasswordResetCode(email: string) {
    if (!email) {
      throw new BadRequestException('Debe ingresar un email válido.');
    }

    const user = await this.userService.findByEmail(email);

    /*
      Por seguridad no informamos si el email existe o no.
      Así evitamos que alguien use este endpoint para enumerar usuarios registrados.
    */
    if (!user) {
      return {
        message:
          'Si el email existe en DameCancha, vas a recibir un código de recuperación.',
      };
    }

    const code = randomInt(100000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.userService.savePasswordResetCode(
      user.email_usuario,
      code,
      expiresAt,
    );

    await this.mailService.sendPasswordRecoveryCode({
      email: user.email_usuario,
      nombre: `${user.nombre_usuario} ${user.apellido_usuario}`.trim(),
      codigo: code,
      minutos: 10,
    });

    return {
      message:
        'Si el email existe en DameCancha, vas a recibir un código de recuperación.',
    };
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    return this.userService.resetPasswordWithCode(
      email,
      code,
      newPassword,
      confirmPassword,
    );
  }
}
