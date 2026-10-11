// Собирает игру в один HTML-файл: стили и скрипты встраиваются, Three.js грузится с cdnjs.
// Использование:
//   node tools/build-single.mjs                  → dist/prichudlivaya-zhizn.html (полная страница)
//   node tools/build-single.mjs --fragment out.html → страница без обёртки <html>/<head>/<body>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args[0] === '--fragment';
const out = fragment ? args[1] : join(root, 'dist', 'prichudlivaya-zhizn.html');
if (!out) throw new Error('Укажи путь для --fragment');

let html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace(
  '<script src="vendor/three.min.js"></script>',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
);
html = html.replace(/<script src="(js\/[\w.]+)"><\/script>/g, (_, src) => {
  const code = readFileSync(join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>\n${code}\n</script>`;
});

if (fragment) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  // title и стили — в начало, мета-теги обёртка добавит сама
  const keep = head.replace(/<meta[^>]*>\s*/g, '');
  html = keep.trim() + '\n' + body.trim() + '\n';
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Готово: ${out} (${(html.length / 1024).toFixed(0)} КБ)`);
