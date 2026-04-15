const fs = require('fs');
let content = fs.readFileSync('src/components/sidebar.tsx', 'utf-8');

// Replace import Link from "next/link"; with a dummy wrapper
content = content.replace('import Link from "next/link";', 'const Link = (props: any) => <a {...props} />;');

fs.writeFileSync('src/components/sidebar.tsx', content);
