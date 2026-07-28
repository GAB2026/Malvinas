---
name: Malvinas release state
description: Estado actual de publicación de Distancia a Las Malvinas en Play Console
---

## Estado al 28/07/2026

### versionCode actual en repo
- `versionCode 12`, `versionName "1.1.0"` — subido a **Prueba Cerrada (Alpha)**
- Esperando aprobación de Google (llega por mail)

### Flujo restante para producción
1. Google aprueba → aparece link de opt-in en Play Console → Prueba cerrada → Testers
2. Conseguir 12 testers activos durante 14 días corridos
3. Recién entonces se habilita "Solicitar acceso a producción"

### App ID
`ar.malvinas.distancia`

### Imagen de fondo actual
`artifacts/malvinas/src/assets/default-bg.jpg` — foto real del cartel "LAS MALVINAS SON ARGENTINAS" sobre pasto, retrato 572×1024, cartel en la mitad inferior.

### Regla importante
Cada push que dispara un build en CI **debe tener el versionCode incrementado** en `artifacts/malvinas/android/app/build.gradle` ANTES del commit. Play Console rechaza versionCodes repetidos o menores al último subido.

**Why:** ya perdimos builds por olvidar incrementar el code antes de pushear.
