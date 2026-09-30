import type { ReactNode } from "react";
import { TRPCProvider } from "../provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}