const pl = require("../public/js/vendor/tau-prolog.js");
require("../public/js/vendor/tau-lists.js")(pl);
global.__pl = pl;
const E = require("../public/js/prolog-engine.js");

const cases = {
  enunciado: `miembro(X, [X|_]).
miembro(X, [_|T]) :- miembro(X, T).
?- miembro(b, [a,b,c]).`,
  var: `miembro(X, [X|_]).
miembro(X, [_|T]) :- miembro(X, T).
?- miembro(X, [a,b,c]).`,
  arit: `fact(0,1) :- !.
fact(N,F) :- N>0, N1 is N-1, fact(N1,F1), F is N*F1.
?- fact(5,F).
?- X is 7 mod 3 + 2**3.`,
  neg: `ave(tweety). ave(pingu). vuela(tweety).
no_vuela(X) :- ave(X), \\+ vuela(X).
?- no_vuela(X).
?- (vuela(pingu) ; ave(pingu)).`,
  corte: `max(X,Y,X) :- X >= Y, !.
max(_,Y,Y).
?- max(3,5,M).
?- max(7,5,M).`,
  append_lib: `?- append(X,Y,[1,2]).`,
  append_user: `append([],L,L).
append([H|T],L,[H|R]) :- append(T,L,R).
?- append([1],[2],R).`,
  err: `p(1).
?- q(X).`,
  loop: `p :- p.
?- p.`,
  syn: `p(1
?- p(X).`,
  write: `?- write(hola), nl, X = 1.`,
  div0: `?- X is 1/0.`,
  inst: `?- X is Y+1.`,
  ifthen: `?- ( 3 > 2 -> R = si ; R = no ).`,
  once: `n(1). n(2). n(3).
?- once(n(X)).
?- findall(X, n(X), L), length(L, N).
?- n(X), X > 1, !.`,
  neg2: `p(1).
?- \\+ p(2).
?- \\+ p(1).`,
};

(async () => {
  for (const [k, v] of Object.entries(cases)) {
    const r = await E.run(v);
    console.log("== " + k);
    for (const q of r.queries) console.log(q.goal, "=>", JSON.stringify(E.formatResponse(q)), q.output ? "out:" + JSON.stringify(q.output) : "", q.error || "");
  }
})();

