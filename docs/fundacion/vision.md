# Visión — marcador.gal

## En una frase

**Todo o fútbol galego nunha pantalla**: los resultados en directo de las cinco
divisiones donde juegan equipos gallegos, en galego, sin ruido.

## El problema

marcadorgalego.gal fue durante años el tablero del fútbol galego. Cerró y nadie
ocupó el hueco. Flashscore y BeSoccer cubren Primera y Segunda con quinientos
partidos alrededor; nadie pone en una sola pantalla al Celta, al Depor, al Lugo,
al Racing, al Arousa y al Bergantiños con el resto de su grupo, en galego, en el
móvil, un sábado por la tarde.

## Para quién

- El aficionado gallego que quiere ver cómo van los partidos en juego, qué pasó
  en los de la tarde y a qué hora juega el suyo, todo de un vistazo.
- Periodistas y radios comarcales que necesitan Segunda RFEF y Tercera cada
  fin de semana.
- Clubes, para enlazar su resultado.

## La promesa

Qué será verdad cuando esto funcione:

1. **Una pantalla.** La jornada entera de las cinco divisiones cabe en un
   móvil. Densidad, no tarjetas.
2. **Lo gallego arriba.** Tercera G1 y Segunda RFEF G1 al mismo nivel visual
   que Primera. Ese es el nicho.
3. **En directo de verdad.** Un gol tarda menos de 45 segundos en aparecer,
   de extremo a extremo.
4. **En galego**, con castellano a un toque.
5. **Sin nadie detrás un sábado normal.** Una jornada sin incidencias no
   requiere intervención humana.

### Métricas norte

| Métrica | Objetivo v1 |
|---|---|
| Latencia gol → pantalla (mediana) | < 45 s |
| Latencia gol → pantalla (p95) | < 90 s |
| Cobertura de la jornada (partidos con Decision `finished` correcta) | 100 % |
| Intervenciones manuales por jornada sin incidencias | 0 |
| Primera pintura en móvil con 3G | < 2 s |

## Principios

- Fútbol en galego, urbano o no. Sin tópicos rurales en imagen ni tono.
- Fiabilidad trazable: cada marcador publicado sabe de dónde viene.
- Móvil primero, con mala cobertura. La primera pintura ya trae el dato.
- Cada fuente es un enchufe. El producto no depende de ninguna en concreto.

## Qué NO es este producto

No un medio. No una red social. No un Flashscore galego. No una app de apuestas.
No un sustituto de la federación.

## Autor

Proyecto de tremen.dev. Dominio marcador.gal contratado.
