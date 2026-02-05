import { db } from "../db";
import type { IReminderRepository } from "./reminder-repository.interface";
import { SQLiteReminderRepository } from "./sqlite-reminder-repository";
import type { IAppSettingsRepository } from "./app-settings-repository.interface";
import { SQLiteAppSettingsRepository } from "./sqlite-app-settings-repository";
import type { IAuthSchemaRepository } from "./auth-schema-repository.interface";
import { SQLiteAuthSchemaRepository } from "./sqlite-auth-schema-repository";

let repository: IReminderRepository | null = null;
let appSettingsRepository: IAppSettingsRepository | null = null;
let authSchemaRepository: IAuthSchemaRepository | null = null;

export function getReminderRepository(): IReminderRepository {
  if (!repository) {
    repository = new SQLiteReminderRepository(db);
  }
  return repository;
}

export function getAppSettingsRepository(): IAppSettingsRepository {
  if (!appSettingsRepository) {
    appSettingsRepository = new SQLiteAppSettingsRepository();
  }
  return appSettingsRepository;
}

export function getAuthSchemaRepository(): IAuthSchemaRepository {
  if (!authSchemaRepository) {
    authSchemaRepository = new SQLiteAuthSchemaRepository(db);
  }
  return authSchemaRepository;
}

export type { IReminderRepository };
export type { IAppSettingsRepository };
export type { IAuthSchemaRepository };
