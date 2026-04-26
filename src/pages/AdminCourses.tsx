import CrudListManager from "@/components/CrudListManager";

export default function AdminCourses() {
  return (
    <CrudListManager
      table="courses"
      title="Manage Courses"
      description="Add, rename, or remove participating courses (e.g., BSIT, BSHM)."
      itemLabel="Course"
      placeholder="e.g. BSIT"
    />
  );
}
