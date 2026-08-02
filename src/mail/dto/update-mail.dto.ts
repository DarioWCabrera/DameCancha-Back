
import { PartialType } from '@nestjs/mapped-types';
import { MailDto } from './create-mail.dto';


export class UpdateMailDto extends PartialType(MailDto) {}
