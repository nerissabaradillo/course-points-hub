import CrudListManager from "@/components/CrudListManager";

export default function AdminEvents() {
  return (
    <CrudListManager
      table="events"
      title="Manage Events"
      description="Add, rename, or remove sports events (e.g., Basketball, Volleyball)."
      itemLabel="Event"
      placeholder="e.g. Basketball"
    />
  );
}
