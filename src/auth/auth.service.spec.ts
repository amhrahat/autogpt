import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.module';

const mockUser = {
  id: 'u1',
  email: 'test@example.com',
  passwordHash: bcrypt.hashSync('Passw0rd123', 4),
  name: 'Test',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    subscription: { create: jest.Mock };
    session: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      subscription: { create: jest.fn() },
      session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token'), verifyAsync: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (k: string) => `${k}-value`,
            get: (k: string, d?: unknown) => d,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('registers a user and creates a FREE subscription', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: { email: string; passwordHash: string; name?: string } }) => ({
      ...mockUser,
      id: 'new',
      email: data.email,
      name: data.name,
    }));
    prisma.subscription.create.mockResolvedValue({});

    const result = await service.register({
      email: 'New@Example.com',
      password: 'Passw0rd123',
      name: 'New',
    }, {});

    expect(result.user.email).toBe('new@example.com');
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'FREE' }) }),
    );
    expect(result.accessToken).toBe('token');
    expect(result.refreshToken).toBe('token');
    expect(prisma.session.create).toHaveBeenCalled();
  });

  it('rejects duplicate email on register', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.register({ email: 'test@example.com', password: 'Passw0rd123' }, {}),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('logs in with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    const result = await service.login(
      { email: 'test@example.com', password: 'Passw0rd123' },
      {},
    );
    expect(result.user.id).toBe('u1');
    expect(result.accessToken).toBe('token');
  });

  it('rejects wrong password without leaking which field failed', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.login({ email: 'test@example.com', password: 'WrongPass1' }, {}),
    ).rejects.toThrow('Invalid credentials');
  });

  it('rotates the refresh token and revokes the old session', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'x', role: 'USER', type: 'refresh' });
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: mockUser,
    });

    const result = await service.refresh('old-token', {});
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(result.refreshToken).toBe('token');
  });

  it('rejects reuse of a revoked refresh token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'x', role: 'USER', type: 'refresh' });
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: mockUser,
    });
    await expect(service.refresh('old-token', {})).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });

  it('rejects an access token used as a refresh token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'x', role: 'USER' });
    await expect(service.refresh('access-token', {})).rejects.toThrow('Invalid refresh token');
  });
});
