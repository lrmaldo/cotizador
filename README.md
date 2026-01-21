# Gestor de Cotizaciones (Vanilla JS + Firebase)

Este proyecto es un gestor de cotizaciones simple utilizando JavaScript Vanilla, Firebase Firestore y Tailwind CSS.

## 🚀 Configuración Inicial

### 1. Crear proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto llamado `gestor-cotizaciones`.
3. Desactiva Google Analytics para hacerlo más rápido (opcional).

### 2. Configurar Base de Datos (Firestore)
1. En el menú izquierdo, ve a **Build > Firestore Database**.
2. Click en **Create Database**.
3. Elige ubicación (usmultiregion es el default).
4. **IMPORTANTE:** Elige **Start in test mode** (Modo prueba) para empezar sin configurar reglas de seguridad complejas inmediatamente.
   - *Nota: En producción deberás configurar las reglas para que no cualquiera pueda editar.*

### 3. Obtener Credenciales
1. Ve a **Project Overview** (icono de engranaje > Project Settings).
2. Abajo en "Your apps", selecciona el icono de Web (`</>`).
3. Registra la app (ponle un nombre).
4. **Copia el objeto `firebaseConfig`** que aparece en pantalla.
5. Pégalo en el archivo `firebase-config.js` de este proyecto, reemplazando el existente.

---

## 🛠️ Ejecutar Localmente

Como usamos ES Modules (`type="module"`), necesitas un servidor local simple, no puedes abrir el archivo `index.html` directamente (doble click) por políticas de seguridad del navegador (CORS).

Si tienes VS Code:
1. Instala la extensión **Live Server**.
2. Click derecho en `index.html` -> **Open with Live Server**.

---

## ☁️ Desplegar en Firebase Hosting

Necesitas tener Node.js instalado para usar las herramientas de despliegue.

1. Instala Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login en Firebase:
   ```bash
   firebase login
   ```

3. Inicializar proyecto:
   ```bash
   firebase init hosting
   ```
   - Selecciona "Use an existing project" (el que creaste antes).
   - "What do you want to use as your public directory?": Escribe `.` (punto actual) o crea una carpeta `public` y mueve los archivos html/js/css ahí (recomendado para producción, pero para este demo rápido puedes usar la raíz). **Si usas la raíz `.`, asegúrate de que no sobrescriba tu `index.html` (di NO cuando pregunte si quieres sobrescribirlo).**
   - "Configure as a single-page app?": No.
   - "Set up automatic builds and deploys with GitHub?": No (por ahora).

4. Desplegar:
   ```bash
   firebase deploy
   ```
