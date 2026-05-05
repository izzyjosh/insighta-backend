import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum AgeGroup {
  CHILD = 'child',
  TEENAGER = 'teenager',
  ADULT = 'adult',
  SENIOR = 'senior',
}
@Entity()
export class Profile {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  name!: string;

  @Column({ type: 'enum', enum: Gender })
  @Index()
  gender!: Gender;

  @Column({ type: 'float' })
  gender_probability!: number;

  @Column({ type: 'int' })
  age!: number;

  @Column({ type: 'enum', enum: AgeGroup })
  @Index()
  age_group!: AgeGroup;

  @Column({ type: 'varchar', length: 2 })
  @Index()
  country_id!: string;

  @Column({ type: 'varchar' })
  country_name!: string;

  @Column({ type: 'float' })
  country_probability!: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @BeforeInsert()
  generateId() {
    this.id = uuidv7();
  }
}
