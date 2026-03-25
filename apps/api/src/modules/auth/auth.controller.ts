import {
  Body,
  Controller,
  ConflictException,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { RegisterSchema } from './dto/auth.dto';
import type { RegisterDto } from './dto/auth.dto';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Req() request: Request) {
    const parsedBody = RegisterSchema.parse(body);
    const clientIp = request.ip || request.socket.remoteAddress;

    if (this.authService.isRegisterRateLimited(parsedBody.email, clientIp)) {
      throw new HttpException(
        'Too many registration attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.authService.register(parsedBody);
    if (!result) {
      throw new ConflictException('Email already exists');
    }

    return result;
  }
}
