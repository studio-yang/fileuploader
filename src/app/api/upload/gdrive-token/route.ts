import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    oauth2.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    const { token, res } = await oauth2.getAccessToken();
    if (!token) throw new Error('無法取得 OAuth Access Token');

    const expiresIn = (res?.data as any)?.expires_in ?? 3600;

    return NextResponse.json({
      accessToken: token,
      expiresAt:   Date.now() + expiresIn * 1000,
      folderId:    process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
    });
  } catch (err: any) {
    console.error('[gdrive-token]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
