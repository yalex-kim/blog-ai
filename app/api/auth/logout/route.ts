import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: '로그아웃 되었습니다.' });

  // Clear session cookie
  response.cookies.delete('session');

  return response;
}
