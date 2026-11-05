"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}

export type ClientPrefs = { currency: string; locale: string; timezone: string; weekStartsOn: number };
const PrefsContext = React.createContext<ClientPrefs>({ currency: "KES", locale: "en-KE", timezone: "Africa/Nairobi", weekStartsOn: 1 });

export function PrefsProvider({ value, children }: { value: ClientPrefs; children: React.ReactNode }) {
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
export const usePrefs = () => React.useContext(PrefsContext);
