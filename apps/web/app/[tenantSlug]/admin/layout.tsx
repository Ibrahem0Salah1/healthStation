import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminHeader, AdminNav } from "@/components/admin/shell";
import { NoAccess } from "@/components/admin/no-access";
import { checkRole } from "@/server/guards";
import { api } from "@/server/caller";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children, params }: LayoutProps) {
  const { tenantSlug } = await params;

  const check = await checkRole(tenantSlug);
  if(check.status === 'not-found') notFound();
  if (check.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/${tenantSlug}/admin`)}`);
  }
  if(check.status === 'forbidden') {
    return <NoAccess/>
  }
  const role = check.role;
  const caller = await api();
  const tenant = await caller.tenant.getBySlug({tenantSlug});
  const branding = { id: tenant.id, name: tenant.name, slug: tenant.slug };
  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader tenant={branding} role={role} />

      <div className="flex-1 px-6 md:px-10 mx-auto max-w-[1400px] py-8 md:py-10">
        {/*
          Sidebar on desktop, horizontal scroll strip on mobile. Same pattern
          as the storefront nav: `md:` flips the flex direction and the
          overflow. The sidebar is NOT sticky on mobile — there is nowhere
          useful to stick it once the header is already sticky.
        */}
        <div className="md:grid md:grid-cols-[200px_1fr] md:gap-10 lg:gap-14">
          <aside className="mb-6 md:mb-0">
            <div className="md:sticky md:top-24">
              <AdminNav tenant={branding} />
            </div>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
