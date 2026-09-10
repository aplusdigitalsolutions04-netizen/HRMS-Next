import { query } from './db';
import { RowDataPacket } from 'mysql2';

async function getTeamOfficeSettings(): Promise<Record<string, string>> {
  const rows = await query<RowDataPacket[]>(
    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('teamoffice_api_url','teamoffice_corp_id','teamoffice_username','teamoffice_password')"
  );
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.setting_key] = r.setting_value;
  return settings;
}

export async function getTeamOfficeApiUrl(): Promise<string> {
  const settings = await getTeamOfficeSettings();
  let apiUrl = settings.teamoffice_api_url?.trim() || process.env.TEAMOFFICE_API_URL?.trim();
  if (!apiUrl) apiUrl = 'https://api.etimeoffice.com/api';
  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
  return apiUrl;
}

export async function getTeamOfficeApiKey(): Promise<string | undefined> {
  const settings = await getTeamOfficeSettings();
  let apiKey = process.env.TEAMOFFICE_API_KEY?.trim();
  const corpId = settings.teamoffice_corp_id?.trim() || process.env.TEAMOFFICE_CORP_ID?.trim();
  const username = settings.teamoffice_username?.trim() || process.env.TEAMOFFICE_USERNAME?.trim();
  const password = settings.teamoffice_password?.trim() || process.env.TEAMOFFICE_PASSWORD?.trim();
  if (corpId && username && password) {
    apiKey = Buffer.from(`${corpId}:${username}:${password}:True`).toString('base64');
  }
  return apiKey;
}
