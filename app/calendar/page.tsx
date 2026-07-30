import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeftIcon, CalendarIcon } from "@/app/components/icons";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="hero-gradient relative flex h-screen flex-col items-center justify-center gap-4 overflow-hidden text-center">
      <Link
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center gap-1.5 text-sm font-semibold text-[#034F46]/60 transition hover:text-[#034F46] md:left-8 md:top-8"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back
      </Link>

      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
        <CalendarIcon className="h-7 w-7 text-[#034F46]/70" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-[#034F46]">Calendar</h1>
      <p className="max-w-sm text-sm text-[#034F46]/60">
        This is under development — soon you&apos;ll see every recipient&apos;s upcoming occasions here.
      </p>
    </div>
  );
}
