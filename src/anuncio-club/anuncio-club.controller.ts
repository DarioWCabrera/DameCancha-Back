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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { AuthGuard } from '../auth/guard/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { imageUploadOptions } from '../common/uploads/image-upload';
import { CreateAnuncioClubDto } from './dto/create-anuncio-club.dto';
import { UpdateAnuncioClubDto } from './dto/update-anuncio-club.dto';
import { UpdateEstadoAnuncioClubDto } from './dto/update-estado-anuncio-club.dto';
import {
  AnuncioClubService,
  UsuarioAutenticadoAnuncio,
} from './anuncio-club.service';

type RequestAutenticada = Request & {
  user: UsuarioAutenticadoAnuncio;
};

@Controller('anuncio-club')
export class AnuncioClubController {
  constructor(
    private readonly anuncioClubService: AnuncioClubService,
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  @UseInterceptors(
    FileInterceptor('imagen', imageUploadOptions('anuncios', 5)),
  )
  create(
    @Body() dto: CreateAnuncioClubDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: RequestAutenticada,
  ) {
    return this.anuncioClubService.create(
      dto,
      file,
      request.user,
    );
  }

  @Get('activos')
  findActivos() {
    return this.anuncioClubService.findActivos();
  }

  @Get('club/:idClub/activos')
  findActivosByClub(
    @Param('idClub', ParseIntPipe) idClub: number,
  ) {
    return this.anuncioClubService.findActivosByClub(idClub);
  }

  @Get('club/:idClub')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  findByClub(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Req() request: RequestAutenticada,
  ) {
    return this.anuncioClubService.findByClub(
      idClub,
      request.user,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.anuncioClubService.findOne(id);
  }

  @Patch(':id/estado')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoAnuncioClubDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.anuncioClubService.updateEstado(
      id,
      dto.activo,
      request.user,
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  @UseInterceptors(
    FileInterceptor('imagen', imageUploadOptions('anuncios', 5)),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnuncioClubDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: RequestAutenticada,
  ) {
    return this.anuncioClubService.update(
      id,
      dto,
      file,
      request.user,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('club', 'dueno', 'admin')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestAutenticada,
  ) {
    return this.anuncioClubService.remove(id, request.user);
  }
}