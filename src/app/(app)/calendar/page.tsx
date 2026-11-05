import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "./view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await requireUserPage();
  return (
    <div>
      <PageHeader title="Calendar" description="Tasks, appointments, bill due dates, loan repayments, renewals and project deadlines in one place." />
      <CalendarView weekStartsOn={user.prefs.weekStartsOn} />
    </div>
  );
}
