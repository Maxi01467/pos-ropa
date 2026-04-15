const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/actions/*.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{.*?unstable_cache.*?\} from "next\/cache";/g, (match) => {
    return match.replace(/,? unstable_cache,?/, '').replace(/\{ ,/, '{ ').replace(/, \}/, ' }');
  });
  
  if (content.includes("import { undefined } from \"next/cache\";")) {
    content = content.replace("import { undefined } from \"next/cache\";\n", "");
  }
  if (content.includes("import {  } from \"next/cache\";")) {
    content = content.replace("import {  } from \"next/cache\";\n", "");
  }
  if (content.includes("import {\n    revalidateTag,\n    unstable_cache\n} from \"next/cache\";")) {
    content = content.replace(/import \{\n    revalidateTag,\n    unstable_cache\n\} from "next\/cache";/g, 'import { revalidateTag } from "next/cache";');
  }

  // Also catch lines where unstable_cache was the only import.
  content = content.replace(/import \{ unstable_cache \} from "next\/cache";\n/g, '');
  content = content.replace(/import \{ revalidateTag, unstable_cache \} from "next\/cache";/g, 'import { revalidateTag } from "next/cache";');
  content = content.replace(/import \{ unstable_cache, revalidateTag \} from "next\/cache";/g, 'import { revalidateTag } from "next/cache";');

  // Add our custom import below the local imports or at the top
  if (!content.includes('import { unstable_cache } from "@/lib/cache-tags";') && content.includes('unstable_cache(')) {
    content = content.replace(/import \{ CACHE_TAGS \} from "@\/lib\/cache-tags";/g, 'import { CACHE_TAGS, unstable_cache } from "@/lib/cache-tags";');
  }
  
  fs.writeFileSync(file, content);
});
