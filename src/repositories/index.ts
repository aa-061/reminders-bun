import { client } from "../db";
import type { IReminderRepository } from "./reminder-repository.interface";
import { SQLiteReminderRepository } from "./sqlite-reminder-repository";
import type { IAppSettingsRepository } from "./app-settings-repository.interface";
import { SQLiteAppSettingsRepository } from "./sqlite-app-settings-repository";
import type { IAuthSchemaRepository } from "./auth-schema-repository.interface";
import { SQLiteAuthSchemaRepository } from "./sqlite-auth-schema-repository";
import type { IModeRepository } from "./mode-repository.interface";
import { SQLiteModeRepository } from "./sqlite-mode-repository";

let repository: IReminderRepository | null = null;
let appSettingsRepository: IAppSettingsRepository | null = null;
let authSchemaRepository: IAuthSchemaRepository | null = null;
let modeRepository: IModeRepository | null = null;

export function getReminderRepository(): IReminderRepository {
  if (!repository) {
    repository = new SQLiteReminderRepository(client);
  }
  return repository;
}

export function getAppSettingsRepository(): IAppSettingsRepository {
  if (!appSettingsRepository) {
    appSettingsRepository = new SQLiteAppSettingsRepository(client);
  }
  return appSettingsRepository;
}

export function getAuthSchemaRepository(): IAuthSchemaRepository {
  if (!authSchemaRepository) {
    authSchemaRepository = new SQLiteAuthSchemaRepository(client);
  }
  return authSchemaRepository;
}

export function getModeRepository(): IModeRepository {
  if (!modeRepository) {
    modeRepository = new SQLiteModeRepository(client);
  }
  return modeRepository;
}

export type { IReminderRepository };
export type { IAppSettingsRepository };
export type { IAuthSchemaRepository };
export type { IModeRepository };
