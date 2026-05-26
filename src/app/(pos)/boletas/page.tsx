import { redirect } from "next/navigation";

export default function BoletasRedirectPage() {
    redirect("/caja?tab=historial");
}
