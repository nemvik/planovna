import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LoginSchema,
  MagicLinkConsumeSchema,
  MagicLinkRequestSchema,
} from './dto/auth.dto';
import type {
  LoginDto,
  MagicLinkConsumeDto,
  MagicLinkRequestDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    const result = this.authService.login(LoginSchema.parse(body));
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return result;
  }

  @Post('magic-link/request')
  requestMagicLink(@Body() body: MagicLinkRequestDto) {
    const result = this.authService.requestMagicLink(
      MagicLinkRequestSchema.parse(body),
    );
    if (!result) {
      throw new UnauthorizedException('Unknown user');
    }
    return result;
  }

  @Post('magic-link/consume')
  consumeMagicLink(@Body() body: MagicLinkConsumeDto) {
    const result = this.authService.consumeMagicLink(
      MagicLinkConsumeSchema.parse(body),
    );
    if (!result) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }
    return result;
  }
}
