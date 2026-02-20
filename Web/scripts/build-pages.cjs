const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourcePagesPath = path.join(projectRoot, 'pages');
const sourcePublicJsPath = path.join(projectRoot, 'src', 'public', 'js');
const outputDirPath = path.join(projectRoot, 'dist-pages');
const outputIndexPath = path.join(outputDirPath, 'index.html');
const outputJsPath = path.join(outputDirPath, 'js');

if (!fs.existsSync(sourcePagesPath)) {
  throw new Error(`Pages source folder not found: ${sourcePagesPath}`);
}

fs.rmSync(outputDirPath, { recursive: true, force: true });
fs.cpSync(sourcePagesPath, outputDirPath, { recursive: true, force: true });

if (fs.existsSync(sourcePublicJsPath)) {
  fs.cpSync(sourcePublicJsPath, outputJsPath, { recursive: true, force: true });
}

if (!fs.existsSync(outputIndexPath)) {
  throw new Error(`Required entry file missing after copy: ${outputIndexPath}`);
}

const output404Path = path.join(outputDirPath, '404.html');
if (!fs.existsSync(output404Path)) {
  fs.copyFileSync(outputIndexPath, output404Path);
}

fs.writeFileSync(path.join(outputDirPath, '.nojekyll'), '', 'utf8');

process.stdout.write(`GitHub Pages build ready in ${outputDirPath}\n`);
