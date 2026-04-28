import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

export enum UserRole {
  ANALYST = 'analyst',
  ADMIN = 'admin',
}

@Entity()
export class User {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  github_id!: string;

  @Column({ type: 'varchar' })
  username!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  avatar_url!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ANALYST })
  role!: UserRole;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'timestamp' })
  last_login!: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @BeforeInsert()
  generateId() {
    this.id = uuidv7();
  }
}
