# App de Entrenamiento — Entrenador / Alumno

App web (PC y celular) con login por **CI**. Reúne en un solo lugar lo que se hacía con
la *Planilla de Entrenamiento PRO* y el *Planificador Clarity Trainer*.

## Cómo iniciarla
Requiere Node.js 22.5 o superior (no hay que instalar nada más).

```
node server.js
```
Abrir http://localhost:3000

**Primer ingreso del entrenador:** CI `1234567` · contraseña `entrenador` → cambiala en *Ajustes*.

## Entrenador
Menú principal: **Alumnos · Planes · Ejercicios · Alimentos · Ajustes**

Cada alumno tiene seis pestañas:

| Pestaña | Equivale en las planillas a | Qué tiene |
|---|---|---|
| **Resumen** | Dashboard | Semana del programa, adherencia, peso y medida clave, ritmo y llegada estimada a la meta, banderas de salud, próximo pago, gráficos de peso, cumplimiento semanal y fuerza por ejercicio |
| **Entrenamiento** | Planeación / Treino | Calendario semanal: rutinas por día (con enfoque), asignar plan semanal, copiar rutinas, imprimir PDF |
| **Alimentación** | Plan de Alimentación | Metas del día, menú de días de entrenamiento y de descanso (3 a 6 comidas), totales vs meta, suplementación, PDF |
| **Progreso** | Control corporal / fotos | 13 medidas inicio vs hoy, controles por fecha, fotos frente/espalda/perfiles |
| **Ficha** | Datos Personales / Dados | Identidad, programa, medidas iniciales y meta, calorías Mifflin-St Jeor y macros, anamnesis, hábitos, preferencias, notas privadas |
| **Pagos** | Acuerdo comercial | Modalidad (mensualidad o bono), tarifa, próximo pago, historial de pagos, cancelaciones |

- **Planes**: plantillas semanales con días (Entrenamiento 1, 2, 3…), día de la semana y enfoque
  (tren superior, inferior, core, cuerpo completo). Se asignan a varios alumnos hasta 16 semanas.
- **Ejercicios**: 297 ejercicios con video (de las dos planillas).
- **Alimentos**: 102 alimentos con macros por porción (del Clarity).
- **Ajustes**: logo, empresa, nombre del entrenador, contacto e Instagram (salen en los PDF).

## Alumno
**Mi semana · Alimentación · Progreso · Historial · Cuenta**: ve su entrenamiento con videos,
registra cargas y reps, marca la sesión hecha, ve su menú, su progreso y puede descargar los PDF.
Las *notas del entrenador* de la ficha no se le muestran.

## Datos
Todo se guarda en `datos.db` (SQLite), junto a `server.js`. Copiá ese archivo para respaldar.

## Publicarla en internet
Para que los alumnos entren desde su celular hay que subirla a un servidor con Node
(Render, Railway, Fly.io, un VPS…) con disco persistente para `datos.db`.
