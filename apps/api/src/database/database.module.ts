import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as entities from 'shared';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        if (!dbUrl) {
          throw new Error('DATABASE_URL environment variable is missing');
        }

        const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
        const nodeEnv = configService.get<string>('NODE_ENV');

        // Managed Postgres (Render/Railway/Neon/Supabase) requires SSL. Enable it
        // for Postgres when DATABASE_SSL=true or when running in production.
        const useSsl =
          isPostgres &&
          (configService.get<string>('DATABASE_SSL') === 'true' || nodeEnv === 'production');

        // We filter imported modules to retrieve only class references (TypeORM entities)
        const entityClasses = Object.values(entities).filter(
          (val) => typeof val === 'function' && val.name && val.prototype
        );

        return {
          type: (isPostgres ? 'postgres' : 'mysql') as any,
          url: dbUrl,
          entities: entityClasses as any,
          synchronize: true, // For portfolio/prototype, synchronize is excellent for out-of-the-box running
          ssl: useSsl ? { rejectUnauthorized: false } : undefined,
          logging: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
