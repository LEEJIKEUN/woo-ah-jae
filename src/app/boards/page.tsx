import { redirect } from "next/navigation";

export default function BoardsRootPage() {
  redirect("/community/admissions?board=all");
}
