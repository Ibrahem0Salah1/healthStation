"use client";
import React, { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/utils/trpc";

export function TRPCProvider({children}: {children: ReactNode}) {
   const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      }),
    );

    const [trpcClient] = useState(()=> trpc.createClient({
        links : [
            loggerLink({
                enabled : (op) => process.env.NODE_ENV === "development" ||
                (op.direction === "down" && op.result instanceof Error),
            }),
            httpBatchLink({
                url: "/api/trpc",
                transformer: superjson
            })
        ]
    }))

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    )
}