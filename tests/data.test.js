const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");

function createDataLayer() {
  const storage = new Map();
  const window = { dispatchEvent() {} };
  const sandbox = {
    window,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    crypto: { randomUUID: () => "fixed-test-id" },
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
    console,
  };

  vm.runInNewContext(source, sandbox);
  return window.GabrieleRSVP;
}

test("separa acompanhantes e remove nomes repetidos", () => {
  const data = createDataLayer();
  const companions = data.parseCompanions("Ana Silva\nJoão Souza, ana silva; Maria Luz");

  assert.deepEqual(Array.from(companions), ["Ana Silva", "João Souza", "Maria Luz"]);
});

test("salva uma confirmação e calcula o total de pessoas", () => {
  const data = createDataLayer();
  const result = data.upsert({
    name: "Pedro Henrique",
    attendance: "sim",
    phone: "(31) 99999-9999",
    companions: "Ana Silva\nJoão Souza",
    dietary: "Vegetariano",
    message: "Estarei lá!",
  });

  assert.equal(result.updated, false);
  assert.equal(data.load().length, 1);
  assert.equal(data.getPersonCount(result.response), 3);
});

test("atualiza a resposta do mesmo nome sem criar duplicidade", () => {
  const data = createDataLayer();
  data.upsert({ name: "Lívia Costa", attendance: "sim", companions: "Bia Costa" });
  const result = data.upsert({ name: "Livia Costa", attendance: "nao", companions: "Bia Costa" });

  assert.equal(result.updated, true);
  assert.equal(data.load().length, 1);
  assert.equal(result.response.attendance, "nao");
  assert.equal(result.response.companions.length, 0);
  assert.equal(data.getPersonCount(result.response), 0);
});

test("remove uma resposta pelo identificador", () => {
  const data = createDataLayer();
  const { response } = data.upsert({ name: "Marina Lopes", attendance: "sim" });
  data.remove(response.id);

  assert.equal(data.load().length, 0);
});
