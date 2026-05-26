# Actualizaciones Automaticas De Electron

La app de escritorio ya usa `electron-updater` y busca actualizaciones cuando esta empaquetada. El publicador configurado es GitHub Releases:

- owner: `Maxi01467`
- repo: `pos-ropa`
- provider: `github`

## Como publicar una version

1. Aumentar la version en `package.json`.

   Ejemplo:

   ```bash
   npm version patch
   ```

2. Generar y publicar el instalador en GitHub Releases.

   Necesita un token con permiso para crear releases. En la terminal:

   ```bash
   set GH_TOKEN=tu_token
   npm run release:desktop
   ```

   En PowerShell:

   ```powershell
   $env:GH_TOKEN="tu_token"
   npm run release:desktop
   ```

3. Instalar esa version al menos una vez en las PCs.

   Desde ahi, al abrir la app empaquetada, `electron-updater` revisa GitHub Releases, descarga la version nueva y muestra un dialogo para reiniciar e instalar.

## Requisitos

- Cada release debe tener una version mayor que la instalada.
- GitHub Releases debe contener los artefactos generados por `electron-builder`, especialmente `latest.yml`.
- No subir `GH_TOKEN` al repo ni guardarlo en `.env`.
- Si el repo de GitHub es privado, las PCs cliente no van a poder descargar updates sin autenticacion. Para produccion conviene usar un repo publico de releases o un provider `generic` propio con URL publica/privada controlada.

## Verificacion En Cliente

Los logs del updater quedan en:

```text
%APPDATA%/POS Ropa/desktop.log
```

Buscar lineas que empiecen con:

```text
auto-update:
```
