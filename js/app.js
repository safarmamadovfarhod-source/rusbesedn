/* Общий объект приложения: заполняется в main.js, используется экранами (избегаем циклических импортов). */
export const app = {
  go: null, back: null, render: null, toast: null,
  ACT: {}, R: {},
  cur: "lang", stack: [], view: "lang",
  st: { diag: null, ex: null, shadow: null, dlg: null, skip: null, rev: null, sum: null, sheet: null, rep: null, lessonStart: null },
  lastMailto: null
};
