const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'src/app/api');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(apiDir, filePath => {
  if (!filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Fix `catch (error: any)` -> `catch (error: any)` wait, eslint just says Unexpected any.
  // We can do `catch (error)` and then `(error as Error).message`.
  content = content.replace(/catch \(error: any\)/g, 'catch (error)');
  content = content.replace(/error\.message/g, '(error as Error).message');
  
  // Fix entityId.toString() in activityLogs
  content = content.replace(/entityId:\s*([^,]+)\.id\.toString\(\)/g, 'entityId: $1.id');
  content = content.replace(/entityId:\s*([^\.]+)\.toString\(\)/g, 'entityId: Number($1)');

  // Fix id: authData.user.id in seed and salespeople
  content = content.replace(/id:\s*authData\.user\.id,\n\s*/g, '');

  // Fix unused vars warning
  content = content.replace(/import \{.*?sql.*?\} from 'drizzle-orm';/g, match => {
     if (filePath.includes('customers\\[id\\]\\history')) return match.replace(/sql,\s*/, '');
     return match;
  });
  
  // Fix count in reports/route.ts
  if (filePath.includes('reports\\route.ts') || filePath.includes('reports/route.ts')) {
     if (!content.includes('count')) {
         content = content.replace(/import { eq, and, sql, gte, lte } from 'drizzle-orm';/, "import { eq, and, sql, gte, lte, count } from 'drizzle-orm';");
     }
  }
  
  // Fix `req` unused var
  if (content.includes('export async function GET(req: NextRequest) {') && !content.includes('req.nextUrl')) {
      content = content.replace(/export async function GET\(req: NextRequest\)/, 'export async function GET()');
  }

  // Auth/Login errors - we might not have created these but they are there!
  // The system message shows errors in auth routes, let's fix them too if they exist.

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
