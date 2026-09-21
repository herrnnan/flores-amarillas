// escalones de calidad: 0 es todo al maximo. bajo primero lo que menos se nota.
// dofRes = a que resolucion se calcula el desenfoque (la salida es borrosa, bajarla no se ve).
// bg = cuanto achico las cosas de fondo. stride = cada cuantos frames muevo las flores del campo.
export const STEPS = [
  { dpr: 2, msaa: 4, dofRes: 0.5, bg: 1, stride: 2, dof: true },
  { dpr: 2, msaa: 0, dofRes: 0.3, bg: 1, stride: 2, dof: true },
  { dpr: 1.6, msaa: 0, dofRes: 0.3, bg: 0.55, stride: 3, dof: true },
  { dpr: 1.4, msaa: 0, dofRes: 0.25, bg: 0.4, stride: 3, dof: true },
  { dpr: 1.25, msaa: 0, dofRes: 0.25, bg: 0.3, stride: 4, dof: false },
]

// a partir de aca los escalones tocan la resolucion, que es lo unico que siempre mueve
// la aguja si el problema es la carga. si ni eso mejora, no era la carga
const FILL_LEVEL = 2

// celular Android con poca RAM o pocos nucleos arranca un escalon abajo, que igual no se ve.
// en iOS estos datos no existen, asi que esos arrancan al maximo igual que la compu
export const startLevel = () =>
  /Android/i.test(navigator.userAgent) &&
  ((navigator.hardwareConcurrency || 8) <= 6 || (navigator.deviceMemory || 8) <= 4)
    ? 1
    : 0

export const FPS_TARGET = 50 // abajo de esto se siente a tirones
export const FPS_GAIN = 4 // mejora minima contra la primera medicion para que bajar tenga sentido
export const FPS_WINDOW = 700 // ms de medicion
export const FPS_SETTLE = 450 // ms que ignoro despues de cambiar: el rearmado se come un frame largo

// que hacer despues de medir una ventana. base es los FPS de la primera medicion, o null si es esa.
// 'stay' se queda donde esta y no mide mas, 'down' prueba mas abajo, 'back' vuelve al arranque
export function decide(level, fps, base, floor = 0) {
  if (base == null) {
    // primera medicion: si da, listo. si anda muy mal salteo un escalon para no perder medio show midiendo
    if (fps >= FPS_TARGET) return { action: 'stay', level }
    return { action: 'down', level: Math.min(level + (fps < 30 ? 2 : 1), STEPS.length - 1) }
  }
  // ya bajamos hasta tocar la resolucion y seguimos igual que al principio: no era la carga,
  // eran los FPS topeados (iPhone en ahorro a 30). vuelvo a la maxima y no toco mas
  if (level >= FILL_LEVEL && fps < base + FPS_GAIN) return { action: 'back', level: floor }
  if (fps >= FPS_TARGET || level >= STEPS.length - 1) return { action: 'stay', level }
  return { action: 'down', level: Math.min(level + (fps < 30 ? 2 : 1), STEPS.length - 1) }
}

// check: node src/lib/quality.js
function demo() {
  const assert = (ok, msg) => {
    if (!ok) throw new Error(msg)
  }
  const last = STEPS.length - 1

  // compu que da de sobra: se queda en la maxima sin tocar nada
  assert(decide(0, 60, null).action === 'stay', 'con 60 fps no deberia bajar nada')

  // celu lento: baja, y aunque el primer escalon no le mueva la aguja tiene que seguir bajando.
  // este era el bug: apagar el antialias en un celu no cambia nada y se rendia ahi
  assert(decide(0, 25, null).level === 2, 'con 25 fps deberia saltear un escalon')
  assert(decide(1, 27, 25).action === 'down', 'que un escalon no mejore no puede frenar la busqueda')
  assert(decide(2, 38, 25).action === 'down', 'si mejoro pero no llega, sigue')
  assert(decide(3, 52, 25).action === 'stay', 'al llegar a 50 se queda')

  // iPhone en ahorro con los fps topeados a 30: bajar no cambia nada, vuelve a la maxima
  assert(decide(1, 30, 30).action === 'down', 'antes de tocar la resolucion no puede decidir que esta topeado')
  const capped = decide(2, 30.2, 30)
  assert(capped.action === 'back' && capped.level === 0, 'si bajar la resolucion no mejora, vuelve a la maxima')

  // el Android que arranco un escalon abajo vuelve a ese, no a uno que no le corresponde
  assert(decide(2, 30, 30, 1).level === 1, 'tiene que volver al escalon de arranque')

  // ultimo escalon: no hay mas para bajar
  assert(decide(last, 20, 14).action === 'stay', 'no puede pasarse del ultimo')
  assert(decide(last - 1, 20, 14).level === last, 'el salto doble no se pasa del ultimo')

  console.log('ok')
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('quality.js')) demo()
