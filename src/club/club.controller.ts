import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ClubService } from './club.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { GuardarClienteAliasDto } from './dto/guardar-cliente-alias.dto';

import { AuthGuard } from '../auth/guard/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { AccessControlService } from '../auth/services/access-control.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { imageUploadOptions } from '../common/uploads/image-upload';

@Controller('club')
export class ClubController {
  constructor(
    private readonly clubService: ClubService,
    private readonly accessControl: AccessControlService,
  ) { }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  create(
    @Body() dto: CreateClubDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const ownerId =
      request.user.tipo === 'admin'
        ? dto.id_dueno
        : request.user.sub;

    return this.clubService.create({
      ...dto,
      id_dueno: Number(ownerId),
    });
  }

  @Post('dueno/:idDueno')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  createForOwner(
    @Param('idDueno', ParseIntPipe) idDueno: number,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    this.accessControl.assertSelfOrAdmin(
      request.user,
      idDueno,
    );

    return this.clubService.createForOwner(
      idDueno,
      body,
    );
  }

  @Get('pendientes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  getPendientes() {
    return this.clubService.getPendientes();
  }

  @Get('aceptados/admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  getAceptadosAdmin() {
    return this.clubService.getAceptados(true);
  }

  @Get('aceptados')
  @UseGuards(AuthGuard)
  getAceptados(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clubService.getAceptados(
      false,
      Number(request.user.sub),
      request.user.tipo,
    );
  }

  @Get('dueno/:idDueno')
  @UseGuards(AuthGuard)
  findByDueno(
    @Param('idDueno', ParseIntPipe) idDueno: number,
    @Req() request: AuthenticatedRequest,
  ) {
    this.accessControl.assertSelfOrAdmin(
      request.user,
      idDueno,
    );

    return this.clubService.findByDueno(idDueno);
  }

  // =========================================================
  // ALIAS INTERNOS DE CLIENTES
  // =========================================================

  @Get(':idClub/clientes/:idUsuario/alias')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'club', 'admin')
  async obtenerAliasCliente(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageClub(
      request.user,
      idClub,
    );

    return this.clubService.obtenerAliasCliente(
      idClub,
      idUsuario,
    );
  }

  @Put(':idClub/clientes/:idUsuario/alias')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'club', 'admin')
  async guardarAliasCliente(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Body() dto: GuardarClienteAliasDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageClub(
      request.user,
      idClub,
    );

    return this.clubService.guardarAliasCliente(
      idClub,
      idUsuario,
      dto.alias,
    );
  }

  @Get()
  findAll() {
    return this.clubService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.clubService.findOne(id);
  }

  @Put(':id/toggle-status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo') activo: boolean,
  ) {
    return this.clubService.toggleStatus(
      id,
      activo,
    );
  }

  @Put(':id/aceptar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  aceptar(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.clubService.aceptar(id);
  }

  @Put(':id/rechazar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.clubService.rechazar(id);
  }

  @Patch(':id/logo')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  @UseInterceptors(
    FileInterceptor(
      'logo',
      imageUploadOptions('clubs', 2),
    ),
  )
  async updateLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageClub(
      request.user,
      id,
    );

    return this.clubService.updateLogo(
      id,
      file,
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClubDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageClub(
      request.user,
      id,
    );

    return this.clubService.update(
      id,
      dto,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageClub(
      request.user,
      id,
    );

    return this.clubService.remove(id);
  }
}