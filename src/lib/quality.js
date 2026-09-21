// escalones de calidad: 0 es todo al maximo. bajo primero lo que menos se nota
// (el antialias que el bloom ya disimula, despues el fondo desenfocado, y recien ahi la resolucion)
export const STEPS = [
  { dpr: 2, msaa: 4, bg: 1, dof: true },
  { dpr: 2, msaa: 0, bg: 1, dof: true },
  { dpr: 2, msaa: 0, bg: 0.5, dof: true },
  { dpr: 1.5, msaa: 0, bg: 0.5, dof: true },
  { dpr: 1.5, msaa: 0, bg: 0.35, dof: false },
]

// celular Android chico (4 nucleos o menos, 3 GB o menos) arranca un escalon abajo.
// en iOS estos datos no existen, asi que esos arrancan al maximo igual que la compu
export const startLevel = () =>
  /Android/i.test(navigator.userAgent) &&
  ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3)
    ? 1
    : 0

export const FPS_TARGET = 50 // abajo de esto se siente a tirones
export const FPS_GAIN = 4 // mejora minima para que haber bajado un escalon valga la pena
export const FPS_WINDOW = 1000 // ms de medicion
export const FPS_SETTLE = 700 // ms que ignoro despues de cambiar: el rearmado se come un frame largo

// que hacer despues de medir una ventana. prev es { level, fps } de la medicion anterior, o null
// 'stay' se queda donde esta y no mide mas, 'down' prueba un escalon abajo, 'back' vuelve al anterior
export function decide(level, fps, prev) {
  // si bajar no mejoro nada no era la carga, eran los FPS topeados (iPhone en ahorro a 30).
  // vuelvo a lo de antes y no toco mas, asi no queda pixelado al pedo
  if (prev && fps < prev.fps + FPS_GAIN) return { action: 'back', level: prev.level }
  if (fps >= FPS_TARGET || level >= STEPS.length - 1) return { action: 'stay', level }
  return { action: 'down', level: level + 1 }
}

// check: node src/lib/quality.js
function demo() {
  const assert = (ok, msg) => {
    if (!ok) throw new Error(msg)
  }
  // compu que da de sobra: se queda en la maxima
  assert(decide(0, 60, null).action === 'stay', 'con 60 fps no deberia bajar nada')
  // celu que no da: baja de a uno hasta llegar
  assert(decide(0, 28, null).level === 1, 'con 28 fps deberia probar un escalon abajo')
  assert(decide(1, 41, { level: 0, fps: 28 }).level === 2, 'si mejoro y todavia no llega, sigue bajando')
  assert(decide(2, 55, { level: 1, fps: 41 }).action === 'stay', 'al llegar a 50 se queda')
  // iPhone en ahorro con los fps topeados a 30: bajar no cambia nada, vuelve a la maxima
  const capped = decide(1, 30.2, { level: 0, fps: 30 })
  assert(capped.action === 'back' && capped.level === 0, 'si bajar no mejora tiene que volver a la maxima')
  // ultimo escalon: no hay mas para bajar
  assert(decide(STEPS.length - 1, 20, { level: STEPS.length - 2, fps: 14 }).action === 'stay', 'no puede pasarse del ultimo')
  console.log('ok')
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('quality.js')) demo()
