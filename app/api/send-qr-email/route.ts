import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'notifications_disabled' }, { status: 410 })
}
