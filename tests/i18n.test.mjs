import test from "node:test"; import assert from "node:assert"; import fs from "node:fs"; import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const I = JSON.parse(fs.readFileSync(path.join(root, "data/i18n.json"), "utf8"));
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p); } })(path.join(root, "js"));
const src = files.map(f => fs.readFileSync(f, "utf8")).join("\n");
test("ru и tg содержат одни и те же ключи", () => { assert.deepStrictEqual(Object.keys(I.ru).sort(), Object.keys(I.tg).sort()); });
test("нет пустых строк", () => { for (const l of ["ru", "tg"]) for (const [k, v] of Object.entries(I[l])) assert.ok(String(v).trim(), l + ":" + k); });
test("параметры {x} совпадают в ru и tg", () => { for (const k of Object.keys(I.ru)) { const a = (I.ru[k].match(/\{\w+\}/g) || []).sort().join(), b = (I.tg[k].match(/\{\w+\}/g) || []).sort().join(); assert.strictEqual(a, b, k); } });
test("все ключи t('...') из кода есть в словаре", () => {
  const used = new Set([...src.matchAll(/\bt\(\s*"([a-z0-9_]+)"/g)].map(m => m[1]));
  const miss = [...used].filter(k => !(k in I.ru) && !Object.keys(I.ru).some(x => x.startsWith(k))); /* rh_, rk, plan — префиксы динамических ключей */ assert.deepStrictEqual(miss, []);
});
