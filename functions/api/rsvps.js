const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function normalizePhone(value) {
  let digits = cleanText(value).replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

function cleanCompanions(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[\n,;]+/);
  const seen = new Set();

  return source
    .map(cleanText)
    .filter((name) => {
      const key = normalizeName(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function validateLength(value, maximum, label) {
  if (value.length > maximum) {
    throw new ApiError(400, "INVALID_FIELD", `${label} ultrapassa o tamanho permitido.`);
  }
}

function validatePayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError(400, "INVALID_BODY", "Envie os dados da confirmação em formato JSON.");
  }

  const attendance = raw.attendance === "nao" ? "nao" : raw.attendance === "sim" ? "sim" : "";
  const name = cleanText(raw.name);
  const phone = cleanText(raw.phone);
  const companions = attendance === "sim" ? cleanCompanions(raw.companions) : [];
  const dietary = attendance === "sim" ? cleanText(raw.dietary) : "";
  const message = cleanText(raw.message);

  if (!attendance) throw new ApiError(400, "INVALID_ATTENDANCE", "Escolha se poderá estar presente.");
  if (name.length < 3 || !name.includes(" ")) {
    throw new ApiError(400, "INVALID_NAME", "Digite seu nome e sobrenome para continuar.");
  }

  validateLength(name, 90, "O nome");
  validateLength(phone, 20, "O telefone");
  validateLength(dietary, 120, "A restrição alimentar");
  validateLength(message, 420, "A mensagem");
  if (companions.length > 12) {
    throw new ApiError(400, "TOO_MANY_COMPANIONS", "Informe no máximo 12 acompanhantes.");
  }
  companions.forEach((companion) => validateLength(companion, 90, "O nome do acompanhante"));

  return {
    attendance,
    name,
    normalizedName: normalizeName(name),
    phone,
    normalizedPhone: normalizePhone(phone),
    companions,
    dietary,
    message,
  };
}

function rowToRsvp(row) {
  let companions = [];
  try {
    const parsed = JSON.parse(row.companions_json || "[]");
    if (Array.isArray(parsed)) companions = parsed;
  } catch {
    companions = [];
  }

  return {
    id: row.id,
    name: row.name,
    attendance: row.attendance,
    phone: row.phone,
    companions,
    dietary: row.dietary,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) {
    throw new ApiError(413, "BODY_TOO_LARGE", "A solicitação é maior que o permitido.");
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie os dados em formato JSON.");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "O conteúdo enviado não é um JSON válido.");
  }
}

function handleError(error, request) {
  if (error instanceof ApiError) {
    return json({ ok: false, error: { code: error.code, message: error.message } }, error.status);
  }

  console.error(
    JSON.stringify({
      event: "rsvp_api_error",
      method: request.method,
      path: new URL(request.url).pathname,
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  return json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível concluir a solicitação agora." } },
    500,
  );
}

export async function onRequestGet(context) {
  try {
    const database = context.env.DB.withSession("first-primary");
    const result = await database.prepare(
      `SELECT id, name, attendance, phone, companions_json, dietary, message, created_at, updated_at
       FROM rsvps
       ORDER BY updated_at DESC`,
    ).all();
    return json({ ok: true, items: result.results.map(rowToRsvp) });
  } catch (error) {
    return handleError(error, context.request);
  }
}

export async function onRequestPost(context) {
  try {
    const data = validatePayload(await readJson(context.request));
    const database = context.env.DB.withSession("first-primary");
    const existing = await database.prepare(
      `SELECT id, created_at
       FROM rsvps
       WHERE normalized_name = ?1 OR (?2 <> '' AND normalized_phone = ?2)
       ORDER BY CASE WHEN normalized_name = ?1 THEN 0 ELSE 1 END
       LIMIT 1`,
    )
      .bind(data.normalizedName, data.normalizedPhone)
      .first();
    const now = new Date().toISOString();
    const id = existing?.id || crypto.randomUUID();
    const createdAt = existing?.created_at || now;
    const values = [
      data.name,
      data.normalizedName,
      data.attendance,
      data.phone,
      data.normalizedPhone,
      JSON.stringify(data.companions),
      data.dietary,
      data.message,
      now,
      id,
    ];

    if (existing) {
      await database.prepare(
        `UPDATE rsvps
         SET name = ?1, normalized_name = ?2, attendance = ?3, phone = ?4,
             normalized_phone = ?5, companions_json = ?6, dietary = ?7, message = ?8, updated_at = ?9
         WHERE id = ?10`,
      )
        .bind(...values)
        .run();
    } else {
      await database.prepare(
        `INSERT INTO rsvps
          (name, normalized_name, attendance, phone, normalized_phone, companions_json,
           dietary, message, updated_at, id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
        .bind(...values, createdAt)
        .run();
    }

    return json(
      {
        ok: true,
        updated: Boolean(existing),
        response: rowToRsvp({
          id,
          name: data.name,
          attendance: data.attendance,
          phone: data.phone,
          companions_json: JSON.stringify(data.companions),
          dietary: data.dietary,
          message: data.message,
          created_at: createdAt,
          updated_at: now,
        }),
      },
      existing ? 200 : 201,
    );
  } catch (error) {
    return handleError(error, context.request);
  }
}

export async function onRequestDelete(context) {
  try {
    const id = cleanText(new URL(context.request.url).searchParams.get("id"));
    if (id) {
      if (id.length > 100) throw new ApiError(400, "INVALID_ID", "Identificador inválido.");
      const result = await context.env.DB.prepare("DELETE FROM rsvps WHERE id = ?1").bind(id).run();
      if (!result.meta.changes) throw new ApiError(404, "NOT_FOUND", "A resposta não foi encontrada.");
      return json({ ok: true, removed: 1 });
    }

    const body = await readJson(context.request);
    if (body?.confirmation !== "REMOVER_TODAS") {
      throw new ApiError(400, "CONFIRMATION_REQUIRED", "Confirme a remoção de todas as respostas.");
    }
    const result = await context.env.DB.prepare("DELETE FROM rsvps").run();
    return json({ ok: true, removed: result.meta.changes || 0 });
  } catch (error) {
    return handleError(error, context.request);
  }
}
