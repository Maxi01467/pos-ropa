const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Env vars used ONLY for database migrations – excluded from the desktop build
// to reduce the attack surface if someone extracts the installation directory.
// ---------------------------------------------------------------------------
const EXCLUDED_VARS = new Set(["DIRECT_URL"]);

function ensureDir(targetPath) {
    fs.mkdirSync(targetPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) return;
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
        ensureDir(targetPath);
        for (const entry of fs.readdirSync(sourcePath)) {
            copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
        }
        return;
    }
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
}

/**
 * Copies the .env but strips any variable whose key is in EXCLUDED_VARS.
 * Comments and blank lines are preserved.
 */
function writeFilteredEnv(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) return;

    const lines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
    const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return true; // keep
        const sep = trimmed.indexOf("=");
        if (sep === -1) return true; // keep malformed lines as-is
        const key = trimmed.slice(0, sep).trim();
        return !EXCLUDED_VARS.has(key);
    });

    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, filtered.join("\n"), "utf8");

    const removed = [...EXCLUDED_VARS].join(", ");
    console.log(`  .env filtrado – variables excluidas: ${removed}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

if (!fs.existsSync(path.join(standaloneRoot, "server.js"))) {
    throw new Error(
        "No se encontro .next/standalone/server.js. Ejecuta `npm run build` antes de empaquetar."
    );
}

copyRecursive(
    path.join(projectRoot, ".next", "static"),
    path.join(standaloneRoot, ".next", "static")
);
copyRecursive(path.join(projectRoot, "public"), path.join(standaloneRoot, "public"));
copyRecursive(path.join(projectRoot, "private"), path.join(standaloneRoot, "private"));

writeFilteredEnv(
    path.join(projectRoot, ".env"),
    path.join(standaloneRoot, ".env")
);

console.log("✅ Desktop build preparado correctamente.");
