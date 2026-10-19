/* Ejemplos precargados, uno por cada tema de la Unidad III */
window.PROLOG_EXAMPLES = [
  {
    id: "enunciado",
    tema: "Ejemplo del enunciado",
    titulo: "miembro/2 — pertenencia a una lista",
    codigo: `miembro(X, [X|_]).
miembro(X, [_|T]) :- miembro(X, T).
?- miembro(b, [a,b,c]).`,
  },
  {
    id: "hechos",
    tema: "Hechos, reglas y variables",
    titulo: "Árbol genealógico",
    codigo: `% Hechos
padre(juan, pedro).
padre(juan, maria).
padre(pedro, ana).
madre(laura, pedro).

% Reglas
abuelo(X, Z) :- padre(X, Y), padre(Y, Z).
hermano(X, Y) :- padre(P, X), padre(P, Y), X \\= Y.

?- abuelo(juan, Quien).
?- hermano(pedro, H).`,
  },
  {
    id: "aritmetica",
    tema: "Operadores aritméticos",
    titulo: "Factorial y operadores",
    codigo: `factorial(0, 1) :- !.
factorial(N, F) :-
    N > 0,
    N1 is N - 1,
    factorial(N1, F1),
    F is N * F1.

?- factorial(5, F).
?- X is 17 mod 5 + 2 * 3 - 10 // 4.
?- X is 2 ** 10, Y is sqrt(81), Z is max(3, 9).`,
  },
  {
    id: "listas",
    tema: "Listas",
    titulo: "Cabeza, cola, append y longitud",
    codigo: `longitud([], 0).
longitud([_|T], N) :- longitud(T, N0), N is N0 + 1.

concatenar([], L, L).
concatenar([H|T], L, [H|R]) :- concatenar(T, L, R).

?- longitud([a,b,c,d], N).
?- concatenar([1,2], [3,4], R).
?- [H|T] = [rojo, verde, azul].
?- concatenar(X, Y, [1,2]).`,
  },
  {
    id: "negacion",
    tema: "Negación como fallo y disyunciones",
    titulo: "Aves que no vuelan",
    codigo: `ave(tweety).
ave(pingu).
ave(kiwi).
vuela(tweety).

% Negación como fallo: \\+ tiene éxito si el objetivo FALLA
no_vuela(X) :- ave(X), \\+ vuela(X).

% Disyunción (;)
animal_conocido(X) :- ave(X) ; perro(X).
perro(firulais).

?- no_vuela(X).
?- animal_conocido(firulais).
?- \\+ ave(firulais).`,
  },
  {
    id: "clausulas",
    tema: "Interpretación de cláusulas",
    titulo: "Orden de cláusulas y backtracking",
    codigo: `color(rojo).
color(verde).
color(azul).

combinacion(X, Y) :- color(X), color(Y), X \\= Y.

?- color(X).
?- combinacion(rojo, Y).`,
  },
  {
    id: "corte",
    tema: "Alternativas de corte",
    titulo: "Corte (!), if-then-else y once/1",
    codigo: `% Con corte: la segunda cláusula solo se usa si la primera falla antes del !
maximo(X, Y, X) :- X >= Y, !.
maximo(_, Y, Y).

% Misma idea con if-then-else
maximo2(X, Y, M) :- ( X >= Y -> M = X ; M = Y ).

n(1). n(2). n(3).

?- maximo(7, 3, M).
?- maximo2(2, 9, M).
?- once(n(X)).
?- n(X), X > 1, !.`,
  },
];
