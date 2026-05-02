const fs = require('fs');

function removeDemoMode(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove lines defining DEMO_MODE
  content = content.replace(/const DEMO_MODE = .*;\r?\n/, '');
  content = content.replace(/export const IS_DEMO_MODE = DEMO_MODE;\r?\n/, '');

  // Remove mock imports
  content = content.replace(/import\s*\{[^}]*mock[^}]*\}\s*from\s*'[^']+';\r?\n/, '');

  // Remove DEMO_MODE blocks
  let result = '';
  let i = 0;
  
  while (i < content.length) {
    const match = content.indexOf('if (DEMO_MODE) {', i);
    if (match === -1) {
      result += content.slice(i);
      break;
    }
    
    result += content.slice(i, match);
    i = match;
    
    let braceCount = 0;
    let inBlock = false;
    let foundOpen = false;
    
    for (; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundOpen = true;
      } else if (content[i] === '}') {
        braceCount--;
      }
      
      if (foundOpen && braceCount === 0) {
        i++; // skip the closing brace
        // optionally skip following newlines
        while (i < content.length && (content[i] === '\n' || content[i] === '\r')) {
          i++;
        }
        break;
      }
    }
  }

  // Same for IS_DEMO_MODE in profile.tsx
  let result2 = '';
  i = 0;
  while (i < result.length) {
    const match = result.indexOf('if (!IS_DEMO_MODE) {', i);
    if (match === -1) {
      result2 += result.slice(i);
      break;
    }
    
    result2 += result.slice(i, match);
    i = match;
    
    let braceCount = 0;
    let inBlock = false;
    let foundOpen = false;
    let blockContent = '';
    
    for (; i < result.length; i++) {
      if (result[i] === '{') {
        braceCount++;
        foundOpen = true;
        if (braceCount > 1) blockContent += result[i];
      } else if (result[i] === '}') {
        braceCount--;
        if (braceCount > 0) blockContent += result[i];
      } else {
        if (foundOpen) blockContent += result[i];
      }
      
      if (foundOpen && braceCount === 0) {
        i++;
        break;
      }
    }
    // We want to KEEP the inside of !IS_DEMO_MODE
    result2 += blockContent.slice(1, -1); // remove outer braces wait, I didn't add them.
    // Actually, !IS_DEMO_MODE in profile.tsx is simple. Let's handle profile.tsx separately.
  }

  fs.writeFileSync(filePath, result);
}

removeDemoMode('src/app/lib/api.ts');
console.log('Removed from api.ts');
