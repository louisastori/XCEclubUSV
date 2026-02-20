const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceIndexPath = path.join(projectRoot, 'index.php');
const sourcePublicJsPath = path.join(projectRoot, 'src', 'public', 'js');
const outputDirPath = path.join(projectRoot, 'dist-pages');
const outputIndexPath = path.join(outputDirPath, 'index.html');
const output404Path = path.join(outputDirPath, '404.html');
const outputJsPath = path.join(outputDirPath, 'js');

if (!fs.existsSync(sourceIndexPath)) {
  throw new Error(`Source page not found: ${sourceIndexPath}`);
}

fs.rmSync(outputDirPath, { recursive: true, force: true });
fs.mkdirSync(outputDirPath, { recursive: true });

const sourceHtml = fs.readFileSync(sourceIndexPath, 'utf8');
fs.writeFileSync(outputIndexPath, sourceHtml, 'utf8');
fs.writeFileSync(output404Path, sourceHtml, 'utf8');
fs.writeFileSync(path.join(outputDirPath, '.nojekyll'), '', 'utf8');

if (fs.existsSync(sourcePublicJsPath)) {
  fs.cpSync(sourcePublicJsPath, outputJsPath, { recursive: true });
}

process.stdout.write(`GitHub Pages build ready in ${outputDirPath}\n`);
