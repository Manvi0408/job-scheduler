import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: ('OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER')[]) => SetMetadata('roles', roles);
