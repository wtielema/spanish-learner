import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity.js';

const ROLES = [
  {
    name: 'Operator',
    permissions: ['job:view', 'job:start', 'job:complete', 'qc:view', 'qc:inspect', 'recipe:view'],
  },
  {
    name: 'Supervisor',
    permissions: [
      'job:view', 'job:create', 'job:start', 'job:complete', 'job:hold', 'job:reassign',
      'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release',
      'recipe:view', 'config:view',
    ],
  },
  {
    name: 'QC Inspector',
    permissions: ['job:view', 'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release', 'recipe:view'],
  },
  {
    name: 'Engineer',
    permissions: [
      'job:view', 'qc:view', 'recipe:view', 'recipe:edit', 'recipe:approve', 'recipe:obsolete',
      'config:view', 'config:edit',
    ],
  },
  {
    name: 'Admin',
    permissions: [
      'job:view', 'job:create', 'job:start', 'job:complete', 'job:hold', 'job:reassign',
      'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release',
      'recipe:view', 'recipe:edit', 'recipe:approve', 'recipe:obsolete',
      'config:view', 'config:edit', 'user:view', 'user:manage',
    ],
  },
];

export async function seedRoles(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(Role);

  for (const roleData of ROLES) {
    const existing = await roleRepo.findOneBy({ name: roleData.name });
    if (!existing) {
      await roleRepo.save(roleRepo.create(roleData));
    }
  }

  console.log('Roles seeded successfully');
}
