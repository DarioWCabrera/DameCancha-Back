import { Injectable } from '@nestjs/common';
import { CreateDeporteDto } from './dto/create-deporte.dto';
import { UpdateDeporteDto } from './dto/update-deporte.dto';
import { Deporte } from './entities/deporte.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class DeporteService {
  constructor(
    @InjectRepository(Deporte)
    private readonly deporteRepository: Repository<Deporte>,
  ) {}


create (createDeporteDto: CreateDeporteDto) {
  const deporte = this.deporteRepository.create(createDeporteDto);
  return this.deporteRepository.save(deporte);
}

findAll() {
  return this.deporteRepository.find();
}

findOne(id: number) {
  return this.deporteRepository.findOneBy({ id_deporte: id });
}

update(id: number, updateDeporteDto: UpdateDeporteDto) {
  return this.deporteRepository.update(id, updateDeporteDto);
}

remove(id: number) {
  return this.deporteRepository.delete(id);
}
}