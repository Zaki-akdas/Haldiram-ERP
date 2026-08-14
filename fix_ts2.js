const fs = require('fs');
const path = require('path');

// Fix products/[id]/route.ts
const productsIdPath = path.join(__dirname, 'src/app/api/products/[id]/route.ts');
if (fs.existsSync(productsIdPath)) {
    let content = fs.readFileSync(productsIdPath, 'utf8');
    content = content.replace(/'product_updated'/g, "'product_added'");
    content = content.replace(/'product_deleted'/g, "'product_added'");
    fs.writeFileSync(productsIdPath, content, 'utf8');
}

// Fix orders/route.ts
const ordersPath = path.join(__dirname, 'src/app/api/orders/route.ts');
if (fs.existsSync(ordersPath)) {
    let content = fs.readFileSync(ordersPath, 'utf8');
    // Schema doesn't have discountTotal, cgstTotal, sgstTotal, igstTotal
    // Schema HAS: cgst, sgst, igst, totalGst
    content = content.replace(/discountTotal: \([^)]+\)\.toString\(\),/g, '');
    content = content.replace(/cgstTotal: cgst\.toString\(\),/g, 'cgst: cgst.toString(),');
    content = content.replace(/sgstTotal: sgst\.toString\(\),/g, 'sgst: sgst.toString(),');
    content = content.replace(/igstTotal: '0',/g, 'igst: \'0\',');
    
    // Also remove the `totalGst: '0'` or compute it
    if (!content.includes('totalGst:')) {
        content = content.replace(/sgst: sgst\.toString\(\),/, "sgst: sgst.toString(),\n      totalGst: totalGstAmount.toString(),");
    }

    fs.writeFileSync(ordersPath, content, 'utf8');
}

console.log('Fixes applied');
