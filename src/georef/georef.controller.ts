// georef.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { GeorefService } from './georef.service';

@Controller('georef')
export class GeorefController {
  constructor(
    private readonly georefService: GeorefService,
  ) {}

  @Get('provincias')
  getProvincias() {
    return this.georefService.getProvincias();
  }

  @Get('municipios')
  getMunicipios(
    @Query('provincia') provincia: string,
  ) {
    return this.georefService.getMunicipios(
      provincia,
    );
  }

  @Get('localidades')
  getLocalidades(
    @Query('provincia') provincia: string,
  ) {
    return this.georefService.getLocalidades(
      provincia,
    );
  }
}