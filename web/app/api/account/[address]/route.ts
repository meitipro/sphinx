import { NextResponse } from 'next/server';

import { getAccount, readError } from '@/lib/read';

/**
 * One address's entries on every riddle and its unclaimed balance, for the
 * browser pages that know the connected wallet (the player page and the
 * claim box). The same cached read the server pages use.
 */
export async function GET(_request: Request, { params }: RouteContext<'/api/account/[address]'>) {
  const { address } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: 'Not an address.' }, { status: 400 });
  try {
    return NextResponse.json(await getAccount(address));
  } catch (error) {
    return NextResponse.json({ error: readError(error) }, { status: 502 });
  }
}
