const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const guests = fs.readFileSync(path.join(root, "convidados.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("usa viewport com áreas seguras nas duas páginas", () => {
  assert.match(index, /viewport-fit=cover/);
  assert.match(guests, /viewport-fit=cover/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("entrega arte responsiva e visualização ampliada", () => {
  assert.match(index, /convite-gabriele-480w\.jpg 480w/);
  assert.match(index, /convite-gabriele-720w\.jpg 720w/);
  assert.match(index, /data-art-dialog/);
  assert.match(index, /data-art-zoom/);
});

test("exige escolha explícita de presença", () => {
  assert.doesNotMatch(index, /name="attendance"[^>]*checked/);
  assert.match(index, /data-error-for="attendance"/);
});

test("usa o endereço exato no mapa e não solicita acompanhantes", () => {
  assert.match(index, /query=Diamond%20Espa%C3%A7o%20de%20Eventos/);
  assert.match(index, /Artur%20Trindade%2C%20766%20-%20Sra\.%20de%20F%C3%A1tima/);
  assert.doesNotMatch(index, /name="companions"/);
  assert.doesNotMatch(index, /Acompanhantes <small>\(opcional\)<\/small>/);
});

test("mantém controles legíveis e tocáveis no mobile", () => {
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /\.form-field input,[\s\S]*?font-size: 16px/);
  assert.match(styles, /\.mobile-rsvp-bar a[\s\S]*?min-height: 46px/);
  assert.match(styles, /\.row-action button,[\s\S]*?min-height: 44px/);
});

test("preserva cabeçalhos semânticos da lista no mobile", () => {
  assert.match(guests, /<thead>/);
  assert.match(styles, /\.guest-table thead \{[\s\S]*?position: absolute/);
});

test("carrega localmente as fontes editoriais", () => {
  assert.match(index, /assets\/fonts\/bodoni-moda-normal-latin\.woff2/);
  assert.match(index, /assets\/fonts\/manrope-latin\.woff2/);
  assert.doesNotMatch(index, /fonts\.googleapis\.com/);
  assert.match(styles, /@font-face[\s\S]*?font-family: "Bodoni Moda"/);
});
