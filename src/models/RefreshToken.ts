import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

@Entity()
export class RefreshToken {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  user_id!: string;

  @Column({ type: 'varchar' })
  token_hash!: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamp' })
  revoked_at!: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @BeforeInsert()
  generateId() {
    this.id = uuidv7();
  }
}
