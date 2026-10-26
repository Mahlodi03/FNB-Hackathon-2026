import { NextResponse } from "next/server";
export function notImplemented(feature: string) {
 return NextResponse.json({ error: `${feature} has not been wired up yet`, code: "NOT_IMPLEMENTED" }, {status:501});
}
