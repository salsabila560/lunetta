import type { Metadata } from "next";
import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <section className="min-h-dvh bg-gradient-to-b from-ink to-night px-5 pb-32 pt-32">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-lg font-semibold text-lantern">Admin</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Panel pemilik koleksi</h1>
        <p className="mt-3 text-paper/80">
          Deploy kontrak dan kelola mint langsung dari wallet. Semua tombol di sini mengirim transaksi yang kamu tanda tangani sendiri;
          kontrak hanya menerima perintah dari wallet pemilik.
        </p>
        <div className="mt-8">
          <AdminPanel />
        </div>
      </div>
    </section>
  );
}
