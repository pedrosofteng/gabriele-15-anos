const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createDataLayer(fetchImpl) {
  const events = [];
  const window = {
    dispatchEvent(event) {
      events.push(event.type);
    },
  };
  const sandbox = {
    window,
    fetch: fetchImpl,
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
    console,
  };

  vm.runInNewContext(source, sandbox);
  return { data: window.GabrieleRSVP, events };
}

test("separa acompanhantes e remove nomes repetidos", () => {
  const { data } = createDataLayer(async () => jsonResponse({}));
  const companions = data.parseCompanions("Ana Silva\nJoão Souza, ana silva; Maria Luz");

  assert.deepEqual(Array.from(companions), ["Ana Silva", "João Souza", "Maria Luz"]);
});

test("envia confirmação limpa para a API compartilhada", async () => {
  let captured;
  const response = {
    id: "fixed-test-id",
    name: "Pedro Henrique",
    attendance: "sim",
    phone: "(31) 99999-9999",
    companions: ["Ana Silva", "João Souza"],
  };
  const { data, events } = createDataLayer(async (url, options) => {
    captured = { url, options };
    return jsonResponse({ ok: true, response, updated: false }, 201);
  });

  const result = await data.upsert({
    name: "  Pedro   Henrique ",
    attendance: "sim",
    phone: "(31) 99999-9999",
    companions: "Ana Silva\nJoão Souza, ana silva",
    dietary: " Vegetariano ",
    message: " Estarei lá! ",
  });
  const body = JSON.parse(captured.options.body);

  assert.equal(captured.url, "/api/rsvps");
  assert.equal(captured.options.method, "POST");
  assert.equal(body.name, "Pedro Henrique");
  assert.deepEqual(body.companions, ["Ana Silva", "João Souza"]);
  assert.equal(result.updated, false);
  assert.equal(data.getPersonCount(result.response), 3);
  assert.deepEqual(events, ["gabriele:rsvps-changed"]);
});

test("carrega do banco apenas a lista retornada pela API", async () => {
  const items = [{ id: "1", name: "Lívia Costa", attendance: "nao", companions: [] }];
  const { data } = createDataLayer(async (url, options) => {
    assert.equal(url, "/api/rsvps");
    assert.equal(options.cache, "no-store");
    return jsonResponse({ ok: true, items });
  });

  assert.deepEqual(await data.load(), items);
});

test("remove uma resposta usando o identificador codificado", async () => {
  let captured;
  const { data } = createDataLayer(async (url, options) => {
    captured = { url, options };
    return jsonResponse({ ok: true, removed: 1 });
  });

  await data.remove("id com espaço");

  assert.equal(captured.url, "/api/rsvps?id=id%20com%20espa%C3%A7o");
  assert.equal(captured.options.method, "DELETE");
});

test("propaga a mensagem estruturada de erro da API", async () => {
  const { data } = createDataLayer(async () =>
    jsonResponse({ ok: false, error: { code: "INVALID_NAME", message: "Nome inválido." } }, 400),
  );

  await assert.rejects(() => data.load(), (error) => {
    assert.equal(error.code, "INVALID_NAME");
    assert.equal(error.message, "Nome inválido.");
    return true;
  });
});
