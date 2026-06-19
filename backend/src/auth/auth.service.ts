import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  restaurantId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: {
    email: string;
    password: string;
    name: string;
    restaurantName: string;
    restaurantLocation: string;
  }) {
    const existing = await this.prisma.user.findFirst({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException(
        'An account with this email already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: data.restaurantName,
        location: data.restaurantLocation,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: 'owner',
        restaurantId: restaurant.id,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          location: restaurant.location,
        },
      },
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { restaurant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurant: {
          id: user.restaurant.id,
          name: user.restaurant.name,
          location: user.restaurant.location,
        },
      },
    };
  }

  async loginAsUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { restaurant: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurant: {
          id: user.restaurant.id,
          name: user.restaurant.name,
          location: user.restaurant.location,
        },
      },
    };
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { restaurant: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantId: user.restaurantId,
      restaurant: user.restaurant,
    };
  }
}
