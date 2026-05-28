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

function ensureNextPackageEntrypoint() {
    const sourcePath = path.join(projectRoot, "node_modules", "next", "package.json");
    const targetPath = path.join(
        standaloneRoot,
        "node_modules",
        "next",
        "package.json"
    );

    if (!fs.existsSync(path.dirname(targetPath)) || fs.existsSync(targetPath)) return;

    if (!fs.existsSync(sourcePath)) {
        throw new Error(
            "No se encontro node_modules/next/package.json. Ejecuta `npm install` antes de empaquetar."
        );
    }

    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
    console.log("  next/package.json agregado al standalone.");
}

function ensureNextRuntime() {
    const sourcePath = path.join(projectRoot, "node_modules", "next", "dist");
    const targetPath = path.join(
        standaloneRoot,
        "node_modules",
        "next",
        "dist"
    );

    if (!fs.existsSync(sourcePath)) {
        throw new Error(
            "No se encontro node_modules/next/dist. Ejecuta `npm install` antes de empaquetar."
        );
    }

    copyRecursive(sourcePath, targetPath);
    console.log("  next/dist agregado al standalone.");
}

function ensureStandalonePackage(packagePath) {
    const sourcePath = path.join(projectRoot, "node_modules", ...packagePath.split("/"));
    const targetPath = path.join(
        standaloneRoot,
        "node_modules",
        ...packagePath.split("/")
    );

    if (!fs.existsSync(sourcePath)) {
        throw new Error(
            `No se encontro node_modules/${packagePath}. Ejecuta \`npm install\` antes de empaquetar.`
        );
    }

    copyRecursive(sourcePath, targetPath);
    console.log(`  ${packagePath} agregado al standalone.`);
}

function ensureNextDependencies() {
    const nextPackagePath = path.join(projectRoot, "node_modules", "next", "package.json");
    const nextPackage = JSON.parse(fs.readFileSync(nextPackagePath, "utf8"));
    const packageNames = Object.keys(nextPackage.dependencies ?? {});

    for (const packageName of packageNames) {
        ensureStandalonePackage(packageName);
    }
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

ensureNextPackageEntrypoint();
ensureNextRuntime();
ensureNextDependencies();
ensureStandalonePackage("react");
ensureStandalonePackage("react-dom");

writeFilteredEnv(
    path.join(projectRoot, ".env"),
    path.join(standaloneRoot, ".env")
);

console.log("✅ Desktop build preparado correctamente.");
