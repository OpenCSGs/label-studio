#!/usr/bin/env node

/**
 * 检查文件中是否有重复的 useTranslation() 声明
 * 使用方法: node scripts/check-duplicate-translations.js [文件路径]
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const useTranslationDeclarations = [];
  const tDeclarations = [];
  
  lines.forEach((line, index) => {
    // 检查 useTranslation() 导入
    if (line.includes('useTranslation') && line.includes('from')) {
      // 这是导入语句，跳过
      return;
    }
    
    // 检查 const { t } = useTranslation(); 或 const { t, i18n } = useTranslation();
    const tMatch = line.match(/const\s*\{\s*([^}]*)\s*\}\s*=\s*useTranslation\(\)/);
    if (tMatch) {
      const vars = tMatch[1].split(',').map(v => v.trim());
      if (vars.includes('t')) {
        useTranslationDeclarations.push({
          line: index + 1,
          content: line.trim(),
          vars: vars
        });
      }
    }
    
    // 检查单独的 const { t } 声明（可能是重复的）
    if (line.match(/const\s*\{\s*t\s*\}\s*=/)) {
      tDeclarations.push({
        line: index + 1,
        content: line.trim()
      });
    }
  });
  
  if (useTranslationDeclarations.length > 1) {
    console.error(`❌ 发现重复的 useTranslation() 声明在文件: ${filePath}`);
    useTranslationDeclarations.forEach(decl => {
      console.error(`   第 ${decl.line} 行: ${decl.content}`);
    });
    return false;
  }
  
  return true;
}

// 如果提供了文件路径，检查该文件
const filePath = process.argv[2];
if (filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }
  
  const isValid = checkFile(filePath);
  process.exit(isValid ? 0 : 1);
} else {
  console.log('使用方法: node scripts/check-duplicate-translations.js <文件路径>');
  console.log('示例: node scripts/check-duplicate-translations.js src/pages/CreateProject/Import/Import.jsx');
}
