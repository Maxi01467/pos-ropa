import { getCurrentSession } from "@/app/actions/cash-actions";
import { getSellers } from "@/app/actions/pos-actions";

async function main() {
    try {
        console.log("Testing getSellers...");
        const sellers = await getSellers();
        console.log("getSellers Success:", sellers.length);
    } catch (e) {
        console.error("getSellers Error:", e);
    }

    try {
        console.log("Testing getCurrentSession...");
        const session = await getCurrentSession();
        console.log("getCurrentSession Success:", session ? session.id : null);
    } catch (e) {
        console.error("getCurrentSession Error:", e);
    }
}

main();
