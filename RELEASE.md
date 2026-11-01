# Release checklist

## Before building

- Run `pnpm test` and confirm all tests pass.
- Run `pnpm build` and confirm the Nuxt static application and Electron code compile.
- Update the version in `package.json`.
- Confirm the application name, app ID, icon, company details, and translations.

## Build the installer

Run `pnpm dist` on a 64-bit Windows build computer. The NSIS installer is written to `release/`.

## Acceptance on a clean Windows computer

- Install without administrator rights and open the desktop shortcut.
- Complete first-run setup, save the recovery key, and log in.
- Create, find, edit, delete, and restore a record.
- Create a PDF and Excel report.
- Create a backup, validate it, and restore it on a test copy.
- Confirm the uninstaller preserves the user-data and backup folders.

## Release notes

Record the installer filename, version, build date, test result, and any known limitations for each release.
