import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CanchaService } from './cancha.service';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { AccessControlService } from '../auth/services/access-control.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@Controller('cancha')
@UseGuards(AuthGuard)
export class CanchaController {
  constructor(
    private readonly canchaService: CanchaService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  findAll() {
    return this.canchaService.findAll();
  }

  @Get('club/:idClub')
  findByClub(@Param('idClub', ParseIntPipe) idClub: number) {
    return this.canchaService.findByClub(idClub);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.canchaService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('dueno', 'club', 'admin')
  async create(
    @Body() dto: CreateCanchaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageClub(request.user, dto.id_club);
    return this.canchaService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCanchaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageCancha(request.user, id);
    if (dto.id_club !== undefined) {
      await this.accessControl.assertCanManageClub(request.user, dto.id_club);
    }
    return this.canchaService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageCancha(request.user, id);
    return this.canchaService.remove(id);
  }
}
