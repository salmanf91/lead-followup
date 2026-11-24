import { JWT, GoogleAuth } from 'google-auth-library';
import { config } from '../config/index.js';
import fs from 'fs';

export interface ISheetReader {
  getSpreadsheetTabs(sheetId: string): Promise<string[]>;
  getSheetData(sheetId: string, tabName: string): Promise<string[][]>;
  getSheetRange?(sheetId: string, range: string): Promise<string[][]>;
  updateSheetCell?(sheetId: string, range: string, value: string): Promise<void>;
}

export class GoogleSheetsService implements ISheetReader {
  private authClient: JWT | GoogleAuth | null = null;

  private getAuthClient(): JWT | GoogleAuth {
    if (this.authClient) return this.authClient;

    // 1. Try credentials JSON directly from env
    if (config.google?.credentialsJson) {
      try {
        const credentials = JSON.parse(config.google.credentialsJson);
        this.authClient = new JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        return this.authClient;
      } catch (err) {
        console.warn('[GoogleSheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:', err);
      }
    }

    // 2. Try email + privateKey pair
    if (config.google?.serviceAccountEmail && config.google?.privateKey) {
      this.authClient = new JWT({
        email: config.google.serviceAccountEmail,
        key: config.google.privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return this.authClient;
    }

    // 3. Try credentials file path
    if (config.google?.keyFilePath && fs.existsSync(config.google.keyFilePath)) {
      this.authClient = new GoogleAuth({
        keyFile: config.google.keyFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return this.authClient;
    }

    throw new Error(
      'Google Service Account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  private async getAccessToken(): Promise<string> {
    const client = this.getAuthClient();
    if (client instanceof JWT) {
      const token = await client.authorize();
      if (!token.access_token) {
        throw new Error('Failed to obtain Google access token');
      }
      return token.access_token;
    } else {
      const credentials = await client.getAccessToken();
      if (!credentials) {
        throw new Error('Failed to obtain Google access token');
      }
      return typeof credentials === 'string' ? credentials : (credentials as any).token;
    }
  }

  /**
   * Fetches the titles of all tabs in the given Google Sheet.
   */
  async getSpreadsheetTabs(sheetId: string): Promise<string[]> {
    const token = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `Failed to fetch spreadsheet tabs (${res.status})`);
    }

    const data: any = await res.json();
    const sheets = data.sheets || [];
    return sheets
      .map((s: any) => s.properties?.title)
      .filter((title: any): title is string => typeof title === 'string' && title.trim().length > 0);
  }

  /**
   * Reads a specific cell range from a Google Sheet.
   */
  async getSheetRange(sheetId: string, range: string): Promise<string[][]> {
    const token = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `Failed to fetch sheet range ${range} (${res.status})`);
    }

    const data: any = await res.json();
    const rows: any[][] = data.values || [];
    return rows.map((r) => r.map((c) => (c !== undefined && c !== null ? String(c) : '')));
  }

  /**
   * Reads all row values from a given tab.
   */
  async getSheetData(sheetId: string, tabName: string): Promise<string[][]> {
    const token = await this.getAccessToken();
    const range = `'${tabName}'!A1:Z10000`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `Failed to fetch sheet data for ${tabName} (${res.status})`);
    }

    const data: any = await res.json();
    const rows: any[][] = data.values || [];
    return rows.map((r) => r.map((c) => (c !== undefined && c !== null ? String(c) : '')));
  }

  /**
   * Updates a single cell or range in a sheet tab (used for two-way write-back).
   */
  async updateSheetCell(sheetId: string, range: string, value: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[value]],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `Failed to update sheet cell (${res.status})`);
    }
  }
}

export const defaultSheetsService = new GoogleSheetsService();
