import {
  Body,
  Controller,
  ConflictException,
  Post,
} from '@nestjs/common';
import {
  RegisterSchema,
} from './dto/auth.dto';
import type {
  RegisterDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    const result = this.authService.register(RegisterSchema.parse(body));
    if (!result) {
      throw new ConflictException('Email already exists');
    }

    return result;
  }
}
