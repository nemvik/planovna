import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { LoginSchema } from './dto/auth.dto';
import type { LoginDto } from './dto/auth.dto';
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
}
